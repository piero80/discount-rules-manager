import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import {
  data,
  redirect,
  useLoaderData,
  useActionData,
  Form,
} from "react-router";
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Banner,
} from "@shopify/polaris";
import { ShopifyBillingService } from "../services/shopify-billing.server";
import { SubscriptionService } from "../services/subscription.server";
import { authenticate } from "../shopify.server";

interface ActionData {
  success?: string;
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  // Get current subscription info
  const url = new URL(request.url);
  const upgradeParam = url.searchParams.get("upgrade"); // Check if coming from pricing page

  const subscription = await SubscriptionService.getSubscription(session.shop);
  const billingInfo = await ShopifyBillingService.getBillingInfo(request);

  return data({
    subscription,
    billingInfo,
    suggestedUpgrade: upgradeParam, // Pass suggested upgrade to UI
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);

  const formData = await request.formData();
  const action = formData.get("action") as string;
  const plan = formData.get("plan") as "BASIC" | "PRO";

  try {
    switch (action) {
      case "upgrade": {
        if (!plan) {
          return data({ error: "Plan is required" }, { status: 400 });
        }

        const result = await ShopifyBillingService.createRecurringCharge(
          request,
          plan,
        );

        if (result.success && result.confirmationUrl) {
          // Redirect user to Shopify billing confirmation
          return redirect(result.confirmationUrl);
        } else {
          return data({
            error: result.error || "Failed to create billing plan",
          });
        }
      }

      case "cancel": {
        const result = await ShopifyBillingService.cancelCharge(request);

        if (result.success) {
          return data({ success: "Plan canceled successfully" });
        } else {
          return data({ error: result.error || "Failed to cancel plan" });
        }
      }

      default:
        return data({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("❌ Billing action error:", error);
    return data({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export default function BillingPage() {
  const { subscription, billingInfo, suggestedUpgrade } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  return (
    <BlockStack gap="500">
      <Text variant="headingLg" as="h1">
        Billing & Subscription
      </Text>

      {actionData?.error && (
        <Banner tone="critical">
          <Text as="p">{actionData.error}</Text>
        </Banner>
      )}

      {actionData?.success && (
        <Banner tone="success">
          <Text as="p">{actionData.success}</Text>
        </Banner>
      )}

      {/* Current Plan Card */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">
            Current Plan
          </Text>

          <InlineStack gap="200" blockAlign="center">
            <Text variant="bodyLg" fontWeight="semibold" as="p">
              {subscription.planName} Plan
            </Text>
            <Text variant="bodyMd" tone="subdued" as="p">
              • {subscription.maxRules} max rules
            </Text>
          </InlineStack>

          {billingInfo && (
            <BlockStack gap="200">
              <Text variant="bodyMd" as="p">
                Status:{" "}
                <Text fontWeight="semibold" as="span">
                  {billingInfo.status}
                </Text>
              </Text>
              <Text variant="bodyMd" as="p">
                Price:{" "}
                <Text fontWeight="semibold" as="span">
                  ${billingInfo.price}/month
                </Text>
              </Text>
              {billingInfo.trial_ends_on && (
                <Text variant="bodyMd" tone="subdued" as="p">
                  Trial ends:{" "}
                  {new Date(billingInfo.trial_ends_on).toLocaleDateString()}
                </Text>
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      {/* Upgrade Options */}
      {subscription.planName === "FREE" && (
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Upgrade Your Plan
            </Text>

            {suggestedUpgrade && (
              <Banner tone="info">
                <Text as="p">Ready to upgrade to {suggestedUpgrade} plan?</Text>
              </Banner>
            )}

            <InlineStack gap="400">
              <Form method="post">
                <input type="hidden" name="action" value="upgrade" />
                <input type="hidden" name="plan" value="BASIC" />
                <Button
                  submit
                  variant={
                    suggestedUpgrade === "BASIC" ? "primary" : "secondary"
                  }
                >
                  Upgrade to Basic ($7.99/month)
                </Button>
              </Form>

              <Form method="post">
                <input type="hidden" name="action" value="upgrade" />
                <input type="hidden" name="plan" value="PRO" />
                <Button
                  submit
                  variant={suggestedUpgrade === "PRO" ? "primary" : "secondary"}
                >
                  Upgrade to Pro ($19.99/month)
                </Button>
              </Form>
            </InlineStack>
          </BlockStack>
        </Card>
      )}

      {/* Cancel Subscription */}
      {subscription.planName !== "FREE" && (
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Cancel Subscription
            </Text>

            <Text variant="bodyMd" tone="subdued" as="p">
              You will be downgraded to the Free plan and your billing will
              stop.
            </Text>

            <Form method="post">
              <input type="hidden" name="action" value="cancel" />
              <Button submit tone="critical">
                Cancel Subscription
              </Button>
            </Form>
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );
}
