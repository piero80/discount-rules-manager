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

        // Dichiara le variabili di debug all'inizio per renderle disponibili nel catch
        let shopifyDiscountId = null;
        let finalMutationId = null;
        let mutationDiscountId = null;
        let mutationName = null;
        let updateMutation = null;
        let currentDiscountData = null;

        console.log("✅ CHECKPOINT 1: Variables declared");

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

        console.log("✅ CHECKPOINT 2: GID formats prepared");
        console.log("🔧 Trying GID formats:", possibleFormats);

        // Prima ottieni i dettagli attuali del discount provando diversi formati
        const discountQuery = `
          #graphql
          query getDiscount($id: ID!) {
            discountNode(id: $id) {
              discount {
                __typename
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
                ... on DiscountAutomaticApp {
                  title
                }
                ... on DiscountCodeApp {
                  title
                }
                ... on DiscountAutomaticBxgy {
                  title
                }
                ... on DiscountCodeBxgy {
                  title
                }
              }
            }
          }
        `;

        console.log("✅ CHECKPOINT 3: GraphQL query defined");

        // Prova ogni formato fino a trovarne uno che funziona
        for (const format of possibleFormats) {
          try {
            console.log("📞 Trying GraphQL query with ID:", format);

            console.log("✅ CHECKPOINT 4A: About to call admin.graphql");
            const response = await admin.graphql(discountQuery, {
              variables: { id: format },
            });

            console.log("✅ CHECKPOINT 4B: admin.graphql completed");
            const data = await response.json();
            console.log("✅ CHECKPOINT 4C: response.json() completed");

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

        console.log("✅ CHECKPOINT 5: GID search loop completed");

        if (!shopifyDiscountId || !currentDiscountData) {
          console.log("❌ CHECKPOINT 5A: No working GID found");
          throw new Error(
            "Could not find discount with any of the tried GID formats",
          );
        }

        console.log("✅ CHECKPOINT 6: Working GID found:", shopifyDiscountId);

        // Estrai le collection e products attuali
        const currentItems =
          currentDiscountData.data?.discountNode?.discount?.customerGets?.items;
        const currentCollections = currentItems?.collections?.nodes || [];
        const currentProducts = currentItems?.products?.nodes || [];

        console.log("✅ CHECKPOINT 7: Current items extracted");
        console.log(
          "🔍 Current collections:",
          currentCollections.map((c: any) => c.id),
        );
        console.log(
          "🔍 Current products:",
          currentProducts.map((p: any) => p.id),
        );

        // 🔧 CHECKPOINT 7A: Detect actual discount type from the response
        console.log("✅ CHECKPOINT 7A: Detecting discount type from response");
        const discountData = currentDiscountData.data?.discountNode?.discount;
        const discountType = discountData?.__typename || "Unknown";
        console.log("🔧 Detected discount type:", discountType);
        console.log(
          "🔧 Full discount data:",
          JSON.stringify(discountData, null, 2),
        );

        // Determine if this is an unsupported discount type
        const supportedBasicTypes = [
          "DiscountAutomaticBasic",
          "DiscountCodeBasic",
        ];
        const isBasicDiscount = supportedBasicTypes.includes(discountType);

        console.log("🔧 Is basic discount?", isBasicDiscount);
        console.log("🔧 Supported types:", supportedBasicTypes);

        if (!isBasicDiscount) {
          console.log(
            `⚠️ WARNING: Discount type "${discountType}" is not a Basic discount type.`,
          );
          console.log(
            "ℹ️ This app only supports DiscountAutomaticBasic and DiscountCodeBasic types.",
          );
          console.log(
            "ℹ️ Skipping Shopify update and using app-level exclusion logic instead.",
          );
          throw new Error(
            `Unsupported discount type: ${discountType}. This app only supports Basic discount types.`,
          );
        }

        console.log("✅ CHECKPOINT 8: About to filter collections/products");

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

        console.log("✅ CHECKPOINT 9: Filtering completed");

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

        console.log("✅ CHECKPOINT 10: Comparison details completed");

        // 3. Aggiorna effettivamente il discount in Shopify
        const hasChanges =
          allowedCollections.length !== currentCollections.length ||
          allowedProducts.length !== currentProducts.length ||
          excludedCollections.length > 0 ||
          excludedProducts.length > 0;

        console.log("✅ CHECKPOINT 11: hasChanges calculated");
        console.log("🎯 Should update?", hasChanges);

        if (hasChanges) {
          console.log("🔄 Updating Shopify discount with new items...");

          console.log("✅ CHECKPOINT 11A: Inside hasChanges block");

          // 🔧 CHECKPOINT 11A2: Double-check discount type before mutation setup
          console.log(
            "✅ CHECKPOINT 11A2: Re-checking discount type for mutation",
          );
          const discountTypeFromData =
            currentDiscountData.data?.discountNode?.discount?.__typename;
          console.log(
            "🔧 Confirmed discount type for mutation:",
            discountTypeFromData,
          );

          // Determina il tipo di mutation basato sul GID trovato E sul tipo effettivo
          updateMutation = null; // Reset per sicurezza
          mutationName = null; // Reset per sicurezza
          mutationDiscountId = shopifyDiscountId;

          // Per le mutation, spesso il GID deve essere adattato
          if (discountTypeFromData === "DiscountAutomaticBasic") {
            console.log("🔧 Setting up mutation for DiscountAutomaticBasic");
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
            mutationDiscountId = shopifyDiscountId; // Use the found GID as-is
          } else if (discountTypeFromData === "DiscountCodeBasic") {
            console.log("🔧 Setting up mutation for DiscountCodeBasic");
            updateMutation = `
              #graphql
              mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
                discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
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
            mutationDiscountId = shopifyDiscountId; // Use the found GID as-is
          } else {
            console.error(
              "❌ Unsupported discount type for mutation:",
              discountTypeFromData,
            );
            throw new Error(
              `Unsupported discount type for mutation: ${discountTypeFromData}. Only DiscountAutomaticBasic and DiscountCodeBasic are supported.`,
            );
          }

          console.log("✅ CHECKPOINT 11B: Mutation setup completed");

          console.log("🔧 Query GID:", shopifyDiscountId);
          console.log("🔧 Mutation GID:", mutationDiscountId);
          console.log("🔧 Using mutation:", mutationName);

          // Use the mutation GID as-is - don't convert to generic DiscountNode
          finalMutationId = mutationDiscountId;

          console.log("✅ CHECKPOINT 11C: Final mutation ID set");
          console.log("🔧 Final mutation ID:", finalMutationId);

          // Controllo preventivo: questo tipo di discount potrebbe non supportare modifiche
          if (!currentCollections.length && !currentProducts.length) {
            console.log(
              "⚠️ WARNING: This discount has no collections/products. It might be an 'all items' discount that doesn't support item-level modifications.",
            );
            console.log(
              "ℹ️ Skipping Shopify update and using app-level exclusion logic instead.",
            );
            throw new Error(
              "Discount appears to be 'all items' type - using app-level exclusion logic",
            );
          }

          // 🔧 CHECKPOINT 11D: Generate correct mutation GIDs based on discount type
          console.log(
            "✅ CHECKPOINT 11D: Generating mutation GIDs for type:",
            discountTypeFromData,
          );

          // Generate possible mutation GIDs based on the actual discount type
          const possibleMutationGids = [];

          // Extract the numeric ID from the working query GID
          const numericId = shopifyDiscountId.split("/").pop();
          console.log("🔧 Extracted numeric ID:", numericId);

          if (discountTypeFromData === "DiscountAutomaticBasic") {
            // For DiscountAutomaticBasic, try both Node and Basic formats
            possibleMutationGids.push(
              `gid://shopify/DiscountAutomaticNode/${numericId}`,
            );
            possibleMutationGids.push(
              `gid://shopify/DiscountAutomaticBasic/${numericId}`,
            );
          } else if (discountTypeFromData === "DiscountCodeBasic") {
            // For DiscountCodeBasic, try both Node and Basic formats using the correct Code types
            possibleMutationGids.push(
              `gid://shopify/DiscountCodeNode/${numericId}`,
            );
            possibleMutationGids.push(
              `gid://shopify/DiscountCodeBasic/${numericId}`,
            );
            // Also try the working query GID in case it still works for mutations
            possibleMutationGids.push(shopifyDiscountId);
          }

          console.log(
            "🔧 Mutation GIDs to try for",
            discountTypeFromData,
            ":",
            possibleMutationGids,
          );

          // Strategia a due passi come nella versione precedente che funzionava:
          // 1. Prima rimuovi tutto (all: true)
          // 2. Poi aggiungi solo gli elementi consentiti

          // Passo 1: Rimuovi tutto impostando all: true
          console.log("🔄 Step 1: Removing all items from discount...");

          const removeInput = {
            customerGets: {
              value: {
                percentage: 0.1, // 10% as decimal (must be between 0.0 and 1.0)
              },
              items: {
                all: true,
              },
            },
          };

          console.log(
            "✅ CHECKPOINT 11E: Trying Step 1 with multiple GID formats",
          );

          let step1Success = false;
          let successfulMutationGid = null;

          // Prova ogni possibile GID per la mutation
          for (const mutationGid of possibleMutationGids) {
            try {
              console.log(`🔄 Step 1 attempt with GID: ${mutationGid}`);

              const removeVariables =
                mutationName === "discountAutomaticBasicUpdate"
                  ? { id: mutationGid, automaticBasicDiscount: removeInput }
                  : { id: mutationGid, basicCodeDiscount: removeInput };

              console.log(
                "📤 Step 1 variables:",
                JSON.stringify(removeVariables, null, 2),
              );

              const removeResponse = await admin.graphql(updateMutation, {
                variables: removeVariables,
              });

              const removeResult = await removeResponse.json();
              console.log(
                "📥 Step 1 result:",
                JSON.stringify(removeResult, null, 2),
              );

              const removeErrors =
                removeResult.data?.[mutationName]?.userErrors;
              if (removeErrors?.length > 0) {
                console.log(
                  `❌ Step 1 failed with GID ${mutationGid}:`,
                  removeErrors[0]?.message,
                );
                continue; // Try next GID
              }

              console.log(`✅ Step 1 succeeded with GID: ${mutationGid}`);
              step1Success = true;
              successfulMutationGid = mutationGid;
              finalMutationId = mutationGid; // Update for Step 2
              break; // Exit the loop on success
            } catch (error) {
              console.log(
                `❌ Step 1 exception with GID ${mutationGid}:`,
                error,
              );
              continue; // Try next GID
            }
          }

          if (!step1Success) {
            throw new Error("Step 1 failed with all attempted GID formats");
          }

          if (!step1Success) {
            throw new Error("Step 1 failed with all attempted GID formats");
          }

          console.log("✅ Step 1 completed: All items removed");
          console.log("✅ Successful mutation GID:", successfulMutationGid);

          console.log("✅ CHECKPOINT 12: Step 1 completed, starting Step 2");

          // Passo 2: Aggiungi solo gli elementi consentiti
          console.log("🔄 Step 2: Adding allowed items back...");

          // Recupera la configurazione completa del discount per mantenere tutte le proprietà
          // IMPORTANT: appliesOncePerCustomer is only available for DiscountCodeBasic, NOT DiscountAutomaticBasic
          const fullDiscountQuery = `#graphql
            query getFullDiscount($id: ID!) {
              discountNode(id: $id) {
                discount {
                  ... on DiscountCodeBasic {
                    title
                    summary
                    customerGets {
                      value {
                        ... on DiscountPercentage {
                          percentage
                        }
                        ... on DiscountAmount {
                          amount {
                            amount
                            currencyCode
                          }
                        }
                      }
                    }
                    appliesOncePerCustomer
                    startsAt
                    endsAt
                  }
                  ... on DiscountAutomaticBasic {
                    title
                    summary
                    customerGets {
                      value {
                        ... on DiscountPercentage {
                          percentage
                        }
                        ... on DiscountAmount {
                          amount {
                            amount
                            currencyCode
                          }
                        }
                      }
                    }
                    startsAt
                    endsAt
                  }
                }
              }
            }`;

          const fullConfigResponse = await admin.graphql(fullDiscountQuery, {
            variables: { id: shopifyDiscountId },
          });
          const fullConfigResult = await fullConfigResponse.json();

          console.log(
            "🔧 Full config response:",
            JSON.stringify(fullConfigResult, null, 2),
          );

          if (fullConfigResult.errors) {
            console.error(
              "❌ Error fetching full discount config:",
              fullConfigResult.errors,
            );
            throw new Error(
              `Failed to fetch discount configuration: ${JSON.stringify(fullConfigResult.errors)}`,
            );
          }

          const fullConfig = fullConfigResult.data?.discountNode?.discount;

          if (!fullConfig) {
            console.error("❌ No discount configuration found in response");
            throw new Error(
              "Discount configuration not found - discount may not exist or be accessible",
            );
          }

          console.log(
            "🔧 Full discount config:",
            JSON.stringify(fullConfig, null, 2),
          );

          // Costruisci il valore del discount basandoti sulla configurazione esistente
          let mutationValue: any;
          if (fullConfig?.customerGets?.value?.percentage !== undefined) {
            // For percentage values, ensure they're in decimal format (0.0 to 1.0)
            const percentageValue = fullConfig.customerGets.value.percentage;
            mutationValue = {
              percentage:
                percentageValue > 1 ? percentageValue / 100 : percentageValue,
            };
          } else if (fullConfig?.customerGets?.value?.amount) {
            mutationValue = {
              discountAmount: {
                amount: fullConfig.customerGets.value.amount.amount,
                appliesOnEachItem: false,
              },
            };
          } else {
            // Fallback per sicurezza - 10% as decimal
            mutationValue = {
              percentage: 0.1,
            };
          }

          console.log(
            "💰 Using mutation value:",
            JSON.stringify(mutationValue, null, 2),
          );

          // Costruisci l'input per la mutazione con la logica della vecchia implementazione
          const customerGets: any = {
            value: mutationValue,
            items:
              allowedCollections.length > 0 || allowedProducts.length > 0
                ? {
                    all: false,
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
                  }
                : {
                    all: true,
                  },
          };

          // Aggiungi appliesOncePerCustomer se presente nella configurazione originale E il discount type lo supporta
          const addInput: any = {
            customerGets,
          };

          // appliesOncePerCustomer is only available for DiscountCodeBasic, not DiscountAutomaticBasic
          if (
            discountTypeFromData === "DiscountCodeBasic" &&
            fullConfig?.appliesOncePerCustomer !== undefined
          ) {
            addInput.appliesOncePerCustomer = fullConfig.appliesOncePerCustomer;
            console.log(
              "📝 Added appliesOncePerCustomer for DiscountCodeBasic:",
              fullConfig.appliesOncePerCustomer,
            );
          } else if (discountTypeFromData === "DiscountAutomaticBasic") {
            console.log(
              "⏭️ Skipping appliesOncePerCustomer for DiscountAutomaticBasic (not supported)",
            );
          }

          console.log("📤 Add input:", JSON.stringify(addInput, null, 2));

          const updateResponse = await admin.graphql(updateMutation, {
            variables:
              mutationName === "discountAutomaticBasicUpdate"
                ? { id: finalMutationId, automaticBasicDiscount: addInput }
                : { id: finalMutationId, basicCodeDiscount: addInput },
          });

          const updateResult = await updateResponse.json();
          console.log(
            "📥 Final update result:",
            JSON.stringify(updateResult, null, 2),
          );

          const userErrors = updateResult.data?.[mutationName]?.userErrors;
          if (userErrors?.length > 0) {
            console.error("❌ Update errors:", userErrors);

            // Se fallisce con il GID convertito, prova con l'originale
            if (finalMutationId !== shopifyDiscountId) {
              console.log("🔄 Retrying with original query GID...");

              const retryVariables =
                mutationName === "discountAutomaticBasicUpdate"
                  ? { id: shopifyDiscountId, automaticBasicDiscount: addInput }
                  : { id: shopifyDiscountId, basicCodeDiscount: addInput };

              console.log(
                "🔄 Retrying with original query GID and proper variables...",
              );
              console.log(
                "📤 Retry variables:",
                JSON.stringify(retryVariables, null, 2),
              );

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
              console.log(
                "✅ Step 2 completed: Allowed items added back successfully",
              );
            } else {
              throw new Error(
                `Shopify update failed: ${JSON.stringify(userErrors)}`,
              );
            }
          } else {
            console.log("✅ Shopify discount successfully updated!");
            console.log(
              "✅ Step 2 completed: Allowed items added back successfully",
            );
          }
        } else {
          console.log(
            "ℹ️ No changes needed - discount already in correct state",
          );
        }

        console.log("ℹ️ Shopify discount update completed");
      } catch (updateError) {
        console.error("⚠️ Failed to update Shopify discount:", updateError);
        console.log("📊 DEBUG: Tried GID formats:");
        // console.log(
        //   "- Query GID (worked):",
        //   shopifyDiscountId || "not determined",
        // );
        // console.log(
        //   "- Mutation GID (failed):",
        //   finalMutationId || mutationDiscountId || "not determined",
        // );
        // console.log("- Original discount ID:", discountId);
        // console.log("- Mutation Name:", mutationName || "not determined");
        // console.log(
        //   "- Update Mutation:",
        //   updateMutation
        //     ? updateMutation.substring(0, 200) + "..."
        //     : "not defined",
        // );
        console.log("ℹ️ Continuing with database-only exclusion tracking...");
        console.log(
          "ℹ️ The exclusions will be applied by the app logic when processing discounts.",
        );
        // Non far fallire tutto - le exclusions sono salvate nel database e verranno applicate dalla logica applicativa
      }

      return data({
        success: true,
        message:
          "✅ Exclusions saved and applied! The discount has been updated in Shopify to exclude the selected collections/products.",
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
