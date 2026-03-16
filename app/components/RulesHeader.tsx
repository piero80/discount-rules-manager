import {
  Card,
  Text,
  InlineStack,
  Button,
  Badge,
  Divider,
} from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { useNavigate } from "react-router";

interface RuleStats {
  hasRules: boolean;
  rulesCount: number;
  lastActivity: string | null;
}

interface RulesHeaderProps {
  ruleStats: RuleStats;
  planLimit?: {
    current: number;
    max: number;
    planName: string;
  };
}

export function RulesHeader({ ruleStats, planLimit }: RulesHeaderProps) {
  const navigate = useNavigate();
  // TODO: Temporarily disable plan limits during development
  const isAtLimit = false;
  // const isAtLimit = planLimit && planLimit.current >= planLimit.max;

  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center">
        <div>
          <Text variant="headingLg" as="h1">
            Discount Rules Management
          </Text>
          <InlineStack gap="200" blockAlign="center">
            <Text variant="bodyMd" tone="subdued" as="span">
              {planLimit?.planName === "Free"
                ? "Manage your discount rules settings"
                : "Manage multiple rules with priority and scheduling"}
            </Text>

            <Divider />

            <Badge tone="info">
              {`${ruleStats.rulesCount.toString()} Active Rules`}
            </Badge>

            {planLimit && (
              <Badge tone={isAtLimit ? "critical" : "success"} size="small">
                {`${planLimit.current}/${planLimit.max} Rules (${planLimit.planName})`}
              </Badge>
            )}

            {ruleStats.lastActivity && (
              <Text variant="bodyMd" tone="subdued" as="span">
                Last updated:{" "}
                {new Date(ruleStats.lastActivity).toLocaleDateString()}
              </Text>
            )}
          </InlineStack>
        </div>

        <div>
          <Button
            variant="primary"
            icon={PlusIcon}
            onClick={() => navigate("/app/rules/new")}
            disabled={isAtLimit}
            accessibilityLabel="Create new rule"
          >
            {isAtLimit ? "Limit Reached" : "New Rule"}
          </Button>

          {isAtLimit && planLimit && (
            <Text variant="bodyMd" tone="critical" alignment="center" as="p">
              Upgrade to{" "}
              {planLimit.planName === "Free" ? "Starter" : "Professional"} for
              more rules
            </Text>
          )}
        </div>
      </InlineStack>
    </Card>
  );
}
