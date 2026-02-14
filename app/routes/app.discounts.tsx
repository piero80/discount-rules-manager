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
  DataTable,
  EmptyState,
  Popover,
  ActionList,
} from "@shopify/polaris";
import { ChevronDownIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import {
  getDiscountCodes,
  applyRuleToPriceRule,
  applyRuleToAllPriceRules,
} from "../services/discount.server";
import { SubscriptionService } from "../services/subscription.server";
import { useShopifyAppBridge } from "../hooks/useShopifyAppBridge";
import {
  MultipleRulesManager,
  type ActiveRule,
} from "../components/MultipleRulesManager";
import {
  RuleApplicationStatus,
  useRuleApplication,
} from "../components/RuleApplicationStatus";
interface DiscountWithCodes {
  id: string;
  title: string;
  value_type: string;
  value: string;
  discount_codes: Array<{ code: string; usage_count: number }>;
  collections_count: number;
  target_selection: string;
}

interface LoaderData {
  discounts: DiscountWithCodes[];
  activeRules: ActiveRule[];
  hasActiveRule: boolean; // backward compatibility
  planLimit: {
    current: number;
    max: number;
    planName: string;
  };
}

interface ActionData {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discounts = await getDiscountCodes(admin as any);

  // Get all active rules with stats and complete collection details
  const { discountRuleHelpers } = await import("../services/db.server");
  const ruleStats = await discountRuleHelpers.getRuleStats(session.shop);
  const activeRulesWithDetails = await discountRuleHelpers.getActiveRules(
    session.shop,
  );

  // Merge rule stats with complete collection details
  const enrichedActiveRules = ruleStats.rules.map((ruleStat) => {
    const ruleWithDetails = activeRulesWithDetails.find(
      (r) => r.id === ruleStat.id,
    );
    return {
      ...ruleStat,
      excludedCollections:
        ruleWithDetails?.excludedCollections.map((exc) => ({
          id: exc.collectionId,
          title: exc.title,
          productsCount: exc.productsCount,
        })) || [],
    };
  });

  // Get subscription limits for plan enforcement
  const planLimit = await SubscriptionService.getPlanLimits(session.shop);

  return data({
    discounts,
    activeRules: enrichedActiveRules,
    hasActiveRule: ruleStats.hasRules, // backward compatibility
    planLimit,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const priceRuleId = formData.get("priceRuleId");

  if (actionType === "applyToOne" && priceRuleId) {
    const ruleId = formData.get("ruleId") as string | null;
    const result = await applyRuleToPriceRule(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      session.shop,
      priceRuleId as string,
      ruleId || undefined, // Pass specific rule ID if provided
    );
    return data(result);
  }

  if (actionType === "applyToAll") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyRuleToAllPriceRules(admin as any, session.shop);

    // Create detailed message based on results
    let message = `✅ ${result.success} applied successfully`;
    if (result.skipped > 0) {
      message += `, ${result.skipped} skipped (would become empty)`;
    }
    if (result.failed > 0) {
      message += `, ${result.failed} failed`;
    }
    message += ` out of ${result.total} total discounts.`;

    return data({
      success: result.success > 0,
      message: message,
      details: result,
    });
  }

  return data({
    success: false,
    message: "Invalid action",
  });
};

export default function DiscountsPage() {
  const { discounts, activeRules, hasActiveRule, planLimit } =
    useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData | undefined;
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [loadingDiscountId, setLoadingDiscountId] = useState<string | null>(
    null,
  );
  const [lastProcessedActionData, setLastProcessedActionData] =
    useState<ActionData | null>(null);
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});
  const { showToast } = useShopifyAppBridge();

  // Use the rule application hook for better UX
  const {
    result: ruleApplicationResult,
    isLoading: isApplyingRules,
    startApplication,
    completeApplication,
    dismissResult,
  } = useRuleApplication();

  // Helper function to check if a rule is currently active due to scheduling
  const isRuleCurrentlyActive = (rule: ActiveRule) => {
    if (!rule.isScheduled) return true;

    const now = new Date();
    const start = rule.scheduledStart ? new Date(rule.scheduledStart) : null;
    const end = rule.scheduledEnd ? new Date(rule.scheduledEnd) : null;

    if (start && now < start) return false;
    if (end && now > end) return false;

    return true;
  };

  // Handle action results for applying rules
  useEffect(() => {
    if (
      actionData &&
      navigation.state === "idle" &&
      actionData !== lastProcessedActionData
    ) {
      console.log("🎯 Processing new actionData:", actionData);

      // Salva il valore corrente prima di resettarlo
      const currentLoadingId = loadingDiscountId;

      // Reset loading state quando ricevo la risposta
      setLoadingDiscountId(null);

      // Marca questo actionData come processato per evitare toast ripetuti
      setLastProcessedActionData(actionData);

      // Complete the application with the result
      completeApplication({
        success: actionData.success,
        message: actionData.message,
        details: actionData.details as {
          success: number;
          failed: number;
          total: number;
          errors?: string[];
        },
      });

      // Show toast for single rule applications (usa il valore salvato)
      if (currentLoadingId !== "all") {
        if (actionData.success) {
          showToast(actionData.message, "success");
        } else {
          showToast(actionData.message, "error");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    actionData,
    navigation.state,
    showToast,
    completeApplication,
    // RIMOSSO loadingDiscountId e lastProcessedActionData per evitare loop
  ]);

  const handleApplyToOne = (priceRuleId: string) => {
    // Trova il discount per verificare se ha collezioni
    const discount = discounts.find((d) => d.id === priceRuleId);

    // Verifica preventiva: se il discount non ha collezioni, mostra avviso
    if (discount && discount.collections_count === 0) {
      showToast(
        `⚠️ Cannot apply rules to "${discount.title}" - this discount has no target collections. Please add collections in Shopify Admin first.`,
        "info",
      );
      return; // Non eseguire la chiamata al server
    }

    setLoadingDiscountId(priceRuleId);
    setLastProcessedActionData(null); // Reset per permettere il prossimo actionData
    const formData = new FormData();
    formData.append("actionType", "applyToOne");
    formData.append("priceRuleId", priceRuleId);
    submit(formData, { method: "post" });
  };

  const handleApplySpecificRule = (
    priceRuleId: string,
    ruleId: string,
    ruleName: string,
  ) => {
    // Trova il discount per verificare se ha collezioni
    const discount = discounts.find((d) => d.id === priceRuleId);

    if (discount && discount.collections_count === 0) {
      showToast(
        `⚠️ Cannot apply rule to "${discount.title}" - this discount has no target collections.`,
        "info",
      );
      return;
    }

    setLoadingDiscountId(priceRuleId);
    setLastProcessedActionData(null);
    setOpenPopovers((prev) => ({ ...prev, [priceRuleId]: false })); // Close popover

    const formData = new FormData();
    formData.append("actionType", "applyToOne");
    formData.append("priceRuleId", priceRuleId);
    formData.append("ruleId", ruleId);
    submit(formData, { method: "post" });

    showToast(`Applying "${ruleName}" rule to ${discount?.title}`, "info");
  };

  const togglePopover = (discountId: string) => {
    setOpenPopovers((prev) => ({
      ...prev,
      [discountId]: !prev[discountId],
    }));
  };

  const handleApplyToAll = () => {
    setLoadingDiscountId("all");
    setLastProcessedActionData(null); // Reset per permettere il prossimo actionData
    startApplication(); // Start the enhanced UX for bulk operations
    const formData = new FormData();
    formData.append("actionType", "applyToAll");
    submit(formData, { method: "post" });
  };

  const rows = discounts.map((discount) => [
    <Text key={`title-${discount.id}`} as="span" fontWeight="semibold">
      {discount.title}
    </Text>,
    <InlineStack key={`codes-${discount.id}`} gap="100" wrap={false}>
      {discount.discount_codes.map((code) => (
        <Badge key={code.code} tone="info">
          {code.code}
        </Badge>
      ))}
    </InlineStack>,
    <Badge
      key={`value-${discount.id}`}
      tone={discount.value_type === "percentage" ? "success" : "attention"}
    >
      {discount.value_type === "percentage"
        ? `${discount.value}%`
        : `$${discount.value}`}
    </Badge>,
    <Text
      key={`collections-${discount.id}`}
      as="span"
      variant="bodySm"
      tone="subdued"
    >
      {discount.collections_count} collections
    </Text>,
    // Solo mostra il pulsante se ci sono regole attive
    ...(hasActiveRule
      ? [
          <InlineStack key={`actions-${discount.id}`} gap="100">
            {/* Standard Apply All Rules button */}
            <Button
              size="slim"
              onClick={() => handleApplyToOne(discount.id)}
              loading={loadingDiscountId === discount.id}
              disabled={discount.collections_count === 0}
              variant={
                discount.collections_count === 0 ? "tertiary" : "primary"
              }
            >
              {discount.collections_count === 0
                ? "No Collections"
                : "Apply All Rules"}
            </Button>

            {/* Premium Feature: Apply Specific Rules (BASIC+ plans) */}
            {planLimit.planName !== "FREE" && activeRules.length > 0 && (
              <Popover
                active={openPopovers[discount.id] || false}
                activator={
                  <Button
                    size="slim"
                    onClick={() => togglePopover(discount.id)}
                    disabled={
                      discount.collections_count === 0 ||
                      loadingDiscountId === discount.id
                    }
                    icon={ChevronDownIcon}
                  >
                    Specific Rule
                  </Button>
                }
                onClose={() =>
                  setOpenPopovers((prev) => ({ ...prev, [discount.id]: false }))
                }
                preferredAlignment="left"
                fullWidth={false}
              >
                <div style={{ minWidth: "280px", padding: "4px" }}>
                  <ActionList
                    items={
                      activeRules.length > 0
                        ? activeRules.map((rule) => {
                            const isCurrentlyActive =
                              isRuleCurrentlyActive(rule);
                            return {
                              content: (
                                <div style={{ padding: "8px 12px" }}>
                                  <BlockStack gap="100">
                                    <InlineStack
                                      gap="200"
                                      blockAlign="center"
                                      align="space-between"
                                    >
                                      <Text
                                        as="span"
                                        fontWeight="medium"
                                        tone={
                                          isCurrentlyActive
                                            ? undefined
                                            : "subdued"
                                        }
                                      >
                                        {rule.name}
                                        {!isCurrentlyActive &&
                                          planLimit.planName !== "FREE" &&
                                          " (Scheduled)"}
                                      </Text>
                                      <InlineStack gap="100">
                                        <Badge
                                          tone={
                                            rule.mode === "exclude"
                                              ? "critical"
                                              : "success"
                                          }
                                          size="small"
                                        >
                                          {rule.mode.toUpperCase()}
                                        </Badge>
                                        {!isCurrentlyActive &&
                                          planLimit.planName !== "FREE" && (
                                            <Badge tone="warning" size="small">
                                              SCHEDULED
                                            </Badge>
                                          )}
                                      </InlineStack>
                                    </InlineStack>
                                    {rule.excludedCollections &&
                                      rule.excludedCollections.length > 0 && (
                                        <Text
                                          as="span"
                                          variant="bodySm"
                                          tone="subdued"
                                        >
                                          {rule.excludedCollections.length}{" "}
                                          collection
                                          {rule.excludedCollections.length !== 1
                                            ? "s"
                                            : ""}{" "}
                                          •{" "}
                                          {rule.excludedCollections
                                            .slice(0, 2)
                                            .map((c) => c.title)
                                            .join(", ")}
                                          {rule.excludedCollections.length > 2
                                            ? ` +${rule.excludedCollections.length - 2} more`
                                            : ""}
                                        </Text>
                                      )}
                                    {!isCurrentlyActive &&
                                      planLimit.planName !== "FREE" && (
                                        <Text
                                          as="span"
                                          variant="bodySm"
                                          tone="critical"
                                        >
                                          This rule is scheduled and may not be
                                          active right now
                                        </Text>
                                      )}
                                  </BlockStack>
                                </div>
                              ),
                              onAction: () =>
                                handleApplySpecificRule(
                                  discount.id,
                                  rule.id,
                                  rule.name,
                                ),
                              disabled: !isCurrentlyActive,
                            };
                          })
                        : [
                            {
                              content: (
                                <div style={{ padding: "8px 12px" }}>
                                  <Text as="span" tone="subdued">
                                    No individual rules available
                                  </Text>
                                </div>
                              ),
                              disabled: true,
                            },
                          ]
                    }
                  />
                </div>
              </Popover>
            )}
          </InlineStack>,
        ]
      : []),
  ]);

  if (discounts.length === 0 && !hasActiveRule) {
    return (
      <Page
        title="Smart Discount Manager"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
        secondaryActions={[
          {
            content: "Create Rules",
            onAction: () => navigate("/app/rules"),
          },
        ]}
      >
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="Get started with Smart Discount Manager"
              action={{
                content: "Create Rules",
                onAction: () => navigate("/app/rules"),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Create discount rules and discount codes in your Shopify admin
                to start managing your store&apos;s discounts automatically.
              </p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (discounts.length === 0) {
    return (
      <Page
        title="Smart Discount Manager"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
        secondaryActions={[
          {
            content: "Edit Rules",
            onAction: () => navigate("/app/rules"),
          },
        ]}
      >
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="No discount codes found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Create discount codes in your Shopify admin, then return here to
                apply your exclusion rules.
              </p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Smart Discount Manager"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      secondaryActions={[
        {
          content: "Manage Rules",
          onAction: () => navigate("/app/rules"),
        },
      ]}
    >
      <Layout>
        {/* Rule Application Status */}
        {(isApplyingRules || ruleApplicationResult) && (
          <Layout.Section>
            <RuleApplicationStatus
              result={ruleApplicationResult}
              isLoading={isApplyingRules}
              onDismiss={dismissResult}
              onRetry={handleApplyToAll}
            />
          </Layout.Section>
        )}

        {/* Active Rules Management */}
        <Layout.Section>
          <MultipleRulesManager
            activeRules={activeRules}
            onEditRules={() => navigate("/app/rules")}
            onApplyRules={handleApplyToAll}
            isLoading={loadingDiscountId === "all"}
          />
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">
                    Your Discount Codes
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Apply your discount rules to existing discount codes
                  </Text>
                </BlockStack>
                <Badge tone="info">{`${discounts.length} total`}</Badge>
              </InlineStack>

              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text"]}
                headings={[
                  "Discount Name",
                  "Codes",
                  "Value",
                  "Collections",
                  "Action",
                ]}
                rows={rows}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                💡 How Multiple Rules Work
              </Text>
              <BlockStack gap="200">
                {planLimit.planName !== "FREE" && (
                  <Text variant="bodyMd" as="p">
                    • <strong>Priority Order:</strong> Rules are applied in
                    order (#1 has highest priority)
                  </Text>
                )}
                <Text variant="bodyMd" as="p">
                  • <strong>Rule Types:</strong>{" "}
                  <Badge tone="critical" size="small">
                    Exclude
                  </Badge>{" "}
                  removes collections,{" "}
                  <Badge tone="success" size="small">
                    Include
                  </Badge>{" "}
                  adds them back
                </Text>
                <Text variant="bodyMd" as="p">
                  • <strong>Apply Rules:</strong> Click on individual discounts
                  or use &quot;Apply to All&quot; to update all at once
                </Text>
                {planLimit.planName !== "FREE" && (
                  <Text variant="bodyMd" as="p">
                    • <strong>Scheduling:</strong> Some rules may only be active
                    during specific time periods
                  </Text>
                )}
                {planLimit.planName !== "FREE" && (
                  <Text variant="bodyMd" as="p">
                    • <strong>🌟 Premium:</strong> Use &quot;Specific Rule&quot;
                    to apply individual rules for granular control
                  </Text>
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {planLimit.planName === "FREE" && activeRules.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="attention">Premium Feature</Badge>
                  <Text variant="headingSm" as="h3">
                    🌟 Apply Specific Rules
                  </Text>
                </InlineStack>
                <Text variant="bodyMd" as="p">
                  Want more control? Apply individual rules to specific
                  discounts instead of all rules at once!
                </Text>
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    <strong>✨ With Basic or Pro plan you can:</strong>
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Test single rules without interference from others
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Apply different strategies to different discounts
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Fine-tune your discount targeting
                  </Text>
                </BlockStack>
                <Button
                  variant="primary"
                  size="slim"
                  onClick={() => navigate("/app/pricing")}
                >
                  View Pricing
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
