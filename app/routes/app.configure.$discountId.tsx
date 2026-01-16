import { useState, useEffect } from "react";
import {
  data,
  useLoaderData,
  useActionData,
  useSubmit,
  useNavigation,
  useNavigate,
} from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  EmptyState,
  Tag,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { RuleManager } from "../services/rule-manager.server";
import { useShopifyAppBridge } from "../hooks/useShopifyAppBridge";

interface Collection {
  id: string;
  title: string;
  handle: string;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  status: string;
}

interface DiscountRule {
  id: string;
  discountId: string;
  excludedCollections: Array<{
    id: string;
    collectionId?: string;
    title: string;
  }>;
  excludedProducts: Array<{
    id: string;
    productId?: string;
    title: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface LoaderData {
  collections: Collection[];
  products: Product[];
  discountDetails: {
    discountInfo: {
      id: string;
      title: string;
      value_type: string;
      value: string;
      status: string;
    } | null;
    rule: DiscountRule | null;
    hasExistingRule: boolean;
  };
  discountId: string;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const discountId = params.discountId;

  if (!discountId) {
    throw new Response("Discount ID is required", { status: 400 });
  }

  console.log(
    `🎯 [SPECIFIC CONFIGURE] Loading discount details for ID: ${discountId}`,
  );
  console.log("📍 [SPECIFIC CONFIGURE] Route: app.configure.$discountId.tsx");
  console.log("🔗 [SPECIFIC CONFIGURE] Full URL:", request.url);

  try {
    // Ottieni i dettagli del discount e delle sue regole
    const discountDetails = await RuleManager.getDiscountRuleDetails(
      session.shop,
      discountId,
      admin, // Passa l'admin object per ottenere informazioni reali
    );

    // Fetch collections usando GraphQL
    let collections: Collection[] = [];
    try {
      const response = await admin.graphql(
        `#graphql
          query {
            collections(first: 250) {
              edges {
                node {
                  id
                  title
                  handle
                }
              }
            }
          }`,
      );

      const responseJson = (await response.json()) as {
        data?: {
          collections?: {
            edges?: Array<{
              node: {
                id: string;
                title?: string;
                handle?: string;
              };
            }>;
          };
        };
      };
      if (responseJson.data?.collections?.edges) {
        collections = responseJson.data.collections.edges.map((edge) => ({
          id: edge.node.id,
          title: edge.node.title || "Untitled Collection",
          handle: edge.node.handle || "",
        }));
      }
      console.log(`✅ Found ${collections.length} collections`);
    } catch (error) {
      console.error("❌ Error fetching collections:", error);
      collections = [];
    }

    // Fetch products usando GraphQL
    let products: Product[] = [];
    try {
      const response = await admin.graphql(
        `#graphql
          query {
            products(first: 250) {
              edges {
                node {
                  id
                  title
                  handle
                  status
                }
              }
            }
          }`,
      );

      const responseJson = (await response.json()) as {
        data?: {
          products?: {
            edges?: Array<{
              node: {
                id: string;
                title?: string;
                handle?: string;
                status?: string;
              };
            }>;
          };
        };
      };
      if (responseJson.data?.products?.edges) {
        products = responseJson.data.products.edges.map((edge) => ({
          id: edge.node.id,
          title: edge.node.title || "Untitled Product",
          handle: edge.node.handle || "",
          status: edge.node.status || "DRAFT",
        }));
      }
      console.log(`✅ Found ${products.length} products`);
    } catch (error) {
      console.error("❌ Error fetching products:", error);
      products = [];
    }

    console.log("📊 Discount details loaded:", {
      discountInfo: discountDetails.discountInfo,
      hasRule: discountDetails.hasExistingRule,
      ruleId: discountDetails.rule?.id,
      collections: collections.length,
      products: products.length,
    });

    console.log("🔍 [Loader] Full discountDetails object:", discountDetails);

    return data({
      collections,
      products,
      discountDetails,
      discountId,
    });
  } catch (error) {
    console.error("Loader error:", error);
    throw new Response("Failed to load discount details", { status: 500 });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const discountId = params.discountId;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (!discountId) {
    return data({ success: false, message: "Discount ID is required" });
  }

  if (actionType === "saveExclusions") {
    try {
      const excludedCollections = JSON.parse(
        (formData.get("excludedCollections") as string) || "[]",
      );
      const excludedProducts = JSON.parse(
        (formData.get("excludedProducts") as string) || "[]",
      );

      console.log("💾 Saving exclusions for discount:", discountId);
      console.log("- Excluded collections:", excludedCollections);
      console.log("- Excluded products:", excludedProducts);

      // 1. Salva le regole di esclusione nel database
      await RuleManager.upsertRule(session.shop, {
        discountId,
        mode: "exclude",
        excludedCollections,
        excludedProducts,
      });

      console.log("✅ Exclusions saved to database successfully");

      // 2. Aggiorna il discount di Shopify rimuovendo gli elementi esclusi
      try {
        console.log("🔄 Starting Shopify discount update...");
        console.log("🆔 Raw discountId:", discountId);

        // Prova diversi formati di GID per trovare quello corretto
        const possibleFormats = [];

        if (discountId.startsWith("gid://shopify/")) {
          // È già un GID, usalo così com'è
          possibleFormats.push(discountId);
        } else {
          // Prova diversi tipi di discount GID
          possibleFormats.push(
            `gid://shopify/DiscountAutomaticNode/${discountId}`,
          );
          possibleFormats.push(`gid://shopify/DiscountCodeNode/${discountId}`);
          possibleFormats.push(`gid://shopify/DiscountNode/${discountId}`);

          // Se l'ID è numerico, prova anche senza prefisso
          if (!isNaN(Number(discountId))) {
            possibleFormats.push(
              `gid://shopify/DiscountAutomaticBasic/${discountId}`,
            );
            possibleFormats.push(
              `gid://shopify/DiscountCodeBasic/${discountId}`,
            );
          }
        }

        console.log("🔧 Trying GID formats:", possibleFormats);

        let shopifyDiscountId = null;
        let currentDiscountData = null;

        // Prima ottieni i dettagli attuali del discount provando diversi formati
        const discountQuery = `
          #graphql
          query getDiscount($id: ID!) {
            discountNode(id: $id) {
              discount {
                ... on DiscountAutomaticBasic {
                  customerGets {
                    items {
                      ... on DiscountCollections {
                        collections(first: 250) {
                          nodes {
                            id
                          }
                        }
                      }
                      ... on DiscountProducts {
                        products(first: 250) {
                          nodes {
                            id
                          }
                        }
                      }
                    }
                  }
                }
                ... on DiscountCodeBasic {
                  customerGets {
                    items {
                      ... on DiscountCollections {
                        collections(first: 250) {
                          nodes {
                            id
                          }
                        }
                      }
                      ... on DiscountProducts {
                        products(first: 250) {
                          nodes {
                            id
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        // Prova ogni formato fino a trovarne uno che funziona
        for (const format of possibleFormats) {
          try {
            console.log("📞 Trying GraphQL query with ID:", format);
            const response = await admin.graphql(discountQuery, {
              variables: { id: format },
            });

            const data = await response.json();
            console.log(
              "📋 Response for",
              format,
              ":",
              JSON.stringify(data, null, 2),
            );

            if (data.data?.discountNode && !data.errors) {
              shopifyDiscountId = format;
              currentDiscountData = data;
              console.log("✅ Found working GID format:", format);
              break;
            } else if (data.errors) {
              console.log(
                "❌ Error with format",
                format,
                ":",
                data.errors[0]?.message,
              );
            }
          } catch (error) {
            console.log("❌ Failed to query with format", format, ":", error);
          }
        }

        if (!shopifyDiscountId || !currentDiscountData) {
          throw new Error(
            "Could not find discount with any of the tried GID formats",
          );
        }

        // Estrai le collection e products attuali
        const currentItems =
          currentDiscountData.data?.discountNode?.discount?.customerGets?.items;
        const currentCollections = currentItems?.collections?.nodes || [];
        const currentProducts = currentItems?.products?.nodes || [];

        console.log(
          "🔍 Current collections:",
          currentCollections.map((c: any) => c.id),
        );
        console.log(
          "🔍 Current products:",
          currentProducts.map((p: any) => p.id),
        );

        // Filtra rimuovendo gli elementi esclusi
        const allowedCollections = currentCollections.filter(
          (collection: any) =>
            !excludedCollections.some(
              (excluded: any) => excluded.id === collection.id,
            ),
        );
        const allowedProducts = currentProducts.filter(
          (product: any) =>
            !excludedProducts.some(
              (excluded: any) => excluded.id === product.id,
            ),
        );

        console.log(
          "✅ Allowed collections after filtering:",
          allowedCollections.map((c: any) => c.id),
        );
        console.log(
          "✅ Allowed products after filtering:",
          allowedProducts.map((p: any) => p.id),
        );

        // Debug del confronto
        console.log("🔍 Comparison details:");
        console.log("- Current collections count:", currentCollections.length);
        console.log("- Allowed collections count:", allowedCollections.length);
        console.log("- Current products count:", currentProducts.length);
        console.log("- Allowed products count:", allowedProducts.length);
        console.log(
          "- Collections changed?",
          allowedCollections.length !== currentCollections.length,
        );
        console.log(
          "- Products changed?",
          allowedProducts.length !== currentProducts.length,
        );
        console.log(
          "- Excluded collections to remove:",
          excludedCollections.map((c: any) => c.id),
        );
        console.log(
          "- Excluded products to remove:",
          excludedProducts.map((p: any) => p.id),
        );

        // 3. Aggiorna effettivamente il discount in Shopify
        const hasChanges =
          allowedCollections.length !== currentCollections.length ||
          allowedProducts.length !== currentProducts.length ||
          excludedCollections.length > 0 ||
          excludedProducts.length > 0;

        console.log("🎯 Should update?", hasChanges);

        if (hasChanges) {
          console.log("🔄 Updating Shopify discount with new items...");

          // Determina il tipo di mutation basato sul GID trovato
          let updateMutation;
          let mutationName;
          let mutationDiscountId = shopifyDiscountId;

          // Per le mutation, spesso il GID deve essere adattato
          if (
            shopifyDiscountId.includes("DiscountAutomaticNode") ||
            shopifyDiscountId.includes("DiscountAutomaticBasic")
          ) {
            updateMutation = `
              #graphql
              mutation discountAutomaticBasicUpdate($id: ID!, $automaticBasicDiscount: DiscountAutomaticBasicInput!) {
                discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $automaticBasicDiscount) {
                  automaticDiscountNode {
                    id
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;
            mutationName = "discountAutomaticBasicUpdate";

            // Per le mutation automatic, potrebbe servire solo il GID del node
            if (shopifyDiscountId.includes("DiscountAutomaticNode")) {
              mutationDiscountId = shopifyDiscountId; // Usa come è
            } else {
              // Se abbiamo trovato con DiscountAutomaticBasic, prova a convertire in Node
              mutationDiscountId = shopifyDiscountId.replace(
                "DiscountAutomaticBasic",
                "DiscountAutomaticNode",
              );
            }
          } else if (
            shopifyDiscountId.includes("DiscountCodeNode") ||
            shopifyDiscountId.includes("DiscountCodeBasic")
          ) {
            updateMutation = `
              #graphql
              mutation discountCodeBasicUpdate($id: ID!, $codeDiscountNode: DiscountCodeBasicInput!) {
                discountCodeBasicUpdate(id: $id, codeDiscountNode: $codeDiscountNode) {
                  codeDiscountNode {
                    id
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;
            mutationName = "discountCodeBasicUpdate";

            // Per le mutation code, potrebbe servire solo il GID del node
            if (shopifyDiscountId.includes("DiscountCodeNode")) {
              mutationDiscountId = shopifyDiscountId; // Usa come è
            } else {
              // Se abbiamo trovato con DiscountCodeBasic, prova a convertire in Node
              mutationDiscountId = shopifyDiscountId.replace(
                "DiscountCodeBasic",
                "DiscountCodeNode",
              );
            }
          } else {
            throw new Error(
              `Unsupported discount type for GID: ${shopifyDiscountId}`,
            );
          }

          console.log("🔧 Query GID:", shopifyDiscountId);
          console.log("🔧 Mutation GID:", mutationDiscountId);
          console.log("🔧 Using mutation:", mutationName);

          const updateInput = {
            customerGets: {
              items: {
                // Invece di rimuovere, impostiamo solo gli elementi consentiti
                ...(allowedCollections.length > 0 && {
                  collections: {
                    add: allowedCollections.map((c: any) => c.id),
                  },
                }),
                ...(allowedProducts.length > 0 && {
                  products: {
                    add: allowedProducts.map((p: any) => p.id),
                  },
                }),
                // Se non ci sono items consentiti, applica a tutto
                ...(allowedCollections.length === 0 &&
                  allowedProducts.length === 0 && {
                    all: true,
                  }),
              },
            },
          };

          console.log("📤 Update input:", JSON.stringify(updateInput, null, 2));
          console.log("🔧 Query GID:", shopifyDiscountId);
          console.log("🔧 Mutation GID:", mutationDiscountId);
          console.log("🔧 Using mutation:", mutationName);

          const variables =
            mutationName === "discountAutomaticBasicUpdate"
              ? { id: mutationDiscountId, automaticBasicDiscount: updateInput }
              : { id: mutationDiscountId, codeDiscountNode: updateInput };

          const updateResponse = await admin.graphql(updateMutation, {
            variables,
          });

          const updateResult = await updateResponse.json();
          console.log(
            "📥 Update result:",
            JSON.stringify(updateResult, null, 2),
          );

          const userErrors = updateResult.data?.[mutationName]?.userErrors;
          if (userErrors?.length > 0) {
            console.error("❌ Update errors:", userErrors);

            // Se fallisce con il GID convertito, prova con l'originale
            if (mutationDiscountId !== shopifyDiscountId) {
              console.log("🔄 Retrying with original query GID...");

              const retryVariables =
                mutationName === "discountAutomaticBasicUpdate"
                  ? {
                      id: shopifyDiscountId,
                      automaticBasicDiscount: updateInput,
                    }
                  : { id: shopifyDiscountId, codeDiscountNode: updateInput };

              const retryResponse = await admin.graphql(updateMutation, {
                variables: retryVariables,
              });

              const retryResult = await retryResponse.json();
              console.log(
                "📥 Retry result:",
                JSON.stringify(retryResult, null, 2),
              );

              const retryErrors = retryResult.data?.[mutationName]?.userErrors;
              if (retryErrors?.length > 0) {
                console.error("❌ Retry also failed:", retryErrors);
                throw new Error(
                  `Shopify update failed: ${JSON.stringify(retryErrors)}`,
                );
              }

              console.log(
                "✅ Shopify discount successfully updated with retry!",
              );
            } else {
              throw new Error(
                `Shopify update failed: ${JSON.stringify(userErrors)}`,
              );
            }
          } else {
            console.log("✅ Shopify discount successfully updated!");
          }
        } else {
          console.log(
            "ℹ️ No changes needed - discount already in correct state",
          );
        }

        console.log("ℹ️ Shopify discount update completed");
      } catch (updateError) {
        console.error("⚠️ Failed to update Shopify discount:", updateError);
        console.log("ℹ️ Continuing with database-only exclusion tracking...");
        // Non far fallire tutto - le exclusions sono salvate nel database e verranno applicate dalla logica applicativa
      }

      return data({
        success: true,
        message:
          "Exclusions saved successfully! The app will apply these exclusions when processing discount rules.",
      });
    } catch (error) {
      console.error("Failed to save exclusions:", error);
      console.error("Error details:", error);
      return data({
        success: false,
        message: `Failed to save exclusions: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  return data({
    success: false,
    message: "Invalid action",
  });
};

export default function ConfigureDiscountExclusions() {
  const { collections, products, discountDetails, discountId } =
    useLoaderData<LoaderData>();
  const actionData = useActionData<{ success: boolean; message: string }>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const { showResourcePicker } = useShopifyAppBridge();

  const [excludedCollectionIds, setExcludedCollectionIds] = useState<
    Set<string>
  >(new Set());
  const [excludedProductIds, setExcludedProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [removedSavedCollections, setRemovedSavedCollections] = useState<
    Set<string>
  >(new Set());
  const [removedSavedProducts, setRemovedSavedProducts] = useState<Set<string>>(
    new Set(),
  );
  const [showBanner, setShowBanner] = useState(true);

  console.log("🚧 [Component] discountDetail", discountDetails);
  console.log("🎯 [Component] Debug values:", {
    hasDiscountDetails: !!discountDetails,
    hasDiscountInfo: !!discountDetails?.discountInfo,
    hasRule: !!discountDetails?.rule,
    hasExistingRule: discountDetails?.hasExistingRule,
    ruleId: discountDetails?.rule?.id,
  });

  // Carica le esclusioni esistenti quando i dati sono disponibili
  useEffect(() => {
    if (discountDetails?.rule) {
      setExcludedCollectionIds(
        new Set(
          discountDetails.rule.excludedCollections.map(
            (c: { collectionId?: string; id: string }) =>
              c.collectionId || c.id,
          ),
        ),
      );
      setExcludedProductIds(
        new Set(
          discountDetails.rule.excludedProducts.map(
            (p: { productId?: string; id: string }) => p.productId || p.id,
          ),
        ),
      );
    } else {
      setExcludedCollectionIds(new Set());
    }
  }, [discountDetails]);

  // Handle form submission
  const handleSave = () => {
    const excludedCollections = collections
      .filter((c) => excludedCollectionIds.has(c.id))
      .map((c) => ({ id: c.id, title: c.title }));

    const excludedProducts = products
      .filter((p) => excludedProductIds.has(p.id))
      .map((p) => ({ id: p.id, title: p.title }));

    const formData = new FormData();
    formData.append("actionType", "saveExclusions");
    formData.append("excludedCollections", JSON.stringify(excludedCollections));
    formData.append("excludedProducts", JSON.stringify(excludedProducts));

    submit(formData, { method: "post" });
  };

  const isLoading = navigation.state !== "idle";

  // Se non ci sono informazioni sul discount, mostra errore
  if (!discountDetails?.discountInfo) {
    return (
      <Page
        title="Discount Not Found"
        backAction={{
          content: "Back to Discounts",
          onAction: () => navigate("/app/discounts"),
        }}
      >
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="Discount not found"
              image=""
              action={{
                content: "Back to Discounts",
                onAction: () => navigate("/app/discounts"),
              }}
            >
              <p>
                The discount with ID &quot;{discountId}&quot; could not be
                found. Please check the discount ID or return to the discounts
                list.
              </p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const { discountInfo, hasExistingRule } = discountDetails;

  return (
    <Page
      title={
        hasExistingRule
          ? "Edit Discount Exclusions"
          : "Configure Discount Exclusions"
      }
      subtitle={`Managing exclusions for "${discountInfo.title}"`}
      backAction={{
        content: "Back to Discounts",
        onAction: () => navigate("/app/discounts"),
      }}
    >
      <Layout>
        {/* Status Banner */}
        {hasExistingRule ? (
          <Layout.Section>
            <Banner tone="info">
              <p>
                <strong>Editing Mode:</strong> You are modifying exclusions for
                &quot;{discountInfo.title}&quot;. Current exclusions have been
                loaded and are ready for editing.
              </p>
            </Banner>
          </Layout.Section>
        ) : (
          <Layout.Section>
            <Banner tone="success">
              <p>
                <strong>Setup Mode:</strong> You are configuring exclusions for
                &quot;{discountInfo.title}&quot;. Select which collections and
                products should be excluded from this discount.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {/* Action Banner */}
        {actionData && showBanner && (
          <Layout.Section>
            <Banner
              tone={actionData.success ? "success" : "critical"}
              onDismiss={() => setShowBanner(false)}
            >
              <p>{actionData.message}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Discount Info */}
        <Layout.Section>
          <Card>
            <div style={{ padding: "16px" }}>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Text variant="headingSm" as="h3">
                    🔒 Locked Discount
                  </Text>
                  <Badge tone="attention">
                    {hasExistingRule ? "Edit Mode" : "Setup Mode"}
                  </Badge>
                </InlineStack>

                <InlineStack gap="200" blockAlign="center">
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    {discountInfo.title}
                  </Text>
                  <Badge tone="info">
                    {discountInfo.value_type === "percentage"
                      ? `${parseFloat(discountInfo.value)}% off`
                      : `$${discountInfo.value} off`}
                  </Badge>
                  <Badge
                    tone={
                      discountInfo.status === "ACTIVE" ? "success" : "attention"
                    }
                  >
                    {discountInfo.status}
                  </Badge>
                </InlineStack>

                <Text variant="bodySm" tone="subdued" as="p">
                  Configure which collections and products should be excluded
                  from this discount. The discount itself cannot be changed from
                  this page.
                </Text>
              </BlockStack>
            </div>
          </Card>
        </Layout.Section>

        {/* Collections Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                2. Excluded Collections
              </Text>
              <Text variant="bodyMd" tone="subdued" as="p">
                Select collections to exclude from this discount.
              </Text>

              {/* Current excluded collections */}
              {((discountDetails?.rule?.excludedCollections?.length || 0) > 0 ||
                excludedCollectionIds.size > 0) && (
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">
                    Currently Excluded (
                    {(discountDetails?.rule?.excludedCollections?.length || 0) -
                      removedSavedCollections.size +
                      collections.filter((c) => {
                        const isSelected = excludedCollectionIds.has(c.id);
                        const isAlreadySaved =
                          discountDetails?.rule?.excludedCollections?.some(
                            (saved) =>
                              (saved.collectionId || saved.id) === c.id,
                          );
                        return isSelected && !isAlreadySaved;
                      }).length}
                    )
                  </Text>
                  <InlineStack gap="100" wrap>
                    {/* Elementi salvati nel database */}
                    {discountDetails?.rule?.excludedCollections
                      ?.filter((excludedCollection) => {
                        const collectionId =
                          excludedCollection.collectionId ||
                          excludedCollection.id;
                        return !removedSavedCollections.has(collectionId);
                      })
                      ?.map((excludedCollection) => {
                        const collectionId =
                          excludedCollection.collectionId ||
                          excludedCollection.id;
                        const collectionTitle =
                          excludedCollection.title ||
                          collections.find((c) => c.id === collectionId)
                            ?.title ||
                          "Unknown Collection";

                        return (
                          <Tag
                            key={`saved-${excludedCollection.id}`}
                            onRemove={() => {
                              // Segna come rimosso dagli elementi salvati
                              const newRemovedSet = new Set(
                                removedSavedCollections,
                              );
                              newRemovedSet.add(collectionId);
                              setRemovedSavedCollections(newRemovedSet);

                              // Rimuovi anche dalla lista corrente se presente
                              const newSet = new Set(excludedCollectionIds);
                              newSet.delete(collectionId);
                              setExcludedCollectionIds(newSet);
                            }}
                          >
                            📁 {collectionTitle} ✅
                          </Tag>
                        );
                      })}

                    {/* Elementi selezionati ma non ancora salvati */}
                    {collections
                      .filter((c) => {
                        const isSelected = excludedCollectionIds.has(c.id);
                        const isAlreadySaved =
                          discountDetails?.rule?.excludedCollections?.some(
                            (saved) =>
                              (saved.collectionId || saved.id) === c.id,
                          );
                        return isSelected && !isAlreadySaved;
                      })
                      .map((collection) => (
                        <Tag
                          key={`pending-${collection.id}`}
                          onRemove={() => {
                            const newSet = new Set(excludedCollectionIds);
                            newSet.delete(collection.id);
                            setExcludedCollectionIds(newSet);
                          }}
                        >
                          📁 {collection.title} ⏳
                        </Tag>
                      ))}
                  </InlineStack>
                </BlockStack>
              )}

              <Button
                onClick={async () => {
                  try {
                    const result = await showResourcePicker("Collection", {
                      multiple: true,
                      selectionIds: collections
                        .filter((c) => excludedCollectionIds.has(c.id))
                        .map((c) => ({ id: c.id })),
                    });
                    if (result?.selection) {
                      const newSet = new Set(excludedCollectionIds);
                      result.selection.forEach((item: { id: string }) => {
                        newSet.add(item.id);
                      });
                      setExcludedCollectionIds(newSet);
                    }
                  } catch (error) {
                    console.error("Error selecting collections:", error);
                  }
                }}
              >
                Browse Collections
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Products Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                3. Excluded Products
              </Text>
              <Text variant="bodyMd" tone="subdued" as="p">
                Select individual products to exclude from this discount.
              </Text>

              {/* Current excluded products */}
              {((discountDetails?.rule?.excludedProducts?.length || 0) > 0 ||
                excludedProductIds.size > 0) && (
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">
                    Currently Excluded (
                    {(discountDetails?.rule?.excludedProducts?.length || 0) -
                      removedSavedProducts.size +
                      products.filter((p) => {
                        const isSelected = excludedProductIds.has(p.id);
                        const isAlreadySaved =
                          discountDetails?.rule?.excludedProducts?.some(
                            (saved) => (saved.productId || saved.id) === p.id,
                          );
                        return isSelected && !isAlreadySaved;
                      }).length}
                    )
                  </Text>
                  <InlineStack gap="100" wrap>
                    {/* Elementi salvati nel database */}
                    {discountDetails?.rule?.excludedProducts
                      ?.filter((excludedProduct) => {
                        const productId =
                          excludedProduct.productId || excludedProduct.id;
                        return !removedSavedProducts.has(productId);
                      })
                      ?.map((excludedProduct) => {
                        const productId =
                          excludedProduct.productId || excludedProduct.id;
                        const productTitle =
                          excludedProduct.title ||
                          products.find((p) => p.id === productId)?.title ||
                          "Unknown Product";

                        return (
                          <Tag
                            key={`saved-${excludedProduct.id}`}
                            onRemove={() => {
                              // Segna come rimosso dagli elementi salvati
                              const newRemovedSet = new Set(
                                removedSavedProducts,
                              );
                              newRemovedSet.add(productId);
                              setRemovedSavedProducts(newRemovedSet);

                              // Rimuovi anche dalla lista corrente se presente
                              const newSet = new Set(excludedProductIds);
                              newSet.delete(productId);
                              setExcludedProductIds(newSet);
                            }}
                          >
                            📦 {productTitle} ✅
                          </Tag>
                        );
                      })}

                    {/* Elementi selezionati ma non ancora salvati */}
                    {products
                      .filter((p) => {
                        const isSelected = excludedProductIds.has(p.id);
                        const isAlreadySaved =
                          discountDetails?.rule?.excludedProducts?.some(
                            (saved) => (saved.productId || saved.id) === p.id,
                          );
                        return isSelected && !isAlreadySaved;
                      })
                      .map((product) => (
                        <Tag
                          key={`pending-${product.id}`}
                          onRemove={() => {
                            const newSet = new Set(excludedProductIds);
                            newSet.delete(product.id);
                            setExcludedProductIds(newSet);
                          }}
                        >
                          📦 {product.title} ⏳
                        </Tag>
                      ))}
                  </InlineStack>
                </BlockStack>
              )}

              <Button
                onClick={async () => {
                  try {
                    const result = await showResourcePicker("Product", {
                      multiple: true,
                      selectionIds: products
                        .filter((p) => excludedProductIds.has(p.id))
                        .map((p) => ({ id: p.id })),
                    });
                    if (result?.selection) {
                      const newSet = new Set(excludedProductIds);
                      result.selection.forEach((item: { id: string }) => {
                        newSet.add(item.id);
                      });
                      setExcludedProductIds(newSet);
                    }
                  } catch (error) {
                    console.error("Error selecting products:", error);
                  }
                }}
              >
                Browse Products
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Save Section */}
        <Layout.Section>
          <Card>
            <div style={{ padding: "16px" }}>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  4. Save Changes
                </Text>
                <InlineStack gap="200">
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    loading={isLoading}
                    disabled={
                      excludedCollectionIds.size === 0 &&
                      excludedProductIds.size === 0 &&
                      removedSavedCollections.size === 0 &&
                      removedSavedProducts.size === 0
                    }
                  >
                    {hasExistingRule ? "Update Exclusions" : "Save Exclusions"}
                  </Button>
                  <Button
                    onClick={() => {
                      // Rimuovi tutti gli elementi selezionati
                      setExcludedCollectionIds(new Set());
                      setExcludedProductIds(new Set());

                      // Marca tutti gli elementi salvati come rimossi
                      const allSavedCollectionIds = new Set(
                        discountDetails?.rule?.excludedCollections?.map(
                          (c) => c.collectionId || c.id,
                        ) || [],
                      );
                      const allSavedProductIds = new Set(
                        discountDetails?.rule?.excludedProducts?.map(
                          (p) => p.productId || p.id,
                        ) || [],
                      );

                      setRemovedSavedCollections(allSavedCollectionIds);
                      setRemovedSavedProducts(allSavedProductIds);
                    }}
                    disabled={isLoading}
                  >
                    Clear All
                  </Button>
                </InlineStack>
              </BlockStack>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
