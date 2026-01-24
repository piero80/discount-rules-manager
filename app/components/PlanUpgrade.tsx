import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  List,
  Divider,
} from "@shopify/polaris";
import { PLAN_CONFIGS } from "../services/subscription.server";

interface PlanUpgradeProps {
  currentPlan: string;
  onUpgrade: (plan: "BASIC" | "PRO") => void;
  onCancel: () => void;
}

export function PlanUpgrade({
  currentPlan,
  onUpgrade,
  onCancel,
}: PlanUpgradeProps) {
  return (
    <Card>
      <BlockStack gap="500">
        <Text variant="headingLg" as="h2">
          Upgrade Your Plan
        </Text>

        <Text variant="bodyMd" tone="subdued" as="p">
          You&apos;ve reached your current plan limit. Choose a plan that fits
          your needs:
        </Text>

        <BlockStack gap="400">
          {/* Basic Plan */}
          <Card
            background={
              currentPlan === "FREE" ? "bg-surface-selected" : "bg-surface"
            }
          >
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="start">
                <div>
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingMd" as="h3">
                      {PLAN_CONFIGS.BASIC.name} Plan
                    </Text>
                    <Badge tone="success">Recommended</Badge>
                  </InlineStack>
                  <Text variant="bodyLg" fontWeight="semibold" as="p">
                    ${PLAN_CONFIGS.BASIC.price}/month
                  </Text>
                </div>
                <Button
                  variant={currentPlan === "FREE" ? "primary" : "secondary"}
                  onClick={() => onUpgrade("BASIC")}
                >
                  Upgrade to Basic
                </Button>
              </InlineStack>

              <List type="bullet">
                {PLAN_CONFIGS.BASIC.features.map((feature, index) => (
                  <List.Item key={index}>{feature}</List.Item>
                ))}
              </List>
            </BlockStack>
          </Card>

          {/* Pro Plan */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="start">
                <div>
                  <Text variant="headingMd" as="h3">
                    {PLAN_CONFIGS.PRO.name} Plan
                  </Text>
                  <Text variant="bodyLg" fontWeight="semibold" as="p">
                    ${PLAN_CONFIGS.PRO.price}/month
                  </Text>
                </div>
                <Button variant="secondary" onClick={() => onUpgrade("PRO")}>
                  Upgrade to Pro
                </Button>
              </InlineStack>

              <List type="bullet">
                {PLAN_CONFIGS.PRO.features.map((feature, index) => (
                  <List.Item key={index}>{feature}</List.Item>
                ))}
              </List>
            </BlockStack>
          </Card>
        </BlockStack>

        <Divider />

        <InlineStack align="end">
          <Button onClick={onCancel}>Maybe Later</Button>
        </InlineStack>

        <Text variant="bodyMd" tone="subdued" as="p">
          All plans include a 7-day free trial. You can cancel anytime.
        </Text>
      </BlockStack>
    </Card>
  );
}
