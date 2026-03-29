import { useState, useCallback, useEffect } from "react";
import {
  data,
  useLoaderData,
  useSubmit,
  useNavigation,
  useNavigate,
  useActionData,
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
  Banner,
  Badge,
  Toast,
  Frame,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import type { Session } from "@shopify/shopify-api";
import { discountRuleHelpers } from "../services/db.server";
import { SubscriptionService } from "../services/subscription.server";
import { RuleForm } from "../components/RuleForm";

// Types
interface Collection {
  id: string;
  title: string;
  productsCount: number;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  imageUrl?: string;
}

interface Rule {
  id: string;
  name: string;
  description?: string;
  mode: "exclude" | "include";
  priority: number;
  active: boolean;
  isScheduled: boolean;
  scheduledStart?: string;
  scheduledEnd?: string;
  excludedCollections: Collection[];
  excludedProducts?: Product[];
}

interface Collection {
  id: string;
  title: string;
  productsCount: number;
}

interface ActionData {
  success: boolean;
  message: string;
  ruleId?: string;
  planLimits?: {
    current: number;
    max: number;
    planName: string;
  };
  needsUpgrade?: boolean;
}

// GraphQL Types
interface CollectionNode {
  id: string;
  title: string;
  productsCount: {
    count: number;
  };
}

interface CollectionEdge {
  node: CollectionNode;
}

interface GraphQLResponse {
  data: {
    collections: {
      edges: CollectionEdge[];
    };
  };
  errors?: Array<{ message: string }>;
}

// Loader: Get rule details and collections
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const ruleId = params.ruleId; // Può essere undefined per new

  // Fetch collections from Shopify GraphQL API
  let collections: Collection[] = [];
  try {
    console.log("Fetching collections from Shopify GraphQL...");
    const response = await admin.graphql(
      `query GetCollections {
        collections(first: 250) {
          edges {
            node {
              id
              title
              productsCount {
                count
              }
            }
          }
        }
      }`,
    );

    const responseJson = (await response.json()) as GraphQLResponse;
    console.log("GraphQL response:", JSON.stringify(responseJson, null, 2));

    // Check for GraphQL errors
    if (responseJson.errors) {
      console.error("GraphQL errors:", responseJson.errors);
      throw new Error(
        `GraphQL query failed: ${responseJson.errors[0]?.message || "Unknown error"}`,
      );
    }

    if (!responseJson.data || !responseJson.data.collections) {
      console.warn("No collections data in response");
      collections = [];
    } else {
      collections = responseJson.data.collections.edges.map((edge) => ({
        id: edge.node.id,
        title: edge.node.title || "Untitled Collection",
        productsCount: edge.node.productsCount?.count || 0,
      }));
      console.log(`Loaded ${collections.length} collections:`, collections);
    }
  } catch (error) {
    console.error("Error loading collections:", error);
    collections = [];
  }

  // Fetch products from Shopify GraphQL API
  let products: Product[] = [];
  try {
    console.log("Fetching products from Shopify GraphQL...");
    const productResponse = await admin.graphql(
      `query GetProducts {
        products(first: 250) {
          edges {
            node {
              id
              title
              handle
              featuredImage {
                url(transform: { maxWidth: 100, maxHeight: 100 })
              }
            }
          }
        }
      }`,
    );

    const productResponseJson = await productResponse.json();
    console.log("Product GraphQL response:", JSON.stringify(productResponseJson, null, 2));

    // Check for GraphQL errors
    if (productResponseJson.errors) {
      console.error("Product GraphQL errors:", productResponseJson.errors);
      // Don't throw error for products, just continue with empty array
      products = [];
    } else if (!productResponseJson.data || !productResponseJson.data.products) {
      console.warn("No products data in response");
      products = [];
    } else {
      products = productResponseJson.data.products.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title || "Untitled Product",
        handle: edge.node.handle || "",
        imageUrl: edge.node.featuredImage?.url,
      }));
      console.log(`Loaded ${products.length} products:`, products);
    }
  } catch (error) {
    console.error("Error loading products:", error);
    products = [];
  }

  // Get rule details if editing
  let rule: Rule | null = null;
  if (ruleId && ruleId !== "new") {
    const ruleData = await discountRuleHelpers.getRuleById(ruleId);
    console.log("🔍 LOADER DEBUG: Raw rule data from database:", ruleData);
    if (ruleData) {
      rule = {
        id: ruleData.id,
        name: ruleData.name,
        description: ruleData.description || undefined,
        mode: ruleData.mode as "exclude" | "include",
        priority: ruleData.priority,
        active: ruleData.active,
        isScheduled: ruleData.isScheduled,
        scheduledStart: ruleData.scheduledStart?.toISOString(),
        scheduledEnd: ruleData.scheduledEnd?.toISOString(),
        excludedCollections: ruleData.excludedCollections.map((exc) => ({
          id: exc.collectionId,
          title: exc.title,
          productsCount: exc.productsCount,
        })),
        excludedProducts: ruleData.excludedProducts?.map((exc) => ({
          id: exc.productId,
          title: exc.title,
          handle: exc.handle || "",
          imageUrl: exc.imageUrl,
        })) || [],
      };
      console.log("🔍 LOADER DEBUG: Final rule object for form:", {
        id: rule.id,
        name: rule.name,
        active: rule.active,
        activeType: typeof rule.active,
      });
    }
  }

  // Get subscription limits
  const planLimit = await SubscriptionService.getPlanLimits(session.shop);

  // Get max priority for new rules
  const allRules = await discountRuleHelpers.getActiveRules(session.shop);
  const maxPriority =
    allRules.length > 0 ? Math.max(...allRules.map((r) => r.priority)) : 0;

  console.log("Final loader data:", {
    collectionsCount: collections.length,
    hasRule: !!rule,
    maxPriority,
    isNew: !ruleId || ruleId === "new",
  });

  return data({
    collections,
    products,
    rule,
    planLimit,
    maxPriority,
    isNew: !ruleId || ruleId === "new",
  });
};

// Action: Save rule (create or update)
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const ruleId = params.ruleId;

  const actionType = formData.get("actionType");

  if (actionType === "saveRule") {
    return handleRuleCreateOrUpdate(
      session,
      formData,
      Boolean(ruleId && ruleId !== "new"), // isUpdate
    );
  }

  return data({ success: false, message: "Invalid action" }, { status: 400 });
};

// Helper function to handle create/update
async function handleRuleCreateOrUpdate(
  session: Session,
  formData: FormData,
  isUpdate: boolean = false,
) {
  try {
    // console.log("🔍 DEBUG: Starting rule save operation");
    // console.log("🔍 DEBUG: isUpdate:", isUpdate);
    // console.log("🔍 DEBUG: session.shop:", session.shop);

    // Test database connection first
    // console.log("🔌 DEBUG: Testing database connection...");
    // const dbConnected = await discountRuleHelpers.testConnection();
    // if (!dbConnected) {
    //   console.error("❌ DEBUG: Database connection test failed");
    //   return data(
    //     {
    //       success: false,
    //       message: "Database connection failed. Please try again.",
    //     },
    //     { status: 500 },
    //   );
    // }
    // console.log("✅ DEBUG: Database connection verified");

    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || "";
    const mode = formData.get("mode") as string;
    const priority = parseInt(formData.get("priority") as string, 10) || 0;
    const active = formData.get("active") === "true"; // Parse checkbox state
    const isScheduled = formData.get("isScheduled") === "true";
    const scheduledStart = formData.get("scheduledStart") as string;
    const scheduledEnd = formData.get("scheduledEnd") as string;

    console.log("📝 ACTION DEBUG: Raw FormData values:", {
      activeRaw: formData.get("active"),
      activeParsed: active,
      isScheduledRaw: formData.get("isScheduled"),
      isScheduledParsed: isScheduled,
      scheduledStartRaw: scheduledStart,
      scheduledEndRaw: scheduledEnd,
    });
    const excludedCollectionsStr = formData.get(
      "excludedCollections",
    ) as string;
    const excludedProductsStr = formData.get(
      "excludedProducts",
    ) as string;
    const ruleId = formData.get("ruleId") as string;

    console.log("🔍 DEBUG: Form data parsed:", {
      name,
      description,
      mode,
      priority,
      active,
      isScheduled,
      scheduledStart,
      scheduledEnd,
      ruleId,
      excludedCollectionsLength: excludedCollectionsStr?.length || 0,
    });

    if (!name || !mode) {
      // console.log("❌ DEBUG: Validation failed - name or mode missing", {
      //   name,
      //   mode,
      // });
      return data(
        { success: false, message: "Name and mode are required" },
        { status: 400 },
      );
    }

    // console.log("✅ DEBUG: Basic validation passed");

    let excludedCollections: Array<{
      collectionId: string;
      title: string;
      productsCount: number;
    }> = [];
    if (excludedCollectionsStr) {
      try {
        const parsed = JSON.parse(excludedCollectionsStr);
        excludedCollections = Array.isArray(parsed)
          ? parsed.map((collection: Collection) => ({
              collectionId: collection.id, // Map 'id' to 'collectionId'
              title: collection.title,
              productsCount: collection.productsCount,
            }))
          : [];
        // console.log(
        //   "🔍 DEBUG: Parsed collections:",
        //   excludedCollections.length,
        //   "items",
        // );
      } catch (error) {
        console.warn("❌ DEBUG: Failed to parse excludedCollections:", error);
        console.warn(
          "❌ DEBUG: Raw collections string:",
          excludedCollectionsStr,
        );
      }
    } else {
      // console.log("🔍 DEBUG: No collections provided");
    }
    // Parse excluded products  
    let excludedProducts: Array<{
      productId: string;
      title: string;
      handle?: string;
      imageUrl?: string;
    }> = [];
    if (excludedProductsStr) {
      try {
        const parsed = JSON.parse(excludedProductsStr);
        excludedProducts = Array.isArray(parsed)
          ? parsed.map((product: Product) => ({
              productId: product.id, // Map 'id' to 'productId'
              title: product.title,
              handle: product.handle,
              imageUrl: product.imageUrl,
            }))
          : [];
        console.log(
          "🔍 DEBUG: Parsed products:",
          excludedProducts.length,
          "items",
        );
      } catch (error) {
        console.warn("❌ DEBUG: Failed to parse excludedProducts:", error);
        console.warn(
          "❌ DEBUG: Raw products string:",
          excludedProductsStr,
        );
      }
    } else {
      console.log("ℹ️ DEBUG: No excludedProducts provided");
    }
    // Use same logic as MultipleRulesList.isRuleCurrentlyActive
    const calculateActiveStatus = (
      baseActive: boolean,
      isScheduled: boolean,
      scheduledStart?: Date,
      scheduledEnd?: Date,
    ) => {
      // If checkbox is unchecked, rule is disabled regardless of scheduling
      if (!baseActive) return false;

      // If checkbox is checked but no scheduling, rule is enabled
      if (!isScheduled) return true;

      // If checkbox is checked AND scheduling is enabled, check timing
      const now = new Date();
      const start = scheduledStart || null;
      const end = scheduledEnd || null;

      if (start && now < start) return false;
      if (end && now > end) return false;

      return true;
    };

    // Calculate final active status considering both checkbox and scheduling
    // NOTE: This is only for display/application logic, not for saving!
    const currentlyActiveStatus = calculateActiveStatus(
      active,
      isScheduled,
      isScheduled && scheduledStart ? new Date(scheduledStart) : undefined,
      isScheduled && scheduledEnd ? new Date(scheduledEnd) : undefined,
    );

    console.log("🎯 ACTION DEBUG: Active status calculation:", {
      checkboxActive: active,
      isScheduled,
      scheduledStart,
      scheduledEnd,
      currentlyActiveStatus, // This is for display only
      willSaveInDB: active, // This is what gets saved - the checkbox value!
      now: new Date().toISOString(),
    });

    const ruleData = {
      name: name.trim(),
      description: description.trim() || undefined,
      shop: session.shop,
      mode: mode as "exclude" | "include",
      priority,
      active, // Save the checkbox value directly, not the calculated status!
      isScheduled,
      scheduledStart:
        isScheduled && scheduledStart ? new Date(scheduledStart) : undefined,
      scheduledEnd:
        isScheduled && scheduledEnd ? new Date(scheduledEnd) : undefined,
      excludedCollections,
      excludedProducts,
    };

    console.log("🔍 DEBUG: Rule data prepared:", {
      ...ruleData,
      currentlyActiveStatus, // For info only - not saved
      enabledByUser: active, // What gets saved in database
      excludedCollections: `${ruleData.excludedCollections.length} items`,
      excludedProducts: `${ruleData.excludedProducts.length} items`,
    });

    let result;
    let actionMessage;

    if (isUpdate && ruleId) {
      // Update existing rule
      // console.log("🔄 DEBUG: Updating existing rule:", ruleId);
      result = await discountRuleHelpers.updateRule(ruleId, ruleData);
      actionMessage = "Rule updated successfully!";
      // console.log("✅ DEBUG: Rule update completed:", result.id);

      await discountRuleHelpers.logAction(
        session.shop,
        "rule_updated",
        ruleId,
        {
          name: ruleData.name,
          timestamp: new Date().toISOString(),
        },
      );
    } else {
      // Create new rule - check plan limits first
      // console.log("➕ DEBUG: Creating new rule - checking plan limits");

      const canCreate = await SubscriptionService.canCreateRule(session.shop);
      if (!canCreate) {
        const planLimits = await SubscriptionService.getPlanLimits(
          session.shop,
        );
        return data({
          success: false,
          message: `Plan limit reached! You can create up to ${planLimits.max} rules with your ${planLimits.planName} plan. Upgrade your plan to create more rules.`,
          planLimits,
          needsUpgrade: true,
        });
      }

      // console.log("➕ DEBUG: Creating new rule");
      result = await discountRuleHelpers.createRule(session.shop, ruleData);
      actionMessage = "Rule created successfully!";
      // console.log("✅ DEBUG: Rule creation completed:", result.id);

      await discountRuleHelpers.logAction(
        session.shop,
        "rule_created",
        result.id,
        {
          name: ruleData.name,
          timestamp: new Date().toISOString(),
        },
      );
    }

    return data({
      success: true,
      message: actionMessage,
      ruleId: result.id,
    });
  } catch (error) {
    // console.error("❌ DEBUG: Critical error saving rule:", error);
    // console.error("❌ DEBUG: Error details:", {
    //   message: error instanceof Error ? error.message : "Unknown error",
    //   stack: error instanceof Error ? error.stack : "No stack trace",
    //   name: error instanceof Error ? error.name : "Unknown error type",
    // });

    // Return more specific error information
    const errorMessage =
      error instanceof Error
        ? `Failed to save rule: ${error.message}`
        : "Failed to save rule. Please try again.";

    return data({ success: false, message: errorMessage }, { status: 500 });
  }
}

// Component
export default function RuleDetailsPage(): JSX.Element {
  const { collections, products, rule, planLimit, maxPriority, isNew } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const isLoading = navigation.state === "submitting";

  // Handle action results
  useEffect(() => {
    if (actionData) {
      setToastMessage(actionData.message);
      setToastError(!actionData.success);
      setToastActive(true);

      // Redirect to rules list on successful creation
      if (actionData.success && isNew) {
        setTimeout(() => {
          navigate("/app/rules");
        }, 2000);
      }
    }
  }, [actionData, isNew, navigate]);

  const handleFormSave = useCallback(
    (formData: FormData) => {
      formData.append("actionType", "saveRule");
      if (rule?.id) {
        formData.append("ruleId", rule.id);
      }
      submit(formData, { method: "post" });
    },
    [submit, rule?.id],
  );

  const handleFormCancel = useCallback(() => {
    navigate("/app/rules");
  }, [navigate]);

  // Check if at plan limit for new rules
  const isAtLimit = planLimit && planLimit.current >= planLimit.max && isNew;

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      onDismiss={() => setToastActive(false)}
      error={toastError}
    />
  ) : null;

  const pageTitle = isNew ? "Create New Rule" : `Edit Rule: ${rule?.name}`;
  const primaryAction = isNew ? "Create Rule" : "Save Changes";

  return (
    <Frame>
      {toastMarkup}
      <Page
        title={pageTitle}
        backAction={{
          content: "Rules",
          onAction: () => navigate("/app/rules"),
        }}
        primaryAction={
          !isAtLimit
            ? {
                content: primaryAction,
                loading: isLoading,
                onAction: () => {
                  // The form will handle the submission
                },
              }
            : undefined
        }
      >
        <Layout>
          <Layout.Section>
            {/* Show upgrade needed banner if action failed due to plan limits */}
            {actionData?.needsUpgrade && (
              <Card>
                <BlockStack gap="400">
                  <Banner tone="critical">
                    <p>
                      <strong>Plan Limit Reached</strong>
                      <br />
                      {actionData.message}
                    </p>
                  </Banner>
                  <InlineStack gap="300" align="end">
                    <Button onClick={handleFormCancel}>Go Back</Button>
                    <Button
                      variant="primary"
                      onClick={() => navigate("/app/billing")}
                    >
                      Upgrade Plan
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            )}

            {/* Show limit warning for new rules */}
            {isAtLimit && !actionData?.needsUpgrade ? (
              <Card>
                <BlockStack gap="400">
                  <Banner tone="warning">
                    <p>
                      <strong>Plan Limit Reached</strong>
                      <br />
                      You&apos;ve reached the maximum number of rules (
                      {planLimit?.max}) for your {planLimit?.planName} plan.
                      Upgrade to create more rules.
                    </p>
                  </Banner>
                  <InlineStack gap="300" align="end">
                    <Button onClick={handleFormCancel}>Go Back</Button>
                    <Button
                      variant="primary"
                      onClick={() => navigate("/app/billing")}
                    >
                      Upgrade Plan
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            ) : (
              !actionData?.needsUpgrade && (
                <RuleForm
                  rule={rule}
                  collections={collections}
                  products={products}
                  onSave={handleFormSave}
                  onCancel={handleFormCancel}
                  isLoading={isLoading}
                  maxPriority={maxPriority}
                  planLimit={planLimit}
                />
              )
            )}
          </Layout.Section>

          {/* Rule preview/info section */}
          {rule &&
            (() => {
              // Calculate current active status using same logic as MultipleRulesList
              const isCurrentlyActive = (() => {
                if (!rule.active || !rule.isScheduled) return rule.active;

                const now = new Date();
                const start = rule.scheduledStart
                  ? new Date(rule.scheduledStart)
                  : null;
                const end = rule.scheduledEnd
                  ? new Date(rule.scheduledEnd)
                  : null;

                if (start && now < start) return false;
                if (end && now > end) return false;

                return true;
              })();

              return (
                <Layout.Section variant="oneThird">
                  <Card>
                    <BlockStack gap="400">
                      <Text variant="headingMd" as="h3">
                        Rule Information
                      </Text>

                      <InlineStack align="space-between">
                        <Text variant="bodyMd" as="p">
                          Enabled:
                        </Text>
                        <Badge tone={rule.active ? "success" : "critical"}>
                          {rule.active ? "Enabled" : "Disabled"}
                        </Badge>
                      </InlineStack>

                      <InlineStack align="space-between">
                        <Text variant="bodyMd" as="p">
                          Current Status:
                        </Text>
                        <Badge tone={isCurrentlyActive ? "success" : "info"}>
                          {isCurrentlyActive
                            ? "Currently Active"
                            : "Currently Inactive"}
                        </Badge>
                      </InlineStack>

                      <InlineStack align="space-between">
                        <Text variant="bodyMd" as="p">
                          Priority:
                        </Text>
                        <Badge tone="info">{rule.priority.toString()}</Badge>
                      </InlineStack>

                      <InlineStack align="space-between">
                        <Text variant="bodyMd" as="p">
                          Mode:
                        </Text>
                        <Badge
                          tone={rule.mode === "exclude" ? "warning" : "success"}
                        >
                          {rule.mode.charAt(0).toUpperCase() +
                            rule.mode.slice(1)}
                        </Badge>
                      </InlineStack>

                      <InlineStack align="space-between">
                        <Text variant="bodyMd" as="p">
                          Collections:
                        </Text>
                        <Text variant="bodyMd" as="p">
                          {rule.excludedCollections.length}
                        </Text>
                      </InlineStack>

                      {rule.isScheduled && (
                        <>
                          <Text variant="headingMd" as="h4">
                            Schedule
                          </Text>
                          {rule.scheduledStart && (
                            <InlineStack align="space-between">
                              <Text variant="bodyMd" as="p">
                                Starts:
                              </Text>
                              <Text variant="bodyMd" as="p">
                                {new Date(rule.scheduledStart).toLocaleString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                  },
                                )}
                              </Text>
                            </InlineStack>
                          )}
                          {rule.scheduledEnd && (
                            <InlineStack align="space-between">
                              <Text variant="bodyMd" as="p">
                                Ends:
                              </Text>
                              <Text variant="bodyMd" as="p">
                                {new Date(rule.scheduledEnd).toLocaleString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                  },
                                )}
                              </Text>
                            </InlineStack>
                          )}
                        </>
                      )}
                    </BlockStack>
                  </Card>
                </Layout.Section>
              );
            })()}
        </Layout>
      </Page>
    </Frame>
  );
}
