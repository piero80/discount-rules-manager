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
import { Form } from "react-router";
import { PLAN_CONFIGS } from "../services/subscription.server";

interface PlanUpgradeProps {
  currentPlan: string;
  onCancel: () => void;
}

export function PlanUpgrade({ currentPlan, onCancel }: PlanUpgradeProps) {
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
                <Form method="post" action="/app/billing">
                  <input type="hidden" name="action" value="upgrade" />
                  <input type="hidden" name="plan" value="BASIC" />
                  <Button
                    submit
                    variant={currentPlan === "FREE" ? "primary" : "secondary"}
                  >
                    Upgrade to Basic
                  </Button>
                </Form>
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
                <Form method="post" action="/app/billing">
                  <input type="hidden" name="action" value="upgrade" />
                  <input type="hidden" name="plan" value="PRO" />
                  <Button submit variant="secondary">
                    Upgrade to Pro
                  </Button>
                </Form>
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
