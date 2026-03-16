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
import { PLAN_CONFIGS } from "../config/plans";

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
              currentPlan === "free" ? "bg-surface-selected" : "bg-surface"
            }
          >
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="start">
                <div>
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingMd" as="h3">
                      {PLAN_CONFIGS.starter.name} Plan
                    </Text>
                    <Badge tone="success">Entry Level</Badge>
                  </InlineStack>
                  <Text variant="bodyLg" fontWeight="semibold" as="p">
                    ${PLAN_CONFIGS.starter.price}/month
                  </Text>
                </div>
                <Form method="post" action="/app/billing">
                  <input type="hidden" name="action" value="upgrade" />
                  <input type="hidden" name="plan" value="starter" />
                  <Button
                    submit
                    variant={currentPlan === "free" ? "primary" : "secondary"}
                  >
                    Upgrade to Starter
                  </Button>
                </Form>
              </InlineStack>

              <List type="bullet">
                {PLAN_CONFIGS.starter.features.map((feature, index) => (
                  <List.Item key={index}>{feature}</List.Item>
                ))}
              </List>
            </BlockStack>
          </Card>

          {/* Professional Plan */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="start">
                <div>
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingMd" as="h3">
                      {PLAN_CONFIGS.professional.name} Plan
                    </Text>
                    <Badge tone="info">Most Popular</Badge>
                  </InlineStack>
                  <Text variant="bodyLg" fontWeight="semibold" as="p">
                    ${PLAN_CONFIGS.professional.price}/month
                  </Text>
                </div>
                <Form method="post" action="/app/billing">
                  <input type="hidden" name="action" value="upgrade" />
                  <input type="hidden" name="plan" value="professional" />
                  <Button submit variant="secondary">
                    Upgrade to Professional
                  </Button>
                </Form>
              </InlineStack>

              <List type="bullet">
                {PLAN_CONFIGS.professional.features.map((feature, index) => (
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
          All paid plans include a 7-day free trial. You can cancel anytime.
        </Text>
      </BlockStack>
    </Card>
  );
}
