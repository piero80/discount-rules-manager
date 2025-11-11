import { discountRuleHelpers } from "./db.server";

// Types - Using flexible type for Shopify admin
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminType = any;

// Legacy PriceRule interface - non più utilizzata
// interface PriceRule { ... }

interface CollectionEdge {
  node: {
    id: string;
    title: string;
  };
}

interface GraphQLResponse {
  data: {
    collections: {
      edges: CollectionEdge[];
    };
  };
}

// Interfaces per legacy price rules - non più utilizzate nelle moderne API
// interface PriceRulesResponse { ... }
// interface DiscountCodesResponse { ... }

// Helper: Estrai numeric ID da Shopify GID
function extractNumericId(gid: string): string {
  // "gid://shopify/Collection/123456789" -> "123456789"
  return gid.split("/").pop() || "";
}

// Helper: Converte numeric ID in Shopify GID
function createCollectionGid(numericId: string): string {
  return `gid://shopify/Collection/${numericId}`;
}

/**
 * Applica le mutation GraphQL per aggiornare un discount con le collezioni
 */
async function applyDiscountMutation(
  admin: AdminType,
  discount: { id: string; title: string; type: string; gid?: string },
  entitledCollectionIds: string[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  allCollections: Array<{ id: string; title: string }>,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use the full GID if available, otherwise construct it
    const discountGid =
      discount.gid || `gid://shopify/DiscountNode/${discount.id}`;
    const collectionGids = entitledCollectionIds.map((id) =>
      createCollectionGid(id),
    );

    // Determina il tipo di mutation basandosi sul tipo di discount
    switch (discount.type) {
      case "DiscountCodeBasic":
        return await updateDiscountCodeBasic(
          admin,
          discountGid,
          collectionGids,
        );

      case "DiscountAutomaticBasic":
        return await updateDiscountAutomaticBasic(
          admin,
          discountGid,
          collectionGids,
        );

      case "DiscountCodeBxgy":
      case "DiscountAutomaticBxgy":
        return {
          success: false,
          error:
            "BXGY discounts use different collection logic (customerBuys vs customerGets). Not compatible with simple collection exclusion rules.",
        };

      case "DiscountCodeFreeShipping":
      case "DiscountAutomaticFreeShipping":
        return {
          success: false,
          error: "Free shipping discounts don't use collection restrictions",
        };

      default:
        return {
          success: false,
          error: `Unsupported discount type: ${discount.type}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Recupera le collezioni attualmente applicate a un discount
 */
async function getCurrentDiscountCollections(
  admin: AdminType,
  discountId: string,
): Promise<string[]> {
  try {
    // console.log(
    //   "🔍 DEBUG: Getting current collections for discount:",
    //   discountId,
    // );

    // Convert DiscountCodeNode/DiscountAutomaticNode to DiscountNode for queries
    let queryDiscountId = discountId;
    if (discountId.includes("DiscountCodeNode")) {
      queryDiscountId = discountId.replace("DiscountCodeNode", "DiscountNode");
    } else if (discountId.includes("DiscountAutomaticNode")) {
      queryDiscountId = discountId.replace(
        "DiscountAutomaticNode",
        "DiscountNode",
      );
    }

    // console.log("🔍 DEBUG: Using query ID:", queryDiscountId);

    const query = `#graphql
      query getDiscount($id: ID!) {
        discountNode(id: $id) {
          id
          discount {
            __typename
            ... on DiscountCodeBasic {
              title
              customerGets {
                __typename
                items {
                  __typename
                  ... on DiscountCollections {
                    collections(first: 250) {
                      nodes {
                        id
                        title
                      }
                    }
                  }
                  ... on DiscountProducts {
                    products(first: 10) {
                      nodes {
                        id
                        title
                      }
                    }
                  }
                }
              }
            }
            ... on DiscountAutomaticBasic {
              title
              customerGets {
                __typename
                items {
                  __typename
                  ... on DiscountCollections {
                    collections(first: 250) {
                      nodes {
                        id
                        title
                      }
                    }
                  }
                  ... on DiscountProducts {
                    products(first: 10) {
                      nodes {
                        id
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`;

    const response = await admin.graphql(query, {
      variables: { id: queryDiscountId },
    });
    const result = await response.json();

    // console.log(
    //   "📊 DEBUG: Full discount query response:",
    //   JSON.stringify(result, null, 2),
    // );

    if (result.errors) {
      return [];
    }

    const discountNode = result.data?.discountNode;
    if (!discountNode) {
      return [];
    }

    // console.log("🔍 DEBUG: Discount node found:", discountNode.id);
    // console.log("🔍 DEBUG: Discount type:", discountNode.discount?.__typename);

    const customerGets = discountNode.discount?.customerGets;
    if (!customerGets) {
      // console.log("⚠️ DEBUG: No customerGets found");
      return [];
    }

    // console.log(
    //   "🔍 DEBUG: CustomerGets structure:",
    //   JSON.stringify(customerGets, null, 2),
    // );

    // Handle different customerGets structures
    let collections: Array<{ id: string; title?: string }> = [];

    if (Array.isArray(customerGets.items)) {
      // Multiple items in array
      // console.log(
      //   "🔍 DEBUG: CustomerGets.items is array with length:",
      //   customerGets.items.length,
      // );
      for (const item of customerGets.items) {
        // console.log(
        //   "🔍 DEBUG: Processing item:",
        //   JSON.stringify(item, null, 2),
        // );
        if (
          item.__typename === "DiscountCollections" &&
          item.collections?.nodes
        ) {
          collections.push(...item.collections.nodes);
        }
      }
    } else if (customerGets.items?.collections?.nodes) {
      // Single collections item
      // console.log("🔍 DEBUG: CustomerGets.items has collections directly");
      collections = customerGets.items.collections.nodes;
    }

    // console.log(
    //   "🔍 DEBUG: Found collections:",
    //   collections.map((c) => `${c.id} (${c.title})`),
    // );
    return collections.map((col: { id: string }) => col.id);
  } catch (error) {
    // Error getting current discount collections
    return [];
  }
}

/**
 * Rimuove collezioni specifiche da un discount
 */
async function removeCollectionsFromDiscount(
  admin: AdminType,
  discountId: string,
  collectionGids: string[],
  discountType: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // console.log("🗑️ DEBUG: Starting removeCollectionsFromDiscount");
    // console.log("🗑️ DEBUG: Discount ID:", discountId);
    // console.log("🗑️ DEBUG: Discount Type:", discountType);
    // console.log("🗑️ DEBUG: Collections to remove:", collectionGids);

    const mutation =
      discountType === "DiscountCodeBasic"
        ? `#graphql
        mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
            userErrors {
              field
              message
            }
            codeDiscountNode {
              id
              codeDiscount {
                ... on DiscountCodeBasic {
                  customerGets {
                    items {
                      ... on DiscountCollections {
                        collections(first: 250) {
                          nodes {
                            id
                            title
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`
        : `#graphql
        mutation discountAutomaticBasicUpdate($id: ID!, $automaticBasicDiscount: DiscountAutomaticBasicInput!) {
          discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $automaticBasicDiscount) {
            userErrors {
              field
              message
            }
            automaticDiscountNode {
              id
              automaticDiscount {
                ... on DiscountAutomaticBasic {
                  customerGets {
                    items {
                      ... on DiscountCollections {
                        collections(first: 250) {
                          nodes {
                            id
                            title
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`;

    const variableKey =
      discountType === "DiscountCodeBasic"
        ? "basicCodeDiscount"
        : "automaticBasicDiscount";

    // Get the current discount config to determine the correct value structure
    const fullConfig = await getFullDiscountConfig(admin, discountId);
    if (!fullConfig) {
      return {
        success: false,
        error: "Could not retrieve discount configuration for removal",
      };
    }

    // Convert value structure for mutation (same logic as replaceDiscountCollections)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullConfigAny = fullConfig as any;
    let mutationValue: Record<string, unknown>;
    if (fullConfigAny.customerGets.value.percentage !== undefined) {
      mutationValue = {
        percentage: fullConfigAny.customerGets.value.percentage,
      };
    } else if (fullConfigAny.customerGets.value.amount) {
      mutationValue = {
        discountAmount: {
          amount: fullConfigAny.customerGets.value.amount.amount,
          appliesOnEachItem: false, // Default value
        },
      };
    } else {
      // Fallback to 10% if we can't determine the discount structure
      mutationValue = {
        percentage: 10,
      };
    }

    const variables = {
      id: discountId,
      [variableKey]: {
        customerGets: {
          value: mutationValue,
          items: {
            all: true, // Set to true to clear all collections
          },
        },
      },
    };

    // console.log("🗑️ DEBUG: Mutation being executed:");
    // console.log(mutation);
    // console.log("🗑️ DEBUG: Variables being sent:");
    // console.log(JSON.stringify(variables, null, 2));

    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();

    // console.log("📊 DEBUG: Complete remove result:");
    // console.log(JSON.stringify(result, null, 2));

    if (result.errors) {
      console.error("❌ DEBUG: GraphQL errors in remove:", result.errors);
      return {
        success: false,
        error: result.errors
          .map((err: { message: string }) => err.message)
          .join(", "),
      };
    }

    const mutationKey =
      discountType === "DiscountCodeBasic"
        ? "discountCodeBasicUpdate"
        : "discountAutomaticBasicUpdate";

    // console.log("🔍 DEBUG: Checking for userErrors in key:", mutationKey);

    if (result.data?.[mutationKey]?.userErrors?.length > 0) {
      console.error(
        "❌ DEBUG: User errors in remove:",
        result.data[mutationKey].userErrors,
      );
      return {
        success: false,
        error: result.data[mutationKey].userErrors
          .map((err: { message: string }) => err.message)
          .join(", "),
      };
    }

    // console.log("✅ DEBUG: Remove operation completed successfully");
    return { success: true };
  } catch (error) {
    console.error(
      "❌ DEBUG: Exception in removeCollectionsFromDiscount:",
      error,
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Recupera la configurazione completa del discount
 */
async function getFullDiscountConfig(
  admin: AdminType,
  discountId: string,
): Promise<Record<string, unknown> | null> {
  try {
    // Convert to DiscountNode for query
    let queryId = discountId;
    if (discountId.includes("DiscountCodeNode")) {
      queryId = discountId.replace("DiscountCodeNode", "DiscountNode");
    } else if (discountId.includes("DiscountAutomaticNode")) {
      queryId = discountId.replace("DiscountAutomaticNode", "DiscountNode");
    }

    const query = `#graphql
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
              usageLimit
              appliesOncePerCustomer
              startsAt
              endsAt
            }
          }
        }
      }`;

    const response = await admin.graphql(query, { variables: { id: queryId } });
    const result = await response.json();

    // console.log(
    //   "🔍 DEBUG: Full discount config:",
    //   JSON.stringify(result, null, 2),
    // );

    return result.data?.discountNode?.discount || null;
  } catch (error) {
    console.error("❌ Error getting full discount config:", error);
    return null;
  }
}

/**
 * Aggiorna il discount con la configurazione completa mantenendo tutto tranne le collezioni
 */
async function replaceDiscountCollections(
  admin: AdminType,
  discountId: string,
  collectionGids: string[],
  discountType: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // console.log("🔄 DEBUG: Getting full discount config first");
    const fullConfig = await getFullDiscountConfig(admin, discountId);

    if (!fullConfig) {
      return {
        success: false,
        error: "Could not retrieve full discount configuration",
      };
    }

    const currentCollectionsToReplace = await getCurrentDiscountCollections(
      admin,
      discountId,
    );
    // console.log("📊 DEBUG: Current collections:", currentCollectionsToReplace);
    // console.log("🔄 DEBUG: Building complete update with new collections");

    const mutation =
      discountType === "DiscountCodeBasic"
        ? `#graphql
        mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
            userErrors {
              field
              message
            }
          }
        }`
        : `#graphql
        mutation discountAutomaticBasicUpdate($id: ID!, $automaticBasicDiscount: DiscountAutomaticBasicInput!) {
          discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $automaticBasicDiscount) {
            userErrors {
              field
              message
            }
          }
        }`;

    const variableKey =
      discountType === "DiscountCodeBasic"
        ? "basicCodeDiscount"
        : "automaticBasicDiscount";

    // Build complete customerGets structure from existing config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullConfigAny = fullConfig as any;

    // Convert value structure for mutation (different from query structure)
    let mutationValue: Record<string, unknown>;
    if (fullConfigAny.customerGets.value.percentage !== undefined) {
      mutationValue = {
        percentage: fullConfigAny.customerGets.value.percentage,
      };
    } else if (fullConfigAny.customerGets.value.amount) {
      mutationValue = {
        discountAmount: {
          amount: fullConfigAny.customerGets.value.amount.amount,
          appliesOnEachItem: false, // Default value
        },
      };
    } else {
      // Fallback to 10% if we can't determine the discount structure
      mutationValue = {
        percentage: 10,
      };
    }

    const customerGets: Record<string, unknown> = {
      value: mutationValue,
      items:
        collectionGids.length > 0
          ? {
              all: false, // Only set all to false when we have collections to add
              collections: {
                add: collectionGids, // Only use add to set collections (after removing in separate step)
              },
            }
          : {
              all: true, // If no collections to add, set all to true to clear everything
            },
    };

    // Step 1: Remove existing collections first
    // const currentCollections =
    //   fullConfigAny.customerGets?.items?.collections?.nodes || [];
    if (currentCollectionsToReplace.length > 0) {
      // console.log("🗑️ DEBUG: Removing existing collections first");

      const removeVariables = {
        id: discountId,
        [variableKey]: {
          customerGets: {
            value: mutationValue, // Use converted value structure, not original
            items: {
              all: true, // Set all to true to clear all collections - simpler approach
            },
          },
        },
      };

      // console.log(
      //   "🗑️ DEBUG: Remove variables:",
      //   JSON.stringify(removeVariables, null, 2),
      // );

      const removeResponse = await admin.graphql(mutation, {
        variables: removeVariables,
      });
      const removeResult = await removeResponse.json();

      // console.log(
      //   "📊 DEBUG: Remove result:",
      //   JSON.stringify(removeResult, null, 2),
      // );

      // Check for errors but continue anyway - sometimes remove fails but add works
      if (removeResult.errors) {
        console.log("⚠️ WARNING: Remove failed, continuing with add...");
      }
    }

    // Step 2: Add new collections
    // console.log("➕ DEBUG: Adding new collections");

    // Build the discount variables with correct structure
    const discountVariables: Record<string, unknown> = {
      customerGets,
    };

    // Add appliesOncePerCustomer at the discount level, not in customerGets
    if (fullConfigAny.appliesOncePerCustomer !== undefined) {
      discountVariables.appliesOncePerCustomer =
        fullConfigAny.appliesOncePerCustomer;
    }

    const variables = {
      id: discountId,
      [variableKey]: discountVariables,
    };

    // console.log(
    //   "🔄 Setting collections with complete customerGets structure:",
    //   JSON.stringify(variables, null, 2),
    // );

    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();

    // console.log("📊 Set collections result:", JSON.stringify(result, null, 2));

    if (result.errors) {
      return {
        success: false,
        error: result.errors
          .map((err: { message: string }) => err.message)
          .join(", "),
      };
    }

    const mutationKey =
      discountType === "DiscountCodeBasic"
        ? "discountCodeBasicUpdate"
        : "discountAutomaticBasicUpdate";
    if (result.data?.[mutationKey]?.userErrors?.length > 0) {
      return {
        success: false,
        error: result.data[mutationKey].userErrors
          .map((err: { message: string }) => err.message)
          .join(", "),
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error setting collections for discount:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ispeziona lo schema GraphQL per la mutation DiscountCodeBasicUpdate
 */
async function inspectDiscountMutationSchema(admin: AdminType) {
  try {
    const introspectionQuery = `#graphql
      query {
        __type(name: "DiscountCodeBasicUpdatePayload") {
          name
          fields {
            name
            type {
              name
              kind
              ofType {
                name
              }
            }
          }
        }
      }`;

    // console.log("🔍 Inspecting DiscountCodeBasicUpdatePayload schema...");
    const response = await admin.graphql(introspectionQuery);
    const result = await response.json();
    // console.log(
    //   "📊 Schema inspection result:",
    //   JSON.stringify(result, null, 2),
    // );
    return result;
  } catch (error) {
    console.error("Error inspecting schema:", error);
    return null;
  }
}

/**
 * Funzione di debug per testare step-by-step il processo di update delle collezioni
 */
export async function debugDiscountCollectionUpdate(
  admin: AdminType,
  discountId: string,
  discountType: string,
): Promise<{ success: boolean; details: Record<string, unknown> }> {
  console.log("=".repeat(80));
  console.log("🐛🐛🐛 SERVER DEBUG SESSION STARTED 🐛🐛🐛");
  console.log("🐛 DEBUG: Discount ID:", discountId);
  console.log("🐛 DEBUG: Discount Type:", discountType);
  console.log("=".repeat(80));

  const details: Record<string, unknown> = {
    initialCollections: [],
    removeAttempt: null,
    addAttempt: null,
    finalCollections: [],
  };

  try {
    // Step 1: Get initial state
    console.log("🔍 DEBUG Step 1: Getting initial collections");
    const initialCollections = await getCurrentDiscountCollections(
      admin,
      discountId,
    );
    details.initialCollections = initialCollections;
    console.log("📊 DEBUG: Initial collections found:", initialCollections);

    // Step 2: Try to remove one collection if any exist
    if (initialCollections.length > 0) {
      console.log("🗑️ DEBUG Step 2: Attempting to remove first collection");
      const collectionToRemove = [initialCollections[0]];
      const removeResult = await removeCollectionsFromDiscount(
        admin,
        discountId,
        collectionToRemove,
        discountType,
      );
      details.removeAttempt = {
        collections: collectionToRemove,
        result: removeResult,
      };
      console.log("📊 DEBUG: Remove attempt result:", removeResult);

      // Step 3: Check state after remove
      console.log("🔍 DEBUG Step 3: Getting collections after remove attempt");
      const afterRemoveCollections = await getCurrentDiscountCollections(
        admin,
        discountId,
      );
      details.afterRemove = afterRemoveCollections;
      console.log(
        "📊 DEBUG: Collections after remove:",
        afterRemoveCollections,
      );
    }

    // Step 4: Try to replace collections completely
    console.log(
      "🔄 DEBUG Step 4: Attempting to replace collections completely",
    );
    const testCollectionGids = ["gid://shopify/Collection/351475990677"]; // Use the existing collection
    const addResult = await replaceDiscountCollections(
      admin,
      discountId,
      testCollectionGids,
      discountType,
    );
    details.addAttempt = { collections: testCollectionGids, result: addResult };
    console.log("📊 DEBUG: Add attempt result:", addResult);

    // Step 5: Final state
    console.log("🔍 DEBUG Step 5: Getting final collections");
    const finalCollections = await getCurrentDiscountCollections(
      admin,
      discountId,
    );
    details.finalCollections = finalCollections;
    console.log("📊 DEBUG: Final collections:", finalCollections);

    return { success: true, details };
  } catch (error) {
    console.error("❌ DEBUG: Error in debug session:", error);
    details.error = error;
    return { success: false, details };
  }
}

/**
 * Aggiorna un DiscountCodeBasic con le collezioni specificate
 * Implementa un approccio in due fasi: rimuovi tutte + aggiungi quelle desiderate
 */
async function updateDiscountCodeBasic(
  admin: AdminType,
  discountId: string,
  collectionGids: string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    // Primo: ispeziona lo schema per capire i campi disponibili
    await inspectDiscountMutationSchema(admin);

    // Fase 1: Recupera le collezioni attuali del discount
    const currentCollections = await getCurrentDiscountCollections(
      admin,
      discountId,
    );
    console.log("📊 DEBUG: Current collections:", currentCollections);
    console.log("🔄 DEBUG: Target collections to set:", collectionGids);

    if (collectionGids.length === 0) {
      console.log(
        "⚠️ DEBUG: No target collections - will exclude ALL collections (items: { all: true })",
      );
    } else {
      console.log(
        `✅ DEBUG: Will set ${collectionGids.length} specific collections`,
      );
    }
    // Fase 2: Se ci sono collezioni esistenti, rimuovile prima
    if (currentCollections.length > 0) {
      console.log("�️ Removing existing collections:", currentCollections);
      const removeResult = await removeCollectionsFromDiscount(
        admin,
        discountId,
        currentCollections,
        "DiscountCodeBasic",
      );
      if (!removeResult.success) {
        console.log(
          "❌ Failed to remove existing collections, proceeding anyway...",
        );
      }
    }

    // Fase 3: Sostituisci completamente le collezioni
    console.log("🔄 Replacing collections completely:", collectionGids);
    return await replaceDiscountCollections(
      admin,
      discountId,
      collectionGids,
      "DiscountCodeBasic",
    );
  } catch (error) {
    console.error("Error updating DiscountCodeBasic:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Aggiorna un DiscountAutomaticBasic con le collezioni specificate
 * Implementa un approccio in due fasi: rimuovi tutte + aggiungi quelle desiderate
 */
async function updateDiscountAutomaticBasic(
  admin: AdminType,
  discountId: string,
  collectionGids: string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fase 1: Recupera le collezioni attuali del discount
    const currentCollections = await getCurrentDiscountCollections(
      admin,
      discountId,
    );

    // Fase 2: Se ci sono collezioni esistenti, rimuovile prima
    if (currentCollections.length > 0) {
      console.log("🗑️ Removing existing collections:", currentCollections);
      const removeResult = await removeCollectionsFromDiscount(
        admin,
        discountId,
        currentCollections,
        "DiscountAutomaticBasic",
      );
      if (!removeResult.success) {
        console.log(
          "❌ Failed to remove existing collections, proceeding anyway...",
        );
      }
    }

    // Fase 3: Sostituisci completamente le collezioni
    console.log("🔄 Replacing collections completely:", collectionGids);
    return await replaceDiscountCollections(
      admin,
      discountId,
      collectionGids,
      "DiscountAutomaticBasic",
    );

    return { success: true };
  } catch (error) {
    console.error("Error updating DiscountAutomaticBasic:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch tutte le collections dello shop
 */
export async function getAllCollections(admin: AdminType) {
  const response = await admin.graphql(
    `#graphql
      query {
        collections(first: 250) {
          edges {
            node {
              id
              title
            }
          }
        }
      }`,
  );

  const data = (await response.json()) as unknown as GraphQLResponse;
  return data.data.collections.edges.map((edge: CollectionEdge) => ({
    id: edge.node.id,
    title: edge.node.title,
  }));
}

/**
 * Calcola quali collections devono essere incluse nel discount
 * basandosi sulle regole di inclusione/esclusione
 */
export async function getEntitledCollections(
  shop: string,
  allCollections: Array<{ id: string; title: string }>,
): Promise<string[]> {
  // Filter out invalid collections
  const validCollections = allCollections.filter(
    (col) => col.id && col.id.trim() !== "" && col.title !== undefined,
  );

  console.log(
    `🔍 Processing ${validCollections.length}/${allCollections.length} valid collections`,
  );

  const rule = await discountRuleHelpers.getActiveRule(shop);

  if (!rule || rule.excludedCollections.length === 0) {
    // Nessuna regola = tutte le collections valide
    return validCollections
      .map((col) => {
        try {
          return extractNumericId(col.id);
        } catch (error) {
          console.warn(`⚠️ Invalid collection ID: ${col.id}`, error);
          return null;
        }
      })
      .filter((id): id is string => id !== null);
  }

  const selectedIds = new Set(
    rule.excludedCollections.map(
      (col: { collectionId: string }) => col.collectionId,
    ),
  );

  if (rule.mode === "exclude") {
    // EXCLUDE Mode: Tutte le collezioni valide tranne quelle selezionate
    const entitledCollections = validCollections
      .filter((col) => !selectedIds.has(col.id))
      .map((col) => {
        try {
          return extractNumericId(col.id);
        } catch (error) {
          console.warn(
            `⚠️ Invalid collection ID in exclude mode: ${col.id}`,
            error,
          );
          return null;
        }
      })
      .filter((id): id is string => id !== null);
    return entitledCollections;
  } else {
    // INCLUDE Mode: Solo le collezioni valide selezionate
    const entitledCollections = validCollections
      .filter((col) => selectedIds.has(col.id))
      .map((col) => {
        try {
          return extractNumericId(col.id);
        } catch (error) {
          console.warn(
            `⚠️ Invalid collection ID in include mode: ${col.id}`,
            error,
          );
          return null;
        }
      })
      .filter((id): id is string => id !== null);
    return entitledCollections;
  }
}

/**
 * Applica le regole di esclusione a un price rule esistente
 */
export async function applyRuleToPriceRule(
  admin: AdminType,
  shop: string,
  priceRuleId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Verifica se esistono regole attive
    const activeRule = await discountRuleHelpers.getActiveRule(shop);

    if (!activeRule) {
      return {
        success: false,
        message: "No active discount rules found. Please create rules first.",
      };
    }

    // 2. Recupera tutte le collezioni
    const allCollections = await getAllCollections(admin);

    // 3. Calcola le collezioni da includere (escluse quelle nelle regole)
    const entitledCollectionIds = await getEntitledCollections(
      shop,
      allCollections,
    );

    // Note: entitledCollectionIds.length === 0 is valid!
    // It means "exclude all collections" which translates to items: { all: true }

    const excludedCount = allCollections.length - entitledCollectionIds.length;

    // 4. Trova il discount specifico per ottenere il tipo
    const discounts = await getDiscountCodes(admin);
    const targetDiscount = discounts.find((d) => d.id === priceRuleId);

    if (!targetDiscount) {
      return {
        success: false,
        message: `Discount with ID ${priceRuleId} not found.`,
      };
    }

    // 5. Applica le mutation GraphQL basate sul tipo di discount
    const mutationResult = await applyDiscountMutation(
      admin,
      targetDiscount as {
        id: string;
        title: string;
        type: string;
        gid?: string;
      },
      entitledCollectionIds,
      allCollections,
    );

    if (mutationResult.success) {
      const message =
        entitledCollectionIds.length === 0
          ? `Successfully applied rules to "${targetDiscount.title}". All collections excluded - discount applies to no specific collections.`
          : `Successfully applied rules to "${targetDiscount.title}". ${entitledCollectionIds.length} collections active (${excludedCount} excluded).`;

      return {
        success: true,
        message,
      };
    } else {
      return {
        success: false,
        message: `Failed to apply rules: ${mutationResult.error}`,
      };
    } /* 
    // Per implementare correttamente questa funzione servirebbero:
    // 1. Le moderne mutation GraphQL per i discount
    // 2. O l'accesso alle REST API legacy tramite fetch diretto
    // 
    // Esempio di come potrebbe funzionare:
    const allCollections = await getAllCollections(admin);
    const entitledCollectionIds = await getEntitledCollections(shop, allCollections);
    
    // Qui andrebbero le mutation GraphQL per aggiornare i discount
    */
  } catch (error) {
    console.error("Error applying rule to price rule:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Applica le regole di esclusione a TUTTI i price rules dello shop
 */
export async function applyRuleToAllPriceRules(
  admin: AdminType,
  shop: string,
): Promise<{
  success: number;
  failed: number;
  total: number;
  details: Array<{ id: string; title: string; status: string }>;
}> {
  try {
    // 1. Recupera tutti i discount
    const discounts = await getDiscountCodes(admin);

    if (discounts.length === 0) {
      return {
        success: 0,
        failed: 0,
        total: 0,
        details: [],
      };
    }

    // 2. Per ogni discount, simula l'applicazione delle regole
    const results = [];
    let successCount = 0;

    for (const discount of discounts) {
      try {
        // Simula l'applicazione della regola a questo discount specifico
        const result = await applyRuleToPriceRule(
          admin,
          shop,
          String(discount.id),
        );

        results.push({
          id: String(discount.id),
          title: String(discount.title),
          status: result.success ? "processed" : "failed",
        });

        if (result.success) {
          successCount++;
        }
      } catch (error) {
        results.push({
          id: String(discount.id),
          title: String(discount.title),
          status: "error",
        });
      }
    }

    return {
      success: successCount,
      failed: discounts.length - successCount,
      total: discounts.length,
      details: results,
    };

    /*
    // Il codice originale qui sotto usava le REST API legacy
    // che non sono più disponibili nelle moderne versioni di Shopify
    */
  } catch (error) {
    console.error("Error applying rule to all price rules:", error);
    return {
      success: 0,
      failed: 0,
      total: 0,
      details: [],
    };
  }
}

/**
 * Fetch tutti i discount codes e automatic discounts (GraphQL + REST)
 */
export async function getDiscountCodes(admin: AdminType) {
  try {
    console.log("🔍 Fetching discounts...");

    // 1. Fetch discount nodes via GraphQL (nuova API)
    const graphqlResponse = await admin.graphql(
      `#graphql
        query {
          discountNodes(first: 50) {
            edges {
              node {
                id
                discount {
                  __typename
                  ... on DiscountCodeBasic {
                    title
                    status
                    codes(first: 10) {
                      nodes {
                        code
                      }
                    }
                    customerGets {
                      value {
                        ... on DiscountPercentage {
                          percentage
                        }
                        ... on DiscountAmount {
                          amount {
                            amount
                          }
                        }
                      }
                      items {
                        ... on DiscountCollections {
                          collections(first: 10) {
                            nodes {
                              id
                              title
                            }
                          }
                        }
                      }
                    }
                  }
                  ... on DiscountCodeBxgy {
                    title
                    status
                    codes(first: 10) {
                      nodes {
                        code
                      }
                    }
                  }
                  ... on DiscountCodeFreeShipping {
                    title
                    status
                    codes(first: 10) {
                      nodes {
                        code
                      }
                    }
                  }
                  ... on DiscountAutomaticBasic {
                    title
                    status
                    customerGets {
                      value {
                        ... on DiscountPercentage {
                          percentage
                        }
                        ... on DiscountAmount {
                          amount {
                            amount
                          }
                        }
                      }
                    }
                  }
                  ... on DiscountAutomaticBxgy {
                    title
                    status
                  }
                  ... on DiscountAutomaticFreeShipping {
                    title
                    status
                  }
                }
              }
            }
          }
        }`,
    );

    const graphqlData = (await graphqlResponse.json()) as unknown as {
      data: {
        discountNodes: {
          edges: Array<{
            node: {
              id: string;
              discount: {
                __typename: string;
                title: string;
                status: string;
                codes?: {
                  nodes: Array<{
                    code: string;
                  }>;
                };
                customerGets?: {
                  value: {
                    percentage?: number;
                    amount?: {
                      amount: string;
                    };
                  };
                  items?: {
                    collections?: {
                      nodes: Array<{
                        id: string;
                        title: string;
                      }>;
                    };
                  };
                };
              };
            };
          }>;
        };
      };
    };

    console.log("📊 GraphQL Response:", JSON.stringify(graphqlData, null, 2));

    // Trasforma i dati GraphQL nel formato atteso
    const modernDiscounts =
      graphqlData.data?.discountNodes?.edges?.map((edge) => {
        const { node } = edge;
        const { discount } = node;

        // Determina il tipo di valore
        let valueType = "fixed";
        let value = "0";

        if (discount.customerGets?.value?.percentage) {
          valueType = "percentage";
          value = discount.customerGets.value.percentage.toString();
        } else if (discount.customerGets?.value?.amount) {
          valueType = "fixed_amount";
          value = discount.customerGets.value.amount.amount;
        }

        // Calcola il numero di collezioni
        const collectionsCount =
          discount.customerGets?.items?.collections?.nodes?.length || 0;

        return {
          id: extractNumericId(node.id),
          gid: node.id, // Store the full GID for mutations
          title: discount.title,
          value_type: valueType,
          value: value,
          discount_codes: discount.codes?.nodes || [],
          collections_count: collectionsCount,
          target_selection: "entitled",
          type: discount.__typename,
          status: discount.status,
        };
      }) || [];

    // 2. Legacy price rules non sono più supportati nelle moderne API Shopify
    const legacyDiscounts: Array<Record<string, unknown>> = [];
    console.log("💰 Legacy Price Rules: Not supported in modern Shopify API");

    // Combina i risultati
    const allDiscounts = [...modernDiscounts, ...legacyDiscounts];
    console.log(
      "🎯 Total discounts found:",
      allDiscounts.length,
      JSON.stringify(allDiscounts, null, 2),
    );
    return allDiscounts;
  } catch (error) {
    console.error("Error fetching discount codes:", error);
    return [];
  }
}
