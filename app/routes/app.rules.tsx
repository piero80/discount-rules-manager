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
import { discountRuleHelpers } from "../services/db.server";

// Types
interface Collection {
  id: string;
  title: string;
  productsCount: number;
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

  // Get existing discount rule from database
  const existingRule = await discountRuleHelpers.getActiveRule(session.shop);

  // Fetch sample discount for debugging
  // let sampleDiscount = null;
  // try {
  //   console.log("🔍 Fetching discounts for debug...");
  //   const { getDiscountCodes } = await import("../services/discount.server");
  //   const discounts = await getDiscountCodes(admin);
  //   console.log("🔍 All discounts found:", discounts.length);
  //   console.log(
  //     "🔍 Discounts data:",
  //     JSON.stringify(discounts.slice(0, 2), null, 2),
  //   );
  //   sampleDiscount = discounts.length > 0 ? discounts[0] : null;
  //   console.log("🔍 Selected sample discount:", sampleDiscount);
  // } catch (error) {
  //   console.error("❌ Error fetching sample discount:", error);
  // }

  return data({
    collections,
    // sampleDiscount,
    existingRule: existingRule
      ? {
          id: existingRule.id,
          mode: existingRule.mode as "exclude" | "include",
          excludedCollections: existingRule.excludedCollections.map((exc) => ({
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

  // const actionType = formData.get("actionType");
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
  const { collections, existingRule } = useLoaderData() as {
    collections: Collection[];
    // sampleDiscount: {
    //   id: string;
    //   gid?: string;
    //   title: string;
    //   type: string;
    // } | null;
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
  const isLoading = navigation.state === "submitting";

  // Show toast when action completes
  useEffect(() => {
    if (actionData) {
      setToastMessage(actionData.message);
      setToastError(!actionData.success);
      setToastActive(true);
    }
  }, [actionData]);

  // Filter collections based on search
  const filteredCollections = collections.filter(
    (collection: Collection) =>
      collection.title.toLowerCase().includes(searchValue.toLowerCase()) &&
      !excludedCollections.some((exc) => exc.id === collection.id),
  );

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

  const handleSave = (): void => {
    const formData = new FormData();
    formData.append("excludedCollections", JSON.stringify(excludedCollections));
    formData.append("mode", selectedMode[0] || "exclude");
    submit(formData, { method: "post" });
  };

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

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchValue("");
  }, []);

  const toggleToast = useCallback(() => {
    setToastActive(false);
  }, []);

  const currentMode = selectedMode[0] || "exclude";
  const isExcludeMode = currentMode === "exclude";

  const stats: Stats = {
    total: collections.length,
    excluded: excludedCollections.length,
    applied: isExcludeMode
      ? collections.length - excludedCollections.length
      : excludedCollections.length,
  };

  const toastMarkup = toastActive ? (
    <Toast content={toastMessage} onDismiss={toggleToast} error={toastError} />
  ) : null;

  // Handle empty collections state
  if (collections.length === 0) {
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

  return (
    <Frame>
      {toastMarkup}
      <Page
        title={
          isExcludeMode
            ? "Discount Exclusion Rules"
            : "Discount Inclusion Rules"
        }
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
        primaryAction={{
          content: "Save Rules",
          loading: isLoading,
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
