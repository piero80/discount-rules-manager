import { useState } from "react";
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  DataTable,
  Button,
  Banner,
  Icon,
  Tooltip,
} from "@shopify/polaris";
import { InfoIcon, ClockIcon, CheckIcon } from "@shopify/polaris-icons";

export interface ActiveRule {
  id: string;
  name: string;
  mode: "exclude" | "include";
  priority: number;
  isScheduled: boolean;
  scheduledStart?: string;
  scheduledEnd?: string;
  excludedCount: number;
  excludedCollections?: Array<{
    id: string;
    title: string;
    productsCount: number;
  }>;
}

interface MultipleRulesManagerProps {
  activeRules: ActiveRule[];
  onEditRules: () => void;
  onApplyRules: () => void;
  isLoading?: boolean;
}

export function MultipleRulesManager({
  activeRules,
  onEditRules,
  onApplyRules,
  isLoading = false,
}: MultipleRulesManagerProps) {
  const [showDetails, setShowDetails] = useState(false);

  const isRuleCurrentlyActive = (rule: ActiveRule) => {
    if (!rule.isScheduled) return true;

    const now = new Date();
    const start = rule.scheduledStart ? new Date(rule.scheduledStart) : null;
    const end = rule.scheduledEnd ? new Date(rule.scheduledEnd) : null;

    if (start && now < start) return false;
    if (end && now > end) return false;

    return true;
  };

  const currentlyActiveCount: number = activeRules.filter((rule) =>
    isRuleCurrentlyActive(rule),
  ).length;
  const hasInactiveRules = currentlyActiveCount < activeRules.length;

  const getRuleStatusBadge = (rule: ActiveRule) => {
    const isCurrentlyActive = isRuleCurrentlyActive(rule);

    if (rule.isScheduled) {
      if (!isCurrentlyActive) {
        return (
          <Tooltip content="This rule is enabled but currently inactive due to scheduling">
            <Badge tone="critical" icon={ClockIcon}>
              Currently Inactive
            </Badge>
          </Tooltip>
        );
      }
      return (
        <Tooltip content="This rule is active during scheduled times">
          <Badge tone="warning" icon={ClockIcon}>
            Scheduled
          </Badge>
        </Tooltip>
      );
    }
    return (
      <Badge tone="success" icon={CheckIcon}>
        Always Active
      </Badge>
    );
  };

  const getModeBadge = (mode: "exclude" | "include") => {
    return (
      <Badge tone={mode === "exclude" ? "critical" : "success"}>
        {mode === "exclude" ? "Exclude" : "Include"}
      </Badge>
    );
  };

  const getPriorityBadge = (index: number) => {
    const priority = index + 1;
    return (
      <Badge
        tone={priority === 1 ? "attention" : "info"}
      >{`#${priority}`}</Badge>
    );
  };

  if (activeRules.length === 0) {
    return (
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <InlineStack gap="200" blockAlign="center">
                <Text variant="headingMd" as="h2">
                  Discount Rules
                </Text>
                <Tooltip content="No active rules configured. Create rules to automatically manage collections in your discounts.">
                  <Icon source={InfoIcon} tone="subdued" />
                </Tooltip>
              </InlineStack>
              <Text variant="bodySm" tone="subdued" as="p">
                No active rules configured
              </Text>
            </BlockStack>
            <Badge tone="warning">0 active</Badge>
          </InlineStack>

          <Banner tone="info">
            <BlockStack gap="200">
              <Text variant="bodyMd" as="p">
                <strong>Ready to create discount rules?</strong>
              </Text>
              <Text variant="bodySm" as="p">
                Create rules to automatically manage which collections are
                included or excluded from your discounts. Rules can be scheduled
                to activate during specific time periods.
              </Text>
            </BlockStack>
          </Banner>

          <InlineStack gap="300" align="space-between">
            <Text variant="bodySm" tone="subdued" as="p">
              Create your first rule to get started
            </Text>
            <Button variant="primary" size="slim" onClick={onEditRules}>
              Create Rules
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  }

  const rows = activeRules.map((rule, index) => [
    getPriorityBadge(index),
    <Text key={`name-${rule.id}`} as="span" fontWeight="semibold">
      {rule.name}
    </Text>,
    getModeBadge(rule.mode),
    <Text
      key={`collections-${rule.id}`}
      as="span"
      variant="bodySm"
      tone="subdued"
    >
      {rule.excludedCount} collection{rule.excludedCount !== 1 ? "s" : ""}
    </Text>,
    getRuleStatusBadge(rule),
  ]);

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <InlineStack gap="200" blockAlign="center">
              <Text variant="headingMd" as="h2">
                Active Discount Rules
              </Text>
              <Tooltip content="Rules are applied in priority order. Priority #1 has the highest precedence.">
                <Icon source={InfoIcon} tone="subdued" />
              </Tooltip>
            </InlineStack>
            <Text variant="bodySm" tone="subdued" as="p">
              {currentlyActiveCount} of {activeRules.length} rule
              {activeRules.length !== 1 ? "s" : ""} currently active
              {hasInactiveRules && " (some rules inactive due to scheduling)"}
            </Text>
          </BlockStack>
          <InlineStack gap="200">
            <Badge tone={hasInactiveRules ? "warning" : "info"}>
              {`${currentlyActiveCount} currently active${hasInactiveRules ? ` of ${activeRules.length}` : ""}`}
            </Badge>
            <Button size="slim" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? "Hide Details" : "Show Details"}
            </Button>
          </InlineStack>
        </InlineStack>

        {showDetails && (
          <Banner tone="info">
            <BlockStack gap="200">
              <Text variant="bodyMd" as="p">
                <strong>Rule Application Order:</strong>
              </Text>
              {activeRules.map((rule, index) => {
                const isCurrentlyActive = isRuleCurrentlyActive(rule);
                return (
                  <BlockStack key={rule.id} gap="100">
                    <Text variant="bodySm" as="p">
                      {index + 1}. <strong>{rule.name}</strong> (
                      {getModeBadge(rule.mode)}) -
                      {rule.mode === "exclude" ? " Removes" : " Adds back"}{" "}
                      {rule.excludedCount} collection
                      {rule.excludedCount !== 1 ? "s" : ""}
                      {rule.excludedCollections &&
                        rule.excludedCollections.length > 0 &&
                        rule.excludedCollections.map((collection) => (
                          <Badge
                            key={collection.id}
                            tone={rule.mode === "exclude" ? "new" : "success"}
                            size="small"
                          >
                            {collection.title}
                          </Badge>
                        ))}
                      {!isCurrentlyActive && (
                        <Badge tone="critical" size="small">
                          Currently Inactive
                        </Badge>
                      )}
                    </Text>
                    {/* {rule.excludedCollections &&
                      rule.excludedCollections.length > 0 && (
                        <InlineStack gap="100" wrap>
                          <Text variant="bodyXs" tone="subdued" as="span">
                            Collections:
                          </Text>
                          {rule.excludedCollections.map((collection) => (
                            <Badge
                              key={collection.id}
                              tone={
                                rule.mode === "exclude" ? "critical" : "success"
                              }
                              size="small"
                            >
                              {collection.title}
                            </Badge>
                          ))}
                        </InlineStack>
                      )} */}
                  </BlockStack>
                );
              })}
            </BlockStack>
          </Banner>
        )}

        {hasInactiveRules && (
          <Banner tone="warning">
            <BlockStack gap="200">
              <Text variant="bodyMd" as="p">
                <strong>Some rules are currently inactive</strong>
              </Text>
              <Text variant="bodySm" as="p">
                {activeRules.length - currentlyActiveCount} of your enabled
                rules are currently inactive due to scheduling. These rules will
                automatically activate during their scheduled time windows.
              </Text>
            </BlockStack>
          </Banner>
        )}

        <DataTable
          columnContentTypes={["text", "text", "text", "text", "text"]}
          headings={["Priority", "Rule Name", "Mode", "Collections", "Status"]}
          rows={rows}
        />

        <InlineStack gap="300" align="space-between">
          <Text variant="bodySm" tone="subdued" as="p">
            Rules are processed in priority order when applying to discounts
          </Text>
          <InlineStack gap="200">
            <Button size="slim" onClick={onEditRules}>
              Manage Rules
            </Button>
            <Button
              variant="primary"
              size="slim"
              onClick={onApplyRules}
              loading={isLoading}
            >
              Apply All Rules
            </Button>
          </InlineStack>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
