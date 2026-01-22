import { useState, useEffect } from "react";
import {
  data,
  useLoaderData,
  useActionData,
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
  DataTable,
  Banner,
  EmptyState,
  Modal,
  List,
  ButtonGroup,
  Tooltip,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getDiscountCodes } from "../services/discount.server";
import { RuleManager } from "../services/rule-manager.server";
import { EditIcon, ViewIcon } from "@shopify/polaris-icons";
interface DiscountWithCodes {
  id: string;
  title: string;
  value_type: string;
  value: string;
  discount_codes: Array<{ code: string; usage_count: number }>;
  collections_count: number;
  collections: Array<{ id: string; title: string }>;
  target_selection: string;
}

interface DiscountRule {
  mode: string;
  id: string;
  discountId: string;
  excludedCollections: Array<{ id: string; title: string }>;
  excludedProducts: Array<{ id: string; title: string }>;
  createdAt: string;
  updatedAt: string;
}

interface LoaderData {
  discounts: DiscountWithCodes[];
  rules: DiscountRule[];
  shopMode: "legacy" | "multiple";
}

interface ActionData {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    if (!admin || !session) {
      throw new Error("Authentication failed");
    }

    // Get discounts and rules in parallel with error handling
    const [discounts, rules, shopMode] = await Promise.all([
      getDiscountCodes(admin).catch((err) => {
        console.error("Error fetching discounts:", err);
        return [];
      }),
      RuleManager.getRules(session.shop).catch((err) => {
        console.error("Error fetching rules:", err);
        return [];
      }),
      RuleManager.getShopMode().catch((err) => {
        console.error("Error fetching shop mode:", err);
        return "legacy" as const;
      }),
    ]);

    console.log({ discounts, rules, shopMode }, "discounts page data");

    return data({
      discounts: discounts || [],
      rules: rules || [],
      shopMode: shopMode || "legacy",
    });
  } catch (error) {
    console.error("Loader error:", error);
    throw new Error(
      `Failed to load discounts page: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const discountId = formData.get("discountId");

  if (actionType === "createRule" && discountId) {
    try {
      // Create empty rule for the discount
      await RuleManager.upsertRule(session.shop, {
        discountId: discountId as string,
        mode: "exclude", // Default to exclude mode for new rules
        excludedCollections: [],
        excludedProducts: [],
      });

      return data({
        success: true,
        message: "Rule created! Configure exclusions now.",
      });
    } catch (error) {
      return data({
        success: false,
        message: "Failed to create rule. Please try again.",
      });
    }
  }

  return data({
    success: false,
    message: "Invalid action",
  });
};

export default function DiscountsPage() {
  const loaderData = useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData | undefined;
  const navigation = useNavigation();
  const navigate = useNavigate();

  // Safe destructuring with fallbacks
  const discounts = loaderData?.discounts || [];
  const rules = loaderData?.rules || [];

  const [showBanner, setShowBanner] = useState(true);
  const [selectedDiscount, setSelectedDiscount] =
    useState<DiscountWithCodes | null>(null);
  const [modalActive, setModalActive] = useState(false);
  // const [modalMode, setModalMode] = useState<'view' | 'edit'>('view'); // Currently not used
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Simple toast function using console for development
  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Reset loading state when navigation completes
  useEffect(() => {
    if (navigation && navigation.state === "idle") {
      setLoadingAction(null);
    }
  }, [navigation]);

  // Show toast notifications for action results
  useEffect(() => {
    if (actionData && navigation && navigation.state === "idle") {
      if (actionData.success) {
        showToast(actionData.message, "success");
      } else {
        showToast(actionData.message, "error");
      }
    }
  }, [actionData, navigation]);

  // Helper to get discount rule
  const getDiscountRule = (discountId: string) =>
    rules.find((rule) => rule.discountId === discountId);

  // Helper to get exclusions summary for a discount
  const getExclusionsSummary = (discountId: string) => {
    const rule = getDiscountRule(discountId);
    if (!rule) return { text: "No exclusions set", count: 0, items: [] };

    const collections = rule.excludedCollections || [];
    const products = rule.excludedProducts || [];
    const totalCount = collections.length + products.length;

    if (totalCount === 0)
      return { text: "No exclusions set", count: 0, items: [] };

    const items = [
      ...collections.map((c) => ({ type: "collection", name: c.title })),
      ...products.map((p) => ({ type: "product", name: p.title })),
    ];

    return {
      text: `${totalCount} exclusion${totalCount > 1 ? "s" : ""}`,
      count: totalCount,
      items: items.slice(0, 3), // Show only first 3 for preview
    };
  };

  // Modal handlers
  const openExclusionsModal = (discount: DiscountWithCodes) => {
    setSelectedDiscount(discount);
    setModalActive(true);
  };

  const closeModal = () => {
    setModalActive(false);
    setSelectedDiscount(null);
    // setModalMode('view'); // Currently not used
  };

  const handleEditExclusions = (discountId: string) => {
    console.log("🎯 [Navigation] Editing exclusions for discount:", discountId);
    console.log("🔗 [Navigation] Target path:", `/app/configure/${discountId}`);
    console.log("🔧 [Navigation] Navigate function available:", !!navigate);

    setLoadingAction(`edit-${discountId}`);

    // Naviga alla nuova rotta con parametro dinamico
    if (navigate) {
      console.log("🚀 [Navigation] Using navigate() function");
      navigate(`/app/configure/${discountId}`);
    } else {
      console.log("🌐 [Navigation] Using window.location.href fallback");
      window.location.href = `/app/configure/${discountId}`;
    }
  };

  // Create enhanced table rows with integrated exclusions
  const tableRows = discounts.map((discount) => {
    const exclusions = getExclusionsSummary(discount.id);
    const isLoading = loadingAction === `edit-${discount.id}`;
    console.log(discount, "Rendering table row for discount");

    return [
      // Discount Name & Details
      <div key={`discount-${discount.id}`}>
        <Text variant="bodyMd" fontWeight="semibold" as="p">
          {discount.title}
        </Text>
        <Text variant="bodySm" tone="subdued" as="p">
          {discount.discount_codes.length > 0
            ? `${discount.discount_codes.length} code${discount.discount_codes.length > 1 ? "s" : ""}`
            : "No codes"}
        </Text>
      </div>,

      // Discount Value
      <Badge key={`value-${discount.id}`} tone="info">
        {discount.value_type === "percentage"
          ? `${discount.value}%`
          : `$${discount.value}`}
      </Badge>,

      // Associated Collections
      <div key={`collections-${discount.id}`}>
        {discount.collections_count > 0 && discount.collections.length > 0 ? (
          <div>
            <Text variant="bodyMd" as="p">
              📁 {discount.collections_count} collection
              {discount.collections_count > 1 ? "s" : ""}
            </Text>
            <div style={{ marginTop: "4px" }}>
              {discount.collections.slice(0, 3).map((collection, index) => (
                <Text key={index} variant="bodySm" tone="subdued" as="p">
                  📁 {collection.title}
                </Text>
              ))}
              {discount.collections.length > 3 && (
                <Text variant="bodySm" tone="subdued" as="p">
                  + {discount.collections.length - 3} more...
                </Text>
              )}
            </div>
          </div>
        ) : discount.collections_count > 0 ? (
          <div>
            <Text variant="bodyMd" as="p">
              📁 {discount.collections_count} collection
              {discount.collections_count > 1 ? "s" : ""}
            </Text>
            <Text variant="bodySm" tone="subdued" as="p">
              Target: {discount.target_selection || "Specific collections"}
            </Text>
          </div>
        ) : (
          <div>
            <Text variant="bodyMd" tone="subdued" as="p">
              🌍 All products
            </Text>
            <Text variant="bodySm" tone="subdued" as="p">
              No specific collections
            </Text>
          </div>
        )}
      </div>,

      // Exclusions Summary with Preview
      <div key={`exclusions-${discount.id}`}>
        {exclusions.count > 0 ? (
          <div>
            <Text variant="bodyMd" as="p">
              {exclusions.text}
            </Text>
            <div style={{ marginTop: "4px" }}>
              {exclusions.items.map((item, index) => (
                <Text key={index} variant="bodySm" tone="subdued" as="p">
                  {item.type === "collection" ? "📁" : "📦"} {item.name}
                </Text>
              ))}
              {exclusions.count > 3 && (
                <Text variant="bodySm" tone="subdued" as="p">
                  + {exclusions.count - 3} more...
                </Text>
              )}
            </div>
          </div>
        ) : (
          <Text variant="bodyMd" tone="subdued" as="p">
            No exclusions set
          </Text>
        )}
      </div>,

      // Actions
      <ButtonGroup key={`actions-${discount.id}`}>
        <Tooltip content="View all exclusions">
          <Button
            icon={ViewIcon}
            onClick={() => openExclusionsModal(discount)}
            accessibilityLabel="View exclusions"
          />
        </Tooltip>
        <Button
          icon={EditIcon}
          variant="primary"
          onClick={() => handleEditExclusions(discount.id)}
          loading={isLoading}
          accessibilityLabel="Edit exclusions"
        >
          {"Edit"}
        </Button>
      </ButtonGroup>,
    ];
  });

  // Modal content for viewing exclusions
  const renderExclusionsModal = () => {
    if (!selectedDiscount) return null;

    const rule = getDiscountRule(selectedDiscount.id);

    return (
      <Modal
        open={modalActive}
        onClose={closeModal}
        title={`Exclusions for "${selectedDiscount.title}"`}
        primaryAction={{
          content: "Edit Exclusions",
          onAction: () => {
            closeModal();
            handleEditExclusions(selectedDiscount.id);
          },
        }}
        secondaryActions={[
          {
            content: "Close",
            onAction: closeModal,
          },
        ]}
      >
        <Modal.Section>
          {rule ? (
            <BlockStack gap="400">
              {rule.excludedCollections &&
                rule.excludedCollections.length > 0 && (
                  <div>
                    <Text variant="headingSm" as="h3">
                      Excluded Collections
                    </Text>
                    <List type="bullet">
                      {rule.excludedCollections.map((collection) => (
                        <List.Item key={collection.id}>
                          {collection.title}
                        </List.Item>
                      ))}
                    </List>
                  </div>
                )}

              {rule.excludedProducts && rule.excludedProducts.length > 0 && (
                <div>
                  <Text variant="headingSm" as="h3">
                    Excluded Products
                  </Text>
                  <List type="bullet">
                    {rule.excludedProducts.map((product) => (
                      <List.Item key={product.id}>{product.title}</List.Item>
                    ))}
                  </List>
                </div>
              )}

              {(!rule.excludedCollections ||
                rule.excludedCollections.length === 0) &&
                (!rule.excludedProducts ||
                  rule.excludedProducts.length === 0) && (
                  <Text tone="subdued" as="p">
                    No exclusions configured yet. Click &quot;Edit
                    Exclusions&quot; to get started.
                  </Text>
                )}
            </BlockStack>
          ) : (
            <Text tone="subdued" as="p">
              No exclusions configured yet. Click &quot;Edit Exclusions&quot; to
              get started.
            </Text>
          )}
        </Modal.Section>
      </Modal>
    );
  };

  if (discounts.length === 0) {
    return (
      <Page
        title="Discount Rules"
        backAction={{
          content: "Dashboard",
          onAction: () =>
            navigate ? navigate("/app") : (window.location.href = "/app"),
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
    <>
      <Page
        title="Discount Exclusions Manager"
        subtitle={`Manage exclusions for ${discounts.length} discount${discounts.length > 1 ? "s" : ""}`}
        backAction={{
          content: "Dashboard",
          onAction: () =>
            navigate ? navigate("/app") : (window.location.href = "/app"),
        }}
        primaryAction={{
          content: "New Rule",
          onAction: () =>
            navigate
              ? navigate("/app/configure")
              : (window.location.href = "/app/configure"),
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

          {/* Main Table Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <div>
                  <Text variant="headingMd" as="h2">
                    Discounts & Exclusions
                  </Text>
                  <Text variant="bodyMd" tone="subdued" as="p">
                    View and manage which products or collections are excluded
                    from each discount. Click &quot;Configure Exclusions&quot;
                    above to set up new exclusions, or use the table actions to
                    view or edit existing ones.
                  </Text>
                </div>

                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text"]}
                  headings={[
                    "Discount",
                    "Value",
                    "Associated Collections",
                    "Current Exclusions",
                    "Actions",
                  ]}
                  rows={tableRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Summary Stats */}
          <Layout.Section>
            <InlineStack gap="400">
              <Card>
                <div style={{ padding: "16px", textAlign: "center" }}>
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h3">
                      {
                        discounts.filter((d) => {
                          const rule = getDiscountRule(d.id);
                          return (
                            rule &&
                            (rule.excludedCollections?.length || 0) +
                              (rule.excludedProducts?.length || 0) >
                              0
                          );
                        }).length
                      }
                    </Text>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      With Exclusions
                    </Text>
                  </BlockStack>
                </div>
              </Card>
              <Card>
                <div style={{ padding: "16px", textAlign: "center" }}>
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h3">
                      {discounts.filter((d) => !getDiscountRule(d.id)).length}
                    </Text>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Need Setup
                    </Text>
                  </BlockStack>
                </div>
              </Card>
              <Card>
                <div style={{ padding: "16px", textAlign: "center" }}>
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h3">
                      {rules.reduce(
                        (sum, rule) =>
                          sum +
                          (rule.excludedCollections?.length || 0) +
                          (rule.excludedProducts?.length || 0),
                        0,
                      )}
                    </Text>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      Total Exclusions
                    </Text>
                  </BlockStack>
                </div>
              </Card>
            </InlineStack>
          </Layout.Section>
        </Layout>
      </Page>

      {/* Exclusions Preview Modal */}
      {renderExclusionsModal()}
    </>
  );
}

export function ErrorBoundary() {
  console.error("ErrorBoundary triggered on discounts page");

  return (
    <Page title="Discounts & Rules">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Something went wrong
              </Text>
              <Text as="p">
                There was an error loading the discounts page. This could be due
                to:
              </Text>
              <List type="bullet">
                <List.Item>Database connection issues</List.Item>
                <List.Item>Shopify API authentication problems</List.Item>
                <List.Item>Missing environment configuration</List.Item>
              </List>
              <Text as="p" tone="subdued">
                Check the browser console and server logs for more details.
              </Text>
              <InlineStack gap="200">
                <Button
                  onClick={() => (window.location.href = "/app")}
                  variant="primary"
                >
                  Go to Dashboard
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
