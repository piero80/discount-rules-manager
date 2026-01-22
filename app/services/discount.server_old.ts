// Shopify Admin API Types
interface ShopifyAdmin {
  graphql: (
    query: string,
    variables?: Record<string, unknown>,
  ) => Promise<{
    json: () => Promise<unknown>;
  }>;
}

interface DiscountValue {
  percentage?: number;
  amount?: {
    amount: string;
    currencyCode: string;
  };
}

interface CustomerGets {
  value: DiscountValue;
}

interface DiscountConfiguration {
  customerGets: CustomerGets;
  appliesOncePerCustomer?: boolean;
}

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

interface DiscountData {
  id: string;
  gid?: string;
  title: string;
  value_type: string;
  value: string;
  discount_codes: Array<{ code: string }>;
  collections_count: number;
  target_selection: string;
  type: string;
  status: string;
}

interface GraphQLDiscountResponse {
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
  errors?: Array<{ message: string }>;
}

interface GetDiscountResponse {
  data?: {
    discountNode?: {
      id: string;
      discount?: {
        __typename: string;
        title?: string;
        customerGets?: {
          __typename: string;
          items?:
            | Array<{
                __typename: string;
                collections?: {
                  nodes: Array<{
                    id: string;
                    title: string;
                  }>;
                };
                products?: {
                  nodes: Array<{
                    id: string;
                    title: string;
                  }>;
                };
              }>
            | {
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
  };
  errors?: Array<{ message: string }>;
}

interface GetFullDiscountResponse {
  data?: {
    discountNode?: {
      discount?: {
        title?: string;
        summary?: string;
        customerGets?: {
          value: {
            percentage?: number;
            amount?: {
              amount: string;
              currencyCode: string;
            };
          };
          items?: {
            collections?: {
              nodes: Array<{
                id: string;
              }>;
            };
            products?: {
              nodes: Array<{
                id: string;
              }>;
            };
          };
        };
        usageLimit?: number;
        appliesOncePerCustomer?: boolean;
        startsAt?: string;
        endsAt?: string;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

interface DiscountMutationResponse {
  data?: {
    discountCodeBasicUpdate?: {
      userErrors: Array<{
        field?: string[];
        message: string;
      }>;
    };
    discountAutomaticBasicUpdate?: {
      userErrors: Array<{
        field?: string[];
        message: string;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}
interface DiscountMutationResponse {
  data?: {
    discountCodeBasicUpdate?: {
      userErrors: Array<{
        field?: string[];
        message: string;
      }>;
    };
    discountAutomaticBasicUpdate?: {
      userErrors: Array<{
        field?: string[];
        message: string;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

// Helper: Estrai numeric ID da Shopify GID
function extractNumericId(gid: string): string {
  return gid.split("/").pop() || "";
}
/**
 * Recupera le collezioni attualmente applicate a un discount
 */
async function getCurrentDiscountCollections(
  admin: ShopifyAdmin,
  discountId: string,
): Promise<string[]> {
  try {
    let queryDiscountId = discountId;
    if (discountId.includes("DiscountCodeNode")) {
      queryDiscountId = discountId.replace("DiscountCodeNode", "DiscountNode");
    } else if (discountId.includes("DiscountAutomaticNode")) {
      queryDiscountId = discountId.replace(
        "DiscountAutomaticNode",
        "DiscountNode",
      );
    }

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
    const result = (await response.json()) as GetDiscountResponse;

    if (result.errors) {
      return [];
    }

    const discountNode = result.data?.discountNode;
    if (!discountNode) {
      return [];
    }

    const customerGets = discountNode.discount?.customerGets;
    if (!customerGets) {
      return [];
    }

    let collections: Array<{ id: string; title?: string }> = [];

    if (Array.isArray(customerGets.items)) {
      for (const item of customerGets.items) {
        if (
          item.__typename === "DiscountCollections" &&
          item.collections?.nodes
        ) {
          collections.push(...item.collections.nodes);
        }
      }
    } else if (customerGets.items?.collections?.nodes) {
      collections = customerGets.items.collections.nodes;
    }

    return collections.map((col: { id: string }) => col.id);
  } catch (error) {
    return [];
  }
}

/**
 * Rimuove collezioni specifiche da un discount
 */
async function removeCollectionsFromDiscount(
  admin: ShopifyAdmin,
  discountId: string,
  discountType: string,
): Promise<{ success: boolean; error?: string }> {
  try {
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

    const fullConfig = await getFullDiscountConfig(admin, discountId);
    if (!fullConfig) {
      return {
        success: false,
        error: "Could not retrieve discount configuration for removal",
      };
    }

    const discountConfig = fullConfig as unknown as DiscountConfiguration;
    let mutationValue: Record<string, unknown>;
    if (discountConfig.customerGets.value.percentage !== undefined) {
      mutationValue = {
        percentage: discountConfig.customerGets.value.percentage,
      };
    } else if (discountConfig.customerGets.value.amount) {
      mutationValue = {
        discountAmount: {
          amount: discountConfig.customerGets.value.amount.amount,
          appliesOnEachItem: false,
        },
      };
    } else {
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
            all: true,
          },
        },
      },
    };

    const response = await admin.graphql(mutation, { variables });
    const result = (await response.json()) as DiscountMutationResponse;

    if (result.errors) {
      return {
        success: false,
        error: result.errors
          .map((err: { message: string }) => err.message)
          .join(", "),
      };
    }

    const mutationKey = (
      discountType === "DiscountCodeBasic"
        ? "discountCodeBasicUpdate"
        : "discountAutomaticBasicUpdate"
    ) as keyof NonNullable<DiscountMutationResponse["data"]>;

    const userErrors = result.data?.[mutationKey]?.userErrors;

    if (userErrors && userErrors.length > 0) {
      return {
        success: false,
        error: userErrors
          .map((err: { message: string }) => err.message)
          .join(", "),
      };
    }

    return { success: true };
  } catch (error) {
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
  admin: ShopifyAdmin,
  discountId: string,
): Promise<Record<string, unknown> | null> {
  try {
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
    const result = (await response.json()) as GetFullDiscountResponse;

    return result.data?.discountNode?.discount || null;
  } catch (error) {
    return null;
  }
}

/**
 * Aggiorna il discount con la configurazione completa mantenendo tutto tranne le collezioni
 */
async function replaceDiscountCollections(
  admin: ShopifyAdmin,
  discountId: string,
  collectionGids: string[],
  discountType: string,
): Promise<{ success: boolean; error?: string }> {
  try {
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

    const discountConfig = fullConfig as unknown as DiscountConfiguration;

    let mutationValue: Record<string, unknown>;
    if (discountConfig.customerGets.value.percentage !== undefined) {
      mutationValue = {
        percentage: discountConfig.customerGets.value.percentage,
      };
    } else if (discountConfig.customerGets.value.amount) {
      mutationValue = {
        discountAmount: {
          amount: discountConfig.customerGets.value.amount.amount,
          appliesOnEachItem: false,
        },
      };
    } else {
      mutationValue = {
        percentage: 10,
      };
    }

    const customerGets: Record<string, unknown> = {
      value: mutationValue,
      items:
        collectionGids.length > 0
          ? {
              all: false,
              collections: {
                add: collectionGids,
              },
            }
          : {
              all: true,
            },
    };

    if (currentCollectionsToReplace.length > 0) {
      const removeVariables = {
        id: discountId,
        [variableKey]: {
          customerGets: {
            value: mutationValue,
            items: {
              all: true,
            },
          },
        },
      };

      const removeResponse = await admin.graphql(mutation, {
        variables: removeVariables,
      });
      const removeResult =
        (await removeResponse.json()) as DiscountMutationResponse;

      if (removeResult.errors) {
        console.log("⚠️ WARNING: Remove failed, continuing with add...");
      }
    }

    const discountVariables: Record<string, unknown> = {
      customerGets,
    };

    if (discountConfig.appliesOncePerCustomer !== undefined) {
      discountVariables.appliesOncePerCustomer =
        discountConfig.appliesOncePerCustomer;
    }

    const variables = {
      id: discountId,
      [variableKey]: discountVariables,
    };

    const response = await admin.graphql(mutation, { variables });
    const result = (await response.json()) as DiscountMutationResponse;

    if (result.errors) {
      return {
        success: false,
        error: result.errors
          .map((err: { message: string }) => err.message)
          .join(", "),
      };
    }

    const mutationKey = (
      discountType === "DiscountCodeBasic"
        ? "discountCodeBasicUpdate"
        : "discountAutomaticBasicUpdate"
    ) as keyof NonNullable<DiscountMutationResponse["data"]>;
    const userErrors = result.data?.[mutationKey]?.userErrors;
    if (userErrors && userErrors.length > 0) {
      return {
        success: false,
        error: userErrors
          .map((err: { message: string }) => err.message)
          .join(", "),
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Funzione di debug per testare step-by-step il processo di update delle collezioni
 */
export async function debugDiscountCollectionUpdate(
  admin: ShopifyAdmin,
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
    const initialCollections = await getCurrentDiscountCollections(
      admin,
      discountId,
    );
    details.initialCollections = initialCollections;
    console.log("📊 DEBUG: Initial collections found:", initialCollections);

    if (initialCollections.length > 0) {
      const collectionToRemove = [initialCollections[0]];
      const removeResult = await removeCollectionsFromDiscount(
        admin,
        discountId,
        discountType,
      );
      details.removeAttempt = {
        collections: collectionToRemove,
        result: removeResult,
      };
      console.log("📊 DEBUG: Remove attempt result:", removeResult);

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

    const testCollectionGids = ["gid://shopify/Collection/351475990677"];
    const addResult = await replaceDiscountCollections(
      admin,
      discountId,
      testCollectionGids,
      discountType,
    );
    details.addAttempt = { collections: testCollectionGids, result: addResult };
    console.log("📊 DEBUG: Add attempt result:", addResult);

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
 * Fetch tutte le collections dello shop
 */
export async function getAllCollections(admin: ShopifyAdmin) {
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
 * Fetch tutti i discount codes e automatic discounts (GraphQL + REST)
 */
export async function getDiscountCodes(
  admin: ShopifyAdmin,
): Promise<DiscountData[]> {
  try {
    console.log("🔍 Fetching discounts...");

    const graphqlResponse = await admin.graphql(
      `#graphql
        query {
          discountNodes(first: 250) {
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

    const graphqlData =
      (await graphqlResponse.json()) as unknown as GraphQLDiscountResponse;

    if (graphqlData.errors) {
      console.error("❌ GraphQL Errors:", graphqlData.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(graphqlData.errors)}`);
    }

    if (!graphqlData?.data?.discountNodes) {
      console.error("❌ No discount nodes in response");
      return [];
    }

    const edges = graphqlData.data.discountNodes.edges || [];
    console.log(`📊 Found ${edges.length} discount edges`);

    const modernDiscounts = edges
      .map((edge, index) => {
        try {
          const { node } = edge;
          const { discount } = node;

          if (!node?.id || !discount?.title || !discount?.__typename) {
            console.warn(`⚠️ Invalid discount node at index ${index}:`, edge);
            return null;
          }

          let valueType = "fixed";
          let value = "0";

          if (discount.customerGets?.value?.percentage) {
            valueType = "percentage";
            value = discount.customerGets.value.percentage.toString();
          } else if (discount.customerGets?.value?.amount) {
            valueType = "fixed_amount";
            value = discount.customerGets.value.amount.amount;
          }

          const collectionsCount =
            discount.customerGets?.items?.collections?.nodes?.length || 0;

          const discountData: DiscountData = {
            id: extractNumericId(node.id),
            gid: node.id,
            title: discount.title,
            value_type: valueType,
            value: value,
            discount_codes: discount.codes?.nodes || [],
            collections_count: collectionsCount,
            target_selection: "entitled",
            type: discount.__typename,
            status: discount.status,
          };

          console.log(`✅ Processed discount ${index + 1}:`, discountData);
          return discountData;
        } catch (error) {
          console.error(
            `❌ Error processing discount at index ${index}:`,
            error,
            edge,
          );
          return null;
        }
      })
      .filter((discount): discount is DiscountData => discount !== null);

    console.log("📊 Processing complete:");
    console.log(`✅ Modern discounts found: ${modernDiscounts.length}`);

    if (modernDiscounts.length === 0) {
      console.warn("⚠️ WARNING: No discounts found. This might indicate:");
      console.warn("  - No discounts exist in the shop");
      console.warn("  - GraphQL query issues");
      console.warn("  - Authentication/permission issues");
    } else {
      console.log("🎯 Sample discount data:");
      console.log(JSON.stringify(modernDiscounts[0], null, 2));
    }

    return modernDiscounts;
  } catch (error) {
    console.error("❌ Error fetching discount codes via GraphQL:", error);
    return [];
  }
}
