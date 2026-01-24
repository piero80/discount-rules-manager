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
  TextField,
  ResourceList,
  ResourceItem,
  Text,
  BlockStack,
  InlineStack,
  Tag,
  Banner,
  ChoiceList,
  Badge,
  Toast,
  Frame,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import type { Session } from "@shopify/shopify-api";
import { discountRuleHelpers } from "../services/db.server";
import { SubscriptionService } from "../services/subscription.server";
import { MultipleRulesList } from "../components/MultipleRulesList";
import { RulesHeader } from "../components/RulesHeader";
import { RuleForm } from "../components/RuleForm";
// import { useShopifyAppBridge } from "../hooks/useShopifyAppBridge";

// Types
interface Collection {
  id: string;
  title: string;
  productsCount: number;
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
  excludedCollections: Array<{
    id: string;
    title: string;
    productsCount: number;
  }>;
}

interface RuleStats {
  hasRules: boolean;
  rulesCount: number;
  lastActivity: string | null;
}

interface Stats {
  total: number;
  excluded: number;
  applied: number;
}

interface ActionData {
  success: boolean;
  message: string;
  ruleId?: string;
}

// GraphQL Types
interface CollectionNode {
  id: string;
  title: string;
  productsCount: {
    count: number;
  } | null;
}

interface CollectionEdge {
  node: CollectionNode;
}

interface CollectionsResponse {
  data: {
    collections: {
      edges: CollectionEdge[];
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

// Loader: Fetch collections from Shopify and existing rules from database
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  let collections: Collection[] = [];

  try {
    // Fetch collections using GraphQL
    const response = await admin.graphql(
      `#graphql
        query {
          collections(first: 100) {
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

    const responseJson = (await response.json()) as CollectionsResponse;

    // Check for GraphQL errors
    if (responseJson.errors) {
      throw new Error(
        `GraphQL query failed: ${responseJson.errors[0]?.message || "Unknown error"}`,
      );
    }

    if (!responseJson.data || !responseJson.data.collections) {
      collections = [];
    } else {
      collections = responseJson.data.collections.edges.map((edge) => ({
        id: edge.node.id,
        title: edge.node.title || "Untitled Collection", // Handle empty titles
        productsCount: edge.node.productsCount?.count || 0,
      }));
    }
  } catch (error) {
    // Don't throw error, return empty array and let UI handle it
    collections = [];
  }

  // Get all active rules from database (multiple rules support)
  const allRules = await discountRuleHelpers.getActiveRules(session.shop);
  const ruleStats = await discountRuleHelpers.getRuleStats(session.shop);

  // Get subscription limits for plan enforcement
  const planLimit = await SubscriptionService.getPlanLimits(session.shop);

  return data({
    collections,
    // Support for multiple rules
    allRules: allRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      mode: rule.mode as "exclude" | "include",
      priority: rule.priority,
      active: rule.active,
      isScheduled: rule.isScheduled,
      scheduledStart: rule.scheduledStart?.toISOString(),
      scheduledEnd: rule.scheduledEnd?.toISOString(),
      excludedCollections: rule.excludedCollections.map((exc) => ({
        id: exc.collectionId,
        title: exc.title,
        productsCount: exc.productsCount,
      })),
    })),
    ruleStats: {
      hasRules: ruleStats.hasRules,
      rulesCount: ruleStats.rulesCount,
      lastActivity: ruleStats.lastActivity,
    },
    planLimit, // Add plan limits to the response
    // Backward compatibility - first rule for existing UI components
    existingRule:
      allRules.length > 0
        ? {
            id: allRules[0].id,
            mode: allRules[0].mode as "exclude" | "include",
            excludedCollections: allRules[0].excludedCollections.map((exc) => ({
              id: exc.collectionId,
              title: exc.title,
              productsCount: exc.productsCount,
            })),
          }
        : null,
  });
};

// Action: Save exclusion rules to database
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const actionType = formData.get("actionType");

  // Handle new multiple rules operations
  if (actionType === "createRule" || actionType === "updateRule") {
    // TODO: Temporarily disable plan limits during development
    // Check plan limits for new rule creation
    // if (actionType === "createRule") {
    //   const canCreate = await SubscriptionService.canCreateRule(session.shop);
    //   if (!canCreate) {
    //     const planLimit = await SubscriptionService.getPlanLimits(session.shop);
    //     return data(
    //       {
    //         success: false,
    //         message: `You've reached your plan limit of ${planLimit.max} rules. Upgrade to create more rules.`,
    //         planLimitReached: true,
    //       },
    //       { status: 403 },
    //     );
    //   }
    // }

    return handleRuleCreateOrUpdate(
      session,
      formData,
      actionType === "updateRule",
    );
  }

  if (actionType === "deleteRule") {
    return handleRuleDelete(session, formData);
  }

  if (actionType === "toggleRule") {
    return handleRuleToggle(session, formData);
  }

  // Legacy single rule support (backward compatibility)
  const excludedCollectionsStr = formData.get("excludedCollections");
  const mode = formData.get("mode");

  // Handle debug action
  // if (actionType === "debug") {
  //   console.log("🚀 DEBUG ACTION: Starting debug action");
  //   const discountId = formData.get("discountId");
  //   const discountType = formData.get("discountType");

  //   console.log("🚀 DEBUG ACTION: Received data:", {
  //     discountId,
  //     discountType,
  //   });

  //   if (typeof discountId !== "string" || typeof discountType !== "string") {
  //     console.log("❌ DEBUG ACTION: Missing or invalid parameters");
  //     return data(
  //       {
  //         success: false,
  //         message: "Missing discount ID or type for debug",
  //       },
  //       { status: 400 },
  //     );
  //   }

  //   try {
  //     console.log("🚀 DEBUG ACTION: Importing debug function...");
  //     const { debugDiscountCollectionUpdate } = await import(
  //       "../services/discount.server"
  //     );

  //     console.log("🚀 DEBUG ACTION: Calling debugDiscountCollectionUpdate...");
  //     const debugResult = await debugDiscountCollectionUpdate(
  //       admin,
  //       discountId,
  //       discountType,
  //     );

  //     console.log("🚀 DEBUG ACTION: Debug completed with result:", debugResult);

  //     return data({
  //       success: true,
  //       message: "Debug completed - check console logs",
  //       debug: debugResult,
  //     });
  //   } catch (error) {
  //     console.error("❌ DEBUG ACTION: Error in debug:", error);
  //     return data(
  //       {
  //         success: false,
  //         message: `Debug failed: ${error instanceof Error ? error.message : "Unknown error"}`,
  //       },
  //       { status: 500 },
  //     );
  //   }
  // }

  if (typeof excludedCollectionsStr !== "string" || typeof mode !== "string") {
    return data(
      {
        success: false,
        message: "Invalid data format",
      },
      { status: 400 },
    );
  }

  try {
    const excludedCollections: Collection[] = JSON.parse(
      excludedCollectionsStr,
    );

    // Validate mode
    if (mode !== "exclude" && mode !== "include") {
      throw new Error("Invalid mode");
    }

    // Prepare data for database
    const ruleData = {
      shop: session.shop,
      mode: mode as "exclude" | "include",
      excludedCollections: excludedCollections.map((collection) => ({
        collectionId: collection.id,
        title: collection.title,
        productsCount: collection.productsCount,
      })),
    };

    // Save to database
    const savedRule = await discountRuleHelpers.createOrUpdateRule(
      session.shop,
      ruleData,
    );

    // Log the action
    await discountRuleHelpers.logAction(
      session.shop,
      "rule_saved",
      savedRule.id,
      {
        mode,
        excludedCount: excludedCollections.length,
        timestamp: new Date().toISOString(),
      },
    );

    return data({
      success: true,
      message: `Rules saved successfully! ${excludedCollections.length} collections ${mode === "exclude" ? "excluded" : "included"}.`,
      ruleId: savedRule.id,
    });
  } catch (error) {
    // Log the error
    await discountRuleHelpers.logAction(
      session.shop,
      "rule_save_error",
      undefined,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
    );

    return data(
      {
        success: false,
        message: "Failed to save rules. Please try again.",
      },
      { status: 500 },
    );
  }
};

export default function RulesPage(): JSX.Element {
  // const { showResourcePicker, showToast } = useShopifyAppBridge();
  const { collections, existingRule, allRules, ruleStats } =
    useLoaderData() as {
      collections: Collection[];
      allRules: Rule[];
      ruleStats: RuleStats;
      existingRule: {
        id: string;
        mode: "exclude" | "include";
        excludedCollections: Collection[];
      } | null;
    };
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const actionData = useActionData() as ActionData | undefined;

  // Initialize state with existing data from database
  const [excludedCollections, setExcludedCollections] = useState<Collection[]>(
    existingRule?.excludedCollections || [],
  );
  const [searchValue, setSearchValue] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<string[]>([
    existingRule?.mode || "exclude",
  ]);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // All useCallback hooks must be at the top level
  const handleCreateNewRule = useCallback(() => {
    setShowCreateForm(true);
  }, []);

  const handleEditRule = useCallback((ruleId: string) => {
    setEditingRuleId(ruleId);
    setShowCreateForm(true);
  }, []);

  const handleDeleteRule = useCallback(
    (ruleId: string) => {
      const formData = new FormData();
      formData.append("actionType", "deleteRule");
      formData.append("ruleId", ruleId);
      submit(formData, { method: "post" });
    },
    [submit],
  );

  const handleToggleActive = useCallback(
    (ruleId: string, active: boolean) => {
      const formData = new FormData();
      formData.append("actionType", "toggleRule");
      formData.append("ruleId", ruleId);
      formData.append("active", active.toString());
      submit(formData, { method: "post" });
    },
    [submit],
  );

  const handleFormSave = useCallback(
    (formData: FormData) => {
      submit(formData, { method: "post" });
    },
    [submit],
  );

  const handleFormCancel = useCallback(() => {
    setShowCreateForm(false);
    setEditingRuleId(null);
  }, []);

  const handleAddExclusion = useCallback(
    (collection: Collection) => {
      setExcludedCollections([...excludedCollections, collection]);
    },
    [excludedCollections],
  );

  const handleRemoveExclusion = useCallback(
    (collectionId: string) => {
      setExcludedCollections(
        excludedCollections.filter((c) => c.id !== collectionId),
      );
    },
    [excludedCollections],
  );

  const handleSave = useCallback((): void => {
    const formData = new FormData();
    formData.append("excludedCollections", JSON.stringify(excludedCollections));
    formData.append("mode", selectedMode[0] || "exclude");
    submit(formData, { method: "post" });
  }, [excludedCollections, selectedMode, submit]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchValue("");
  }, []);

  const toggleToast = useCallback(() => {
    setToastActive(false);
  }, []);

  // Show toast when action completes
  useEffect(() => {
    if (actionData) {
      setToastMessage(actionData.message);
      setToastError(!actionData.success);
      setToastActive(true);
    }
  }, [actionData]);

  // Computed values
  const planLimit = {
    current: allRules.length,
    max: 1, // Free plan limit
    planName: "Free",
  };

  const currentMode = selectedMode[0] || "exclude";
  const isExcludeMode = currentMode === "exclude";

  const stats: Stats = {
    total: collections.length,
    excluded: excludedCollections.length,
    applied: isExcludeMode
      ? collections.length - excludedCollections.length
      : excludedCollections.length,
  };

  const filteredCollections = collections.filter(
    (collection: Collection) =>
      collection.title.toLowerCase().includes(searchValue.toLowerCase()) &&
      !excludedCollections.some((exc) => exc.id === collection.id),
  );

  const toastMarkup = toastActive ? (
    <Toast content={toastMessage} onDismiss={toggleToast} error={toastError} />
  ) : null;

  // Handle empty collections state first
  if (collections.length === 0) {
    return (
      <Frame>
        {toastMarkup}
        <Page
          title="Smart Discount Rules"
          backAction={{
            content: "Dashboard",
            onAction: () => navigate("/app"),
          }}
        >
          <Layout>
            <Layout.Section>
              <EmptyState
                heading="No collections found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  You need to create collections in your Shopify admin before
                  setting up discount rules. Collections help organize your
                  products and control which items receive discounts.
                </p>
              </EmptyState>
            </Layout.Section>
          </Layout>
        </Page>
      </Frame>
    );
  }

  // Show new UI for multiple rules
  if (allRules.length > 0 || showCreateForm) {
    return (
      <Frame>
        {toastMarkup}
        <Page
          title="Discount Rules"
          backAction={{
            content: "Dashboard",
            onAction: () => navigate("/app"),
          }}
        >
          <Layout>
            <Layout.Section>
              <RulesHeader
                ruleStats={ruleStats}
                onCreateNewRule={handleCreateNewRule}
                planLimit={planLimit}
              />
            </Layout.Section>

            {allRules.length > 0 && (
              <Layout.Section>
                <MultipleRulesList
                  rules={allRules}
                  onEdit={handleEditRule}
                  onDelete={handleDeleteRule}
                  onToggleActive={handleToggleActive}
                />
              </Layout.Section>
            )}

            {showCreateForm && (
              <Layout.Section>
                <RuleForm
                  rule={
                    editingRuleId
                      ? allRules.find((r) => r.id === editingRuleId)
                      : null
                  }
                  collections={collections}
                  onSave={handleFormSave}
                  onCancel={handleFormCancel}
                  isLoading={navigation.state !== "idle"}
                  maxPriority={Math.max(...allRules.map((r) => r.priority), 0)}
                  planLimit={planLimit}
                />
              </Layout.Section>
            )}
          </Layout>
        </Page>
      </Frame>
    );
  }

  // Legacy single rule UI (fallback per compatibilità)
  // App Bridge demo functions
  // const handleTestResourcePicker = async (): Promise<void> => {
  //   try {
  //     const result = await showResourcePicker("Collection");
  //     if (result) {
  //       showToast(
  //         `Selected collection: ${result?.selection?.[0]?.title || "Collection"}`,
  //         "success",
  //       );
  //     }
  //   } catch (error) {
  //     showToast("Resource picker cancelled or failed", "error");
  //   }
  // };
  // const handleDebug = (): void => {
  //   if (!sampleDiscount) {
  //     alert("No discount found for debugging. Please create a discount first.");
  //     return;
  //   }

  //   console.log("🐛🐛🐛 STARTING DEBUG SESSION 🐛🐛🐛");
  //   console.log("🐛 Discount Title:", sampleDiscount.title);
  //   console.log("🐛 Discount ID:", sampleDiscount.id);
  //   console.log("🐛 Discount GID:", sampleDiscount.gid);
  //   console.log("🐛 Discount Type:", sampleDiscount.type);
  //   console.log("🐛 Full sampleDiscount object:", sampleDiscount);

  //   // Use the original GID from Shopify - don't convert it
  //   const discountId =
  //     sampleDiscount.gid ||
  //     `gid://shopify/DiscountCodeNode/${sampleDiscount.id}`;
  //   const discountType = sampleDiscount.type || "DiscountCodeBasic";

  //   console.log("🐛 Will use ID (original):", discountId);
  //   console.log("🐛 Will use Type:", discountType);

  //   const formData = new FormData();
  //   formData.append("actionType", "debug");
  //   formData.append("discountId", discountId);
  //   formData.append("discountType", discountType);
  //   submit(formData, { method: "post" });
  // };

  return (
    <Frame>
      {toastMarkup}
      <Page
        title={
          isExcludeMode
            ? "Smart Discount Exclusion Rules"
            : "Smart Discount Inclusion Rules"
        }
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
        primaryAction={{
          content: "Save Rules",
          loading: navigation.state !== "idle",
          onAction: handleSave,
        }}
        secondaryActions={[
          {
            content: "Manage Discounts",
            onAction: () => navigate("/app/discounts"),
          },
          // {
          //   content: "🐛 Debug Collections",
          //   onAction: handleDebug,
          // },
        ]}
      >
        <Layout>
          <Layout.Section>
            <Banner tone={isExcludeMode ? "success" : "info"}>
              <p>
                {isExcludeMode ? (
                  <>
                    <strong>Smart exclusion mode:</strong> New collections will
                    be automatically included in discounts. Just exclude what
                    you don&apos;t want!
                  </>
                ) : (
                  <>
                    <strong>Manual inclusion mode:</strong> Only selected
                    collections will receive discounts. New collections must be
                    added manually.
                  </>
                )}
              </p>
            </Banner>
          </Layout.Section>

          {existingRule && (
            <Layout.Section>
              <Banner tone="info">
                <p>
                  <strong>Existing rule loaded:</strong> Found{" "}
                  {existingRule.excludedCollections.length}{" "}
                  {existingRule.mode === "exclude" ? "excluded" : "included"}{" "}
                  collections in {existingRule.mode} mode.
                </p>
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Application Mode
                </Text>
                <ChoiceList
                  title=""
                  choices={[
                    {
                      label: "Exclude Collections (Recommended)",
                      value: "exclude",
                      helpText:
                        "Apply discount to ALL collections except excluded ones. New collections are auto-included.",
                    },
                    {
                      label: "Include Collections (Default Shopify)",
                      value: "include",
                      helpText:
                        "Manually select collections to include. New collections must be added manually.",
                    },
                  ]}
                  selected={selectedMode}
                  onChange={setSelectedMode}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <InlineStack gap="400" align="start">
              {/* Left Main Content - Collections */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">
                      {isExcludeMode
                        ? "Excluded Collections"
                        : "Included Collections"}
                    </Text>

                    {excludedCollections.length > 0 ? (
                      <InlineStack gap="200" wrap={true}>
                        {excludedCollections.map((collection) => (
                          <Tag
                            key={collection.id}
                            onRemove={() =>
                              handleRemoveExclusion(collection.id)
                            }
                          >
                            {collection.title}
                          </Tag>
                        ))}
                      </InlineStack>
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "32px",
                          background: "#f9fafb",
                          borderRadius: "8px",
                        }}
                      >
                        <Text tone="subdued" as="p">
                          {isExcludeMode
                            ? "No collections excluded yet. All collections will receive the discount."
                            : "No collections included yet. No collections will receive the discount."}
                        </Text>
                      </div>
                    )}

                    <div
                      style={{
                        borderTop: "1px solid #e1e3e5",
                        paddingTop: "16px",
                        marginTop: "16px",
                      }}
                    >
                      <BlockStack gap="300">
                        <TextField
                          label={
                            isExcludeMode
                              ? "Search collections to exclude"
                              : "Search collections to include"
                          }
                          value={searchValue}
                          onChange={handleSearchChange}
                          placeholder="Search..."
                          autoComplete="off"
                          clearButton
                          onClearButtonClick={handleSearchClear}
                        />

                        <div
                          style={{
                            maxHeight: "400px",
                            overflowY: "auto",
                            border: "1px solid #e1e3e5",
                            borderRadius: "8px",
                          }}
                        >
                          <ResourceList
                            resourceName={{
                              singular: "collection",
                              plural: "collections",
                            }}
                            items={filteredCollections}
                            renderItem={(item: Collection) => {
                              const { id, title, productsCount } = item;

                              return (
                                <ResourceItem
                                  id={id}
                                  onClick={() => handleAddExclusion(item)}
                                  verticalAlignment="center"
                                >
                                  <InlineStack
                                    align="space-between"
                                    blockAlign="center"
                                  >
                                    <BlockStack gap="100">
                                      <Text
                                        variant="bodyMd"
                                        fontWeight="semibold"
                                        as="h4"
                                      >
                                        {title}
                                      </Text>
                                      <Text
                                        variant="bodySm"
                                        tone="subdued"
                                        as="span"
                                      >
                                        {productsCount} products
                                      </Text>
                                    </BlockStack>
                                    <Button size="slim">
                                      {isExcludeMode ? "Exclude" : "Include"}
                                    </Button>
                                  </InlineStack>
                                </ResourceItem>
                              );
                            }}
                          />
                        </div>
                      </BlockStack>
                    </div>
                  </BlockStack>
                </Card>
              </div>

              {/* Right Sidebar - Stats & Tips */}
              <div style={{ width: "280px", flexShrink: 0 }}>
                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="400">
                      <Text variant="headingMd" as="h2">
                        Stats
                      </Text>
                      <BlockStack gap="300">
                        <InlineStack align="space-between">
                          <Text tone="subdued" as="span">
                            Total Collections
                          </Text>
                          <Text variant="headingMd" as="h3">
                            {stats.total}
                          </Text>
                        </InlineStack>
                        <InlineStack align="space-between">
                          <Text tone="subdued" as="span">
                            {isExcludeMode ? "Excluded" : "Included"}
                          </Text>
                          <Badge tone={isExcludeMode ? "critical" : "success"}>
                            {stats.excluded.toString()}
                          </Badge>
                        </InlineStack>
                        <div
                          style={{
                            borderTop: "1px solid #e1e3e5",
                            paddingTop: "12px",
                            marginTop: "8px",
                          }}
                        >
                          <InlineStack align="space-between">
                            <Text variant="bodyMd" fontWeight="bold" as="span">
                              Discount Applied To
                            </Text>
                            <Badge tone="success">
                              {stats.applied.toString()}
                            </Badge>
                          </InlineStack>
                        </div>
                      </BlockStack>
                    </BlockStack>
                  </Card>

                  {/* <Card>
                    <BlockStack gap="300">
                      <Text variant="headingMd" as="h2">
                        🧪 App Bridge Test
                      </Text>
                      <BlockStack gap="300">
                        <Button onClick={handleTestResourcePicker} fullWidth>
                          Test Collection Picker
                        </Button>
                        <Button
                          onClick={() =>
                            showToast("App Bridge toast working!", "success")
                          }
                          fullWidth
                          variant="secondary"
                        >
                          Test Toast Notification
                        </Button>
                      </BlockStack>
                    </BlockStack>
                  </Card> */}

                  <Card>
                    <BlockStack gap="300">
                      <Text variant="headingMd" as="h2">
                        💡 Pro Tips
                      </Text>
                      <BlockStack gap="200">
                        <Text variant="bodyMd" tone="subdued" as="p">
                          • Always exclude &quot;Sale&quot; and
                          &quot;Clearance&quot; to prevent double discounts
                        </Text>
                        <Text variant="bodyMd" tone="subdued" as="p">
                          • Exclude &quot;Gift Cards&quot; from percentage
                          discounts
                        </Text>
                        <Text variant="bodyMd" tone="subdued" as="p">
                          • Use exclusion mode to save time on large catalogs
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Card>
                </BlockStack>
              </div>
            </InlineStack>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}

// Helper functions for rule operations
async function handleRuleCreateOrUpdate(
  session: Session,
  formData: FormData,
  isUpdate: boolean,
) {
  try {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const mode = formData.get("mode") as "exclude" | "include";
    const priority = parseInt(formData.get("priority") as string);
    const active = formData.get("active") === "true";
    const isScheduled = formData.get("isScheduled") === "true";
    const scheduledStart = formData.get("scheduledStart") as string;
    const scheduledEnd = formData.get("scheduledEnd") as string;
    const excludedCollectionsStr = formData.get(
      "excludedCollections",
    ) as string;

    if (!name || !mode || isNaN(priority)) {
      return data(
        { success: false, message: "Missing required fields" },
        { status: 400 },
      );
    }

    const excludedCollections = JSON.parse(excludedCollectionsStr || "[]");

    const ruleData = {
      name: name.trim(),
      description: description?.trim() || undefined,
      shop: session.shop,
      mode,
      priority,
      active,
      isScheduled,
      scheduledStart:
        isScheduled && scheduledStart ? new Date(scheduledStart) : undefined,
      scheduledEnd:
        isScheduled && scheduledEnd ? new Date(scheduledEnd) : undefined,
      excludedCollections: excludedCollections.map(
        (collection: Collection) => ({
          collectionId: collection.id,
          title: collection.title,
          productsCount: collection.productsCount,
        }),
      ),
    };

    let savedRule;
    if (isUpdate) {
      const ruleId = formData.get("ruleId") as string;
      if (!ruleId) {
        return data(
          { success: false, message: "Rule ID required for update" },
          { status: 400 },
        );
      }
      savedRule = await discountRuleHelpers.updateRule(ruleId, ruleData);
    } else {
      savedRule = await discountRuleHelpers.createRule(session.shop, ruleData);
    }

    await discountRuleHelpers.logAction(
      session.shop,
      isUpdate ? "rule_updated" : "rule_created",
      savedRule.id,
      {
        name,
        mode,
        priority,
        active,
        isScheduled,
        excludedCount: excludedCollections.length,
        timestamp: new Date().toISOString(),
      },
    );

    return data({
      success: true,
      message: `Rule ${isUpdate ? "updated" : "created"} successfully!`,
      ruleId: savedRule.id,
    });
  } catch (error) {
    await discountRuleHelpers.logAction(
      session.shop,
      isUpdate ? "rule_update_error" : "rule_create_error",
      undefined,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
    );

    return data(
      {
        success: false,
        message: `Failed to ${isUpdate ? "update" : "create"} rule. Please try again.`,
      },
      { status: 500 },
    );
  }
}

async function handleRuleDelete(session: Session, formData: FormData) {
  try {
    const ruleId = formData.get("ruleId") as string;

    if (!ruleId) {
      return data(
        { success: false, message: "Rule ID required" },
        { status: 400 },
      );
    }

    await discountRuleHelpers.deleteRule(ruleId);

    await discountRuleHelpers.logAction(session.shop, "rule_deleted", ruleId, {
      timestamp: new Date().toISOString(),
    });

    return data({
      success: true,
      message: "Rule deleted successfully!",
    });
  } catch (error) {
    return data(
      { success: false, message: "Failed to delete rule. Please try again." },
      { status: 500 },
    );
  }
}

async function handleRuleToggle(session: Session, formData: FormData) {
  try {
    const ruleId = formData.get("ruleId") as string;
    const active = formData.get("active") === "true";

    if (!ruleId) {
      return data(
        { success: false, message: "Rule ID required" },
        { status: 400 },
      );
    }

    await discountRuleHelpers.updateRule(ruleId, { active });

    await discountRuleHelpers.logAction(session.shop, "rule_toggled", ruleId, {
      active,
      timestamp: new Date().toISOString(),
    });

    return data({
      success: true,
      message: `Rule ${active ? "activated" : "deactivated"} successfully!`,
    });
  } catch (error) {
    return data(
      { success: false, message: "Failed to toggle rule. Please try again." },
      { status: 500 },
    );
  }
}
