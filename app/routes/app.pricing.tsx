import { useState, useEffect } from "react";
import {
  data,
  useLoaderData,
  useActionData,
  useSubmit,
  useNavigate,
  useNavigation,
  redirect,
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
  Icon,
  Divider,
  Toast,
  Frame,
} from "@shopify/polaris";
import { CheckIcon, StarFilledIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { SubscriptionService } from "../services/subscription.server";
import { PLAN_CONFIGS, type PlanName } from "../config/plans";

interface ActionData {
  success: boolean;
  message: string;
  error?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get current subscription info
  const subscription = await SubscriptionService.getSubscription(session.shop);
  const isInTrial = await SubscriptionService.isInTrial(session.shop);

  // Safety check for subscription data
  const safeSubscription = {
    planName: subscription?.planName || "free",
    status: subscription?.status || "ACTIVE",
    maxRules: subscription?.maxRules || PLAN_CONFIGS.free.maxRules,
    trialEndsAt: subscription?.trialEndsAt,
    currentPeriodEnd: subscription?.currentPeriodEnd,
  };

  return data({
    currentPlan: {
      ...safeSubscription,
      isInTrial,
    },
    planConfig: PLAN_CONFIGS,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  // Redirect all billing actions to the billing page
  if (actionType === "changePlan" || actionType === "upgrade") {
    const plan = formData.get("planName") as PlanName;

    // For paid plans, redirect to billing page to handle Shopify billing
    if (plan && plan !== "free") {
      return redirect(`/app/billing?upgrade=${plan}`);
    }

    // Allow downgrade to free plan directly (no billing required)
    if (plan === "free") {
      try {
        await SubscriptionService.changePlan(session.shop, "free", null);
        return data({
          success: true,
          message: "Successfully downgraded to free plan",
        });
      } catch (error) {
        return data({
          success: false,
          message: "Failed to downgrade plan",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  if (actionType === "cancel") {
    // Redirect to billing page for subscription cancellation
    return redirect("/app/billing");
  }

  return data({
    success: false,
    message: "Invalid action",
  });
};

export default function PricingPage() {
  const { currentPlan, planConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [toastActive, setToastActive] = useState(false);

  const isLoading = navigation.state === "submitting";

  // Show toast when action completes
  useEffect(() => {
    if (actionData) {
      setToastActive(true);
    }
  }, [actionData]);

  const handlePlanChange = (planName: PlanName) => {
    const current = currentPlan.planName;
    const isDowngrade =
      (current === "enterprise" && planName !== "enterprise") ||
      (current === "professional" && ["starter", "free"].includes(planName)) ||
      (current === "starter" && planName === "free");

    const confirmMessage = isDowngrade
      ? `Are you sure you want to downgrade to ${planName}? Some features will be disabled.`
      : `Upgrade to ${planName} plan?`;

    if (isDowngrade && !confirm(confirmMessage)) {
      return;
    }

    const formData = new FormData();
    formData.append("actionType", "changePlan");
    formData.append("planName", planName);
    submit(formData, { method: "post" });
  };

  const renderPlanCard = (
    planKey: PlanName,
    isRecommended: boolean = false,
  ) => {
    const plan = planConfig[planKey];
    const isCurrent = currentPlan.planName === planKey;

    // Safety check to prevent undefined errors
    if (!plan) {
      console.error(`Plan configuration not found for key: ${planKey}`);
      return null;
    }

    return (
      <Card key={planKey}>
        <BlockStack gap="400">
          {/* Plan Header */}
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingLg" as="h2">
                {plan.name}
              </Text>
              {isRecommended && (
                <Badge tone="success" icon={StarFilledIcon}>
                  Recommended
                </Badge>
              )}
              {isCurrent && <Badge tone="info">Current Plan</Badge>}
            </InlineStack>

            <InlineStack gap="100" blockAlign="baseline">
              <Text variant="headingXl" as="h3">
                ${plan.price}
              </Text>
              <Text variant="bodyMd" tone="subdued" as="span">
                {plan.price > 0 ? "/month" : "Forever"}
              </Text>
            </InlineStack>

            {/* Free plan never has trial - no message needed */}
          </BlockStack>

          <Divider />

          {/* Features List */}
          <BlockStack gap="200">
            <Text variant="headingMd" as="h4">
              Features included:
            </Text>
            <BlockStack gap="100">
              {plan.features.map((feature, index) => (
                <InlineStack key={index} gap="200" blockAlign="center">
                  <Icon source={CheckIcon} tone="success" />
                  <Text variant="bodyMd" as="span">
                    {feature}
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>

          <Divider />

          {/* Action Button */}
          <BlockStack gap="200">
            {isCurrent ? (
              <Button fullWidth disabled>
                Current Plan
              </Button>
            ) : (
              <Button
                variant={
                  // Upgrade buttons are primary, downgrades are secondary
                  (planKey === "starter" && currentPlan.planName === "free") ||
                  (planKey === "professional" &&
                    !["professional", "enterprise"].includes(
                      currentPlan.planName,
                    )) ||
                  (planKey === "enterprise" &&
                    currentPlan.planName !== "enterprise")
                    ? "primary"
                    : "secondary"
                }
                tone={
                  // Downgrade buttons have critical tone
                  (planKey === "free" && currentPlan.planName !== "free") ||
                  (planKey === "starter" &&
                    ["professional", "enterprise"].includes(
                      currentPlan.planName,
                    )) ||
                  (planKey === "professional" &&
                    currentPlan.planName === "enterprise")
                    ? "critical"
                    : undefined
                }
                fullWidth
                onClick={() => handlePlanChange(planKey)}
                loading={isLoading}
                size="large"
              >
                {/* Dynamic button text based on current vs target plan */}
                {planKey === "free" && currentPlan.planName !== "free"
                  ? "Downgrade to Free"
                  : planKey === "starter" &&
                      ["professional", "enterprise"].includes(
                        currentPlan.planName,
                      )
                    ? "Downgrade to Starter"
                    : planKey === "professional" &&
                        currentPlan.planName === "enterprise"
                      ? "Downgrade to Professional"
                      : planKey === "starter" && currentPlan.planName === "free"
                        ? "Upgrade to Starter"
                        : planKey === "professional" &&
                            !["professional", "enterprise"].includes(
                              currentPlan?.planName,
                            )
                          ? "Upgrade to Professional"
                          : planKey === "enterprise" &&
                              currentPlan.planName !== "enterprise"
                            ? "Upgrade to Enterprise"
                            : `Choose ${plan?.name}`}
              </Button>
            )}

            {planKey !== "free" && (
              <Text
                variant="bodyMd"
                tone="subdued"
                alignment="center"
                as="span"
              >
                {PLAN_CONFIGS[planKey].trial
                  ? "✨ 7-day free trial • Cancel anytime"
                  : ""}
              </Text>
            )}
          </BlockStack>
        </BlockStack>
      </Card>
    );
  };

  // Show toast for action results
  const toastMarkup = actionData ? (
    <Toast
      content={actionData.message}
      onDismiss={() => setToastActive(false)}
      error={!actionData.success}
    />
  ) : null;

  return (
    <Frame>
      {toastMarkup}
      <Page
        title="Pricing Plans"
        backAction={{
          content: "Back to Dashboard",
          onAction: () => navigate("/app"),
        }}
      >
        <Layout>
          {/* Header Section */}
          <Layout.Section>
            <BlockStack gap="400" align="center">
              <Text variant="headingXl" as="h1" alignment="center">
                Choose Your Plan
              </Text>
              <Text
                variant="bodyLg"
                tone="subdued"
                alignment="center"
                as="span"
              >
                Start free and upgrade as you grow. All plans include full
                support.
              </Text>

              {currentPlan.isInTrial && currentPlan.planName !== "free" && (
                <Card>
                  <InlineStack gap="200" align="center">
                    <Icon source={StarFilledIcon} tone="success" />
                    <Text variant="bodyMd" as="span">
                      You&apos;re currently enjoying a 7-day free trial of all
                      premium features!
                    </Text>
                  </InlineStack>
                </Card>
              )}
            </BlockStack>
          </Layout.Section>

          {/* Pricing Cards */}
          <Layout.Section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1.5rem",
              }}
            >
              {renderPlanCard("free")}
              {renderPlanCard("starter")}
              {renderPlanCard("professional", true)}
              {renderPlanCard("enterprise")}
            </div>
          </Layout.Section>

          {/* FAQ Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Frequently Asked Questions
                </Text>

                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">
                      Can I change plans anytime?
                    </Text>
                    <Text variant="bodyMd" tone="subdued" as="span">
                      Yes! You can upgrade or downgrade your plan at any time.
                      Changes take effect immediately.
                    </Text>
                  </BlockStack>

                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">
                      Do you offer refunds?
                    </Text>
                    <Text variant="bodyMd" tone="subdued" as="span">
                      We offer a 7-day free trial for all paid plans. You can
                      cancel anytime during the trial with no charges.
                    </Text>
                  </BlockStack>

                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">
                      What happens to my rules if I downgrade?
                    </Text>
                    <Text variant="bodyMd" tone="subdued" as="span">
                      Your existing rules will remain but you won&apos;t be able
                      to create new ones beyond the plan limit. Premium features
                      like scheduling will be disabled.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>

      {/* Toast Notifications */}
      {actionData && toastActive && (
        <Toast
          content={actionData.message}
          onDismiss={() => setToastActive(false)}
          error={!actionData.success}
          duration={3000}
        />
      )}
    </Frame>
  );
}
