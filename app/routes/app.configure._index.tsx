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
  Select,
  EmptyState,
  Divider,
  TextField,
  Tag,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getDiscountCodes } from "../services/discount.server";
import { RuleManager } from "../services/rule-manager.server";
import { useShopifyAppBridge } from "../hooks/useShopifyAppBridge";

interface DiscountWithCodes {
  id: string;
  title: string;
  value_type: string;
  value: string;
  discount_codes: Array<{ code: string; usage_count: number }>;
  collections_count: number;
  target_selection: string;
}

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
  excludedCollections: Array<{ id: string; title: string }>;
  excludedProducts: Array<{ id: string; title: string }>;
  createdAt: string;
  updatedAt: string;
}

interface LoaderData {
  discounts: DiscountWithCodes[];
  collections: Collection[];
  products: Product[];
  rules: DiscountRule[];
  shopMode: string;
}

interface GraphQLCollectionNode {
  id: string;
  title: string;
  handle: string;
}

interface GraphQLProductNode {
  id: string;
  title: string;
  handle: string;
  status: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
  }>;
}

interface ResourcePickerSelection {
  id: string;
  title?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  console.log("🎯 [GENERIC CONFIGURE] Loading generic configuration page");
  console.log("📍 [GENERIC CONFIGURE] Route: app.configure.tsx");

  try {
    // Fetch discounts using the service with admin object
    const discounts = await getDiscountCodes(admin);

    // Fetch collections using GraphQL
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
                  productsCount {
                    count
                  }
                }
              }
            }
          }`,
      );

      const responseJson = (await response.json()) as GraphQLResponse<{
        collections: {
          edges: Array<{ node: GraphQLCollectionNode }>;
        };
      }>;
      console.log("📊 Collections GraphQL Response:", responseJson);

      // Check for GraphQL errors
      if (responseJson.errors) {
        console.error("❌ GraphQL errors:", responseJson.errors);
        throw new Error(
          `GraphQL query failed: ${responseJson.errors[0]?.message || "Unknown error"}`,
        );
      }

      if (!responseJson.data || !responseJson.data.collections) {
        collections = [];
      } else {
        collections = responseJson.data.collections.edges.map((edge) => ({
          id: edge.node.id,
          title: edge.node.title || "Untitled Collection",
          handle: edge.node.handle || "",
        }));
      }

      console.log(`✅ Found ${collections.length} collections via GraphQL`);
    } catch (error) {
      console.error("❌ Error fetching collections via GraphQL:", error);
      collections = [];
    }

    // Fetch products using GraphQL
    let products: Product[] = [];
    try {
      console.log("🔍 Fetching products via GraphQL...");
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

      const responseJson = (await response.json()) as GraphQLResponse<{
        products: {
          edges: Array<{ node: GraphQLProductNode }>;
        };
      }>;
      console.log("📊 Products GraphQL Response:", responseJson);

      // Check for GraphQL errors
      if (responseJson.errors) {
        console.error("❌ Products GraphQL errors:", responseJson.errors);
        throw new Error(
          `GraphQL query failed: ${responseJson.errors[0]?.message || "Unknown error"}`,
        );
      }

      if (!responseJson.data || !responseJson.data.products) {
        products = [];
      } else {
        products = responseJson.data.products.edges.map((edge) => ({
          id: edge.node.id,
          title: edge.node.title || "Untitled Product",
          handle: edge.node.handle || "",
          status: edge.node.status || "DRAFT",
        }));
      }

      console.log(`✅ Found ${products.length} products via GraphQL`);
    } catch (error) {
      console.error("❌ Error fetching products via GraphQL:", error);
      products = [];
    }

    // Fetch existing rules
    console.log("🔍 Fetching existing rules...");
    const rules = await RuleManager.getRules(session.shop);
    console.log(`✅ Found ${rules.length} existing rules`);

    console.log("📊 Final loader data summary:");
    console.log(`- Discounts: ${discounts.length}`);
    console.log(`- Collections: ${collections.length}`);
    console.log(`- Products: ${products.length}`);
    console.log(`- Rules: ${rules.length}`);

    return data({
      discounts,
      collections,
      products,
      rules,
      shopMode: session.shop,
    });
  } catch (error) {
    console.error("Loader error:", error);
    return data({
      discounts: [],
      collections: [],
      products: [],
      rules: [],
      shopMode: session.shop,
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  console.log("🎯 ACTION triggered:");
  console.log("- Action type:", actionType);

  if (actionType === "saveExclusions") {
    const discountId = formData.get("discountId") as string;
    const excludedCollections = JSON.parse(
      (formData.get("excludedCollections") as string) || "[]",
    );
    const excludedProducts = JSON.parse(
      (formData.get("excludedProducts") as string) || "[]",
    );

    console.log("📥 ACTION received data:");
    console.log("- Discount ID:", discountId);
    console.log("- Excluded collections:", excludedCollections);
    console.log("- Excluded products:", excludedProducts);

    try {
      console.log("💾 Calling RuleManager.upsertRule...");

      // Transform data structure to match RuleManager expectations
      const transformedCollections = excludedCollections.map(
        (col: { id: string; title: string }) => ({
          collectionId: col.id,
          title: col.title,
          productsCount: 0, // We don't have this info, set to 0
        }),
      );

      const transformedProducts = excludedProducts.map(
        (prod: { id: string; title: string }) => ({
          productId: prod.id,
          title: prod.title,
        }),
      );

      console.log("📊 Transformed data:");
      console.log("- Collections:", transformedCollections);
      console.log("- Products:", transformedProducts);

      const result = await RuleManager.upsertRule(session.shop, {
        discountId,
        mode: "exclude",
        excludedCollections: transformedCollections,
        excludedProducts: transformedProducts,
      });

      console.log("✅ RuleManager.upsertRule completed:", result);

      return data({
        success: true,
        message: "Exclusions saved successfully!",
      });
    } catch (error) {
      console.error("❌ RuleManager.upsertRule failed:", error);
      return data({
        success: false,
        message: "Failed to save exclusions. Please try again.",
      });
    }
  }

  return data({
    success: false,
    message: "Invalid action",
  });
};

export default function ConfigureExclusions() {
  const { discounts, collections, products, rules } =
    useLoaderData<LoaderData>();
  const actionData = useActionData<{ success: boolean; message: string }>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const { showResourcePicker } = useShopifyAppBridge();

  // Debug logging per vedere cosa riceve il componente
  console.log("🎨 Component received data:");
  console.log("- Discounts:", discounts?.length || 0, discounts);
  console.log("- Collections:", collections?.length || 0, collections);
  console.log("- Products:", products?.length || 0, products?.slice(0, 3));
  console.log("- Rules:", rules?.length || 0, rules);

  const [selectedDiscountId, setSelectedDiscountId] = useState<string>("");
  const [excludedCollectionIds, setExcludedCollectionIds] = useState<
    Set<string>
  >(new Set());
  const [excludedProductIds, setExcludedProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [showBanner, setShowBanner] = useState(true);
  const [loadingDiscountDetails, setLoadingDiscountDetails] = useState(false);

  // Load existing exclusions when discount is selected
  useEffect(() => {
    if (!selectedDiscountId) {
      setExcludedCollectionIds(new Set());
      setExcludedProductIds(new Set());
      return;
    }

    console.log(`🔍 Loading exclusions for discount: ${selectedDiscountId}`);
    setLoadingDiscountDetails(true);

    // Find existing rule in loaded rules data
    const existingRule = rules.find(
      (rule) => rule.discountId === selectedDiscountId,
    );

    if (existingRule) {
      console.log("✅ Found existing rule:", existingRule);
      setExcludedCollectionIds(
        new Set(existingRule.excludedCollections.map((c) => c.id)),
      );
      setExcludedProductIds(
        new Set(existingRule.excludedProducts.map((p) => p.id)),
      );
      console.log(
        `📋 Loaded ${existingRule.excludedCollections.length} excluded collections and ${existingRule.excludedProducts.length} excluded products`,
      );
    } else {
      console.log("ℹ️ No existing exclusions found for this discount");
      setExcludedCollectionIds(new Set());
      setExcludedProductIds(new Set());
    }

    // Simula un piccolo delay per mostrare il loading
    setTimeout(() => {
      setLoadingDiscountDetails(false);
    }, 300);
  }, [selectedDiscountId, rules]);

  // Handle form submission
  const handleSave = () => {
    if (!selectedDiscountId) return;

    console.log("🔄 Save initiated:");
    console.log("- Selected discount ID:", selectedDiscountId);
    console.log(
      "- Excluded collection IDs:",
      Array.from(excludedCollectionIds),
    );
    console.log("- Excluded product IDs:", Array.from(excludedProductIds));
    console.log("- Available collections:", collections.length);
    console.log("- Available products:", products.length);

    const excludedCollections = collections
      .filter((c) => excludedCollectionIds.has(c.id))
      .map((c) => ({ id: c.id, title: c.title }));

    const excludedProducts = products
      .filter((p) => excludedProductIds.has(p.id))
      .map((p) => ({ id: p.id, title: p.title }));

    console.log("📊 Filtered results:");
    console.log("- Excluded collections found:", excludedCollections);
    console.log("- Excluded products found:", excludedProducts);

    const formData = new FormData();
    formData.append("actionType", "saveExclusions");
    formData.append("discountId", selectedDiscountId);
    formData.append("excludedCollections", JSON.stringify(excludedCollections));
    formData.append("excludedProducts", JSON.stringify(excludedProducts));

    submit(formData, { method: "post" });
  };

  // Handle collection resource picker
  const handleBrowseCollections = async () => {
    try {
      const result = await showResourcePicker("Collection", {
        multiple: true,
      });

      console.log("🔍 Collection picker result:", result);

      if (result && result.selection) {
        console.log("📋 Collection selections:", result.selection);
        const newCollectionIds = new Set(excludedCollectionIds);
        result.selection.forEach((collection: ResourcePickerSelection) => {
          console.log(
            `➕ Adding collection: ${collection.id} (${collection.title})`,
          );
          newCollectionIds.add(collection.id);
        });
        setExcludedCollectionIds(newCollectionIds);
        console.log("✅ Updated collection IDs:", Array.from(newCollectionIds));
      }
    } catch (error) {
      console.error("❌ Error opening collection picker:", error);
    }
  };

  const handleBrowseProducts = async () => {
    try {
      const result = await showResourcePicker("Product", {
        multiple: true,
      });

      console.log("🔍 Product picker result:", result);

      if (result && result.selection) {
        console.log("📋 Product selections:", result.selection);
        const newProductIds = new Set(excludedProductIds);
        result.selection.forEach((product: ResourcePickerSelection) => {
          console.log(`➕ Adding product: ${product.id} (${product.title})`);
          newProductIds.add(product.id);
        });
        setExcludedProductIds(newProductIds);
        console.log("✅ Updated product IDs:", Array.from(newProductIds));
      }
    } catch (error) {
      console.error("❌ Error opening product picker:", error);
    }
  };

  // Remove collection from exclusions
  const handleRemoveCollection = (collectionId: string) => {
    const newSet = new Set(excludedCollectionIds);
    newSet.delete(collectionId);
    setExcludedCollectionIds(newSet);
  };

  // Remove product from exclusions
  const handleRemoveProduct = (productId: string) => {
    const newSet = new Set(excludedProductIds);
    newSet.delete(productId);
    setExcludedProductIds(newSet);
  };

  // Get selected discount info
  const selectedDiscount = discounts.find((d) => d.id === selectedDiscountId);
  const isLoading = navigation.state === "submitting";

  // Discount options for select
  const discountOptions = [
    { label: "Select a discount to configure...", value: "" },
    ...discounts.map((discount) => ({
      label: `${discount.title} (${discount.value_type === "percentage" ? `${discount.value}%` : `$${discount.value}`})`,
      value: discount.id,
    })),
  ];

  if (discounts.length === 0) {
    return (
      <Page
        title="Configure Exclusions"
        backAction={{
          content: "Back to Discounts",
          onAction: () =>
            navigate
              ? navigate("/app/discounts")
              : (window.location.href = "/app/discounts"),
        }}
      >
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="No discount codes found"
              action={{
                content: "Go to Shopify Admin",
                url: "admin/discounts",
                external: true,
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Create discount codes in your Shopify admin, then return here to
                configure exclusion rules for each discount.
              </p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Configure Discount Exclusions"
      subtitle="Create new exclusion rules for your discounts"
      backAction={{
        content: "Back to Discounts",
        onAction: () =>
          navigate
            ? navigate("/app/discounts")
            : (window.location.href = "/app/discounts"),
      }}
    >
      <Layout>
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

        {/* Discount Selection */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                1. Select Discount
              </Text>
              <Text variant="bodyMd" tone="subdued" as="p">
                Choose the discount you want to configure exclusions for.
              </Text>

              <Select
                label=""
                options={discountOptions}
                onChange={setSelectedDiscountId}
                value={selectedDiscountId}
                placeholder="Select a discount..."
              />

              {selectedDiscount && (
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="info">
                    {selectedDiscount.value_type === "percentage"
                      ? `${selectedDiscount.value}% off`
                      : `$${selectedDiscount.value} off`}
                  </Badge>
                  <Text variant="bodySm" tone="subdued" as="span">
                    {selectedDiscount.discount_codes.length} code
                    {selectedDiscount.discount_codes.length !== 1 ? "s" : ""}
                  </Text>
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Exclusions Configuration */}
        {selectedDiscountId && (
          <>
            <Layout.Section>
              <Banner tone="info">
                <p>
                  <strong>How exclusions work:</strong> You can exclude both
                  collections AND individual products simultaneously. The
                  discount will apply to all products except those in excluded
                  collections and individually excluded products. If a product
                  is in both an excluded collection and individually excluded,
                  it&apos;s simply excluded once (no conflicts).
                </p>
              </Banner>
            </Layout.Section>

            {/* Loading state for discount details */}
            {loadingDiscountDetails && (
              <Layout.Section>
                <Banner tone="info">
                  <p>🔄 Loading discount details and existing exclusions...</p>
                </Banner>
              </Layout.Section>
            )}

            <Layout.Section>
              <InlineStack gap="400" align="start">
                {/* Collections */}
                <Card>
                  <BlockStack gap="400">
                    <div>
                      <Text variant="headingMd" as="h3">
                        2. Exclude Collections
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Select collections to exclude from the discount. All
                        products in these collections will be excluded.
                      </Text>
                    </div>

                    <InlineStack gap="200" align="space-between">
                      <div style={{ flex: 1 }}>
                        <TextField
                          label=""
                          value={`${excludedCollectionIds.size} collection${excludedCollectionIds.size !== 1 ? "s" : ""} selected`}
                          readOnly
                          placeholder="No collections selected"
                          autoComplete="off"
                        />
                      </div>
                      <Button
                        onClick={handleBrowseCollections}
                        disabled={loadingDiscountDetails}
                      >
                        Browse
                      </Button>
                    </InlineStack>

                    {excludedCollectionIds.size > 0 && (
                      <div>
                        <Text
                          variant="bodyMd"
                          fontWeight="medium"
                          as="p"
                          tone="subdued"
                        >
                          Selected collections:
                        </Text>
                        <div style={{ marginTop: "8px" }}>
                          <InlineStack gap="200" wrap>
                            {Array.from(excludedCollectionIds).map((id) => {
                              const collection = collections.find(
                                (c) => c.id === id,
                              );
                              return collection ? (
                                <Tag
                                  key={id}
                                  onRemove={() => handleRemoveCollection(id)}
                                >
                                  {collection.title}
                                </Tag>
                              ) : null;
                            })}
                          </InlineStack>
                        </div>
                      </div>
                    )}
                  </BlockStack>
                </Card>

                {/* Products */}
                <Card>
                  <BlockStack gap="400">
                    <div>
                      <Text variant="headingMd" as="h3">
                        3. Exclude Individual Products
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Select individual products to exclude from the discount,
                        even if they&apos;re not in excluded collections.
                      </Text>
                    </div>

                    <InlineStack gap="200" align="space-between">
                      <div style={{ flex: 1 }}>
                        <TextField
                          label=""
                          value={`${excludedProductIds.size} product${excludedProductIds.size !== 1 ? "s" : ""} selected`}
                          readOnly
                          placeholder="No products selected"
                          autoComplete="off"
                        />
                      </div>
                      <Button
                        onClick={handleBrowseProducts}
                        disabled={loadingDiscountDetails}
                      >
                        Browse
                      </Button>
                    </InlineStack>

                    {excludedProductIds.size > 0 && (
                      <div>
                        <Text
                          variant="bodyMd"
                          fontWeight="medium"
                          as="p"
                          tone="subdued"
                        >
                          Selected products:
                        </Text>
                        <div
                          style={{
                            marginTop: "8px",
                            maxHeight: "200px",
                            overflowY: "auto",
                          }}
                        >
                          <InlineStack gap="200" wrap>
                            {Array.from(excludedProductIds).map((id) => {
                              const product = products.find((p) => p.id === id);
                              return product ? (
                                <Tag
                                  key={id}
                                  onRemove={() => handleRemoveProduct(id)}
                                >
                                  {product.title}
                                </Tag>
                              ) : null;
                            })}
                          </InlineStack>
                        </div>
                      </div>
                    )}
                  </BlockStack>
                </Card>
              </InlineStack>
            </Layout.Section>

            {/* Summary and Save */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">
                    4. Review & Save
                  </Text>

                  <InlineStack gap="400">
                    <div>
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        Collections to exclude: {excludedCollectionIds.size}
                      </Text>
                      {excludedCollectionIds.size > 0 && (
                        <BlockStack gap="100">
                          {Array.from(excludedCollectionIds).map((id) => {
                            const collection = collections.find(
                              (c) => c.id === id,
                            );
                            return collection ? (
                              <Text
                                key={id}
                                variant="bodySm"
                                tone="subdued"
                                as="p"
                              >
                                • {collection.title}
                              </Text>
                            ) : null;
                          })}
                        </BlockStack>
                      )}
                    </div>

                    <Divider />

                    <div>
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        Products to exclude: {excludedProductIds.size}
                      </Text>
                      {excludedProductIds.size > 0 && (
                        <BlockStack gap="100">
                          {Array.from(excludedProductIds)
                            .slice(0, 5)
                            .map((id) => {
                              const product = products.find((p) => p.id === id);
                              return product ? (
                                <Text
                                  key={id}
                                  variant="bodySm"
                                  tone="subdued"
                                  as="p"
                                >
                                  • {product.title}
                                </Text>
                              ) : null;
                            })}
                          {excludedProductIds.size > 5 && (
                            <Text variant="bodySm" tone="subdued" as="p">
                              ... and {excludedProductIds.size - 5} more
                            </Text>
                          )}
                        </BlockStack>
                      )}
                    </div>
                  </InlineStack>

                  <InlineStack gap="200">
                    <Button
                      variant="primary"
                      onClick={handleSave}
                      loading={isLoading}
                      disabled={
                        loadingDiscountDetails ||
                        isLoading ||
                        (excludedCollectionIds.size === 0 &&
                          excludedProductIds.size === 0)
                      }
                    >
                      Save Exclusions
                    </Button>
                    <Button
                      onClick={() => {
                        setExcludedCollectionIds(new Set());
                        setExcludedProductIds(new Set());
                      }}
                      disabled={isLoading || loadingDiscountDetails}
                    >
                      Clear All
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  return (
    <Page title="Configure Exclusions">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Something went wrong
              </Text>
              <Text as="p">
                There was an error loading the configuration page. Please try
                refreshing the page.
              </Text>
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
              >
                Refresh Page
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
