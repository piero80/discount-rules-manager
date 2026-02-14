import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  ResourceList,
  ResourceItem,
  Text,
  InlineStack,
  Badge,
  Button,
  ButtonGroup,
  Icon,
  Tooltip,
  BlockStack,
} from "@shopify/polaris";
import {
  DeleteIcon,
  ClockIcon,
  DragHandleIcon,
  ViewIcon,
} from "@shopify/polaris-icons";

// Types
interface Rule {
  id: string;
  name: string;
  description?: string;
  mode: "exclude" | "include";
  priority: number;
  active: boolean;
  isScheduled: boolean;
  scheduledStart?: string;
  scheduledEnd?: string;
  excludedCollections: Array<{
    id: string;
    title: string;
    productsCount: number;
  }>;
}

interface MultipleRulesListProps {
  rules: Rule[];
  onDelete: (ruleId: string) => void;
  onToggleActive: (ruleId: string, active: boolean) => void;
  planLimit?: {
    current: number;
    max: number;
    planName: string;
  };
}

export function MultipleRulesList({
  rules,
  onDelete,
  onToggleActive,
  planLimit,
}: MultipleRulesListProps) {
  const navigate = useNavigate();
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const toggleExpanded = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const formatSchedule = (rule: Rule) => {
    if (!rule.isScheduled) return "Always Active";

    const start = rule.scheduledStart ? new Date(rule.scheduledStart) : null;
    const end = rule.scheduledEnd ? new Date(rule.scheduledEnd) : null;

    const formatDateTime = (date: Date) => {
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    };

    if (start && end) {
      return `${formatDateTime(start)} - ${formatDateTime(end)}`;
    } else if (start) {
      return `From ${formatDateTime(start)}`;
    } else if (end) {
      return `Until ${formatDateTime(end)}`;
    }
    return "Custom Schedule";
  };

  const isRuleCurrentlyActive = (rule: Rule) => {
    if (!rule.active || !rule.isScheduled) return rule.active;

    const now = new Date();
    const start = rule.scheduledStart ? new Date(rule.scheduledStart) : null;
    const end = rule.scheduledEnd ? new Date(rule.scheduledEnd) : null;

    if (start && now < start) return false;
    if (end && now > end) return false;

    return true;
  };

  return (
    <Card>
      <div style={{ padding: "1rem 0" }}>
        <Text variant="headingMd" as="h2">
          Discount Rules ({rules.length})
        </Text>
        <Text variant="bodyMd" as="p" tone="subdued">
          {planLimit?.planName === "FREE"
            ? "Rules can be manually enabled/disabled. Upgrade to Basic for priority management and scheduling features."
            : "Rules can be manually enabled/disabled and are automatically activated based on their schedule. A rule is active only if enabled AND within its scheduled time window."}
        </Text>
      </div>

      {rules.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <Text variant="bodyMd" tone="subdued" as="span">
            No rules created yet. Create your first rule to get started.
          </Text>
        </div>
      ) : (
        <ResourceList
          resourceName={{ singular: "rule", plural: "rules" }}
          items={rules}
          renderItem={(rule) => {
            const isExpanded = expandedRules.has(rule.id);
            const currentlyActive = isRuleCurrentlyActive(rule);

            return (
              <ResourceItem
                id={rule.id}
                onClick={() => toggleExpanded(rule.id)}
                accessibilityLabel={`Rule ${rule.name}`}
              >
                <div style={{ width: "100%" }}>
                  {/* Main Rule Info */}
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <Icon source={DragHandleIcon} tone="subdued" />

                      <div>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="headingSm" as="h3">
                            {rule.name}
                          </Text>

                          <Badge
                            size="small"
                            tone={
                              rule.mode === "exclude" ? "critical" : "success"
                            }
                          >
                            {rule.mode === "exclude"
                              ? "Exclude"
                              : "Include Only"}
                          </Badge>

                          {planLimit?.planName !== "FREE" && (
                            <Badge
                              size="small"
                              tone={currentlyActive ? "success" : "info"}
                            >
                              {`Priority ${rule.priority.toString()}`}
                            </Badge>
                          )}

                          {rule.isScheduled &&
                            planLimit?.planName !== "FREE" && (
                              <Tooltip content={formatSchedule(rule)}>
                                <Badge
                                  size="small"
                                  tone="info"
                                  icon={ClockIcon}
                                >
                                  Scheduled
                                </Badge>
                              </Tooltip>
                            )}

                          <Badge
                            size="small"
                            tone={rule.active ? "success" : "critical"}
                          >
                            {rule.active ? "Enabled" : "Disabled"}
                          </Badge>

                          <Badge
                            size="small"
                            tone={currentlyActive ? "success" : "info"}
                          >
                            {currentlyActive
                              ? "Currently Active"
                              : "Currently Inactive"}
                          </Badge>
                        </InlineStack>

                        {rule.description && (
                          <Text variant="bodyMd" tone="subdued" as="span">
                            {rule.description}
                          </Text>
                        )}
                      </div>
                    </InlineStack>

                    <ButtonGroup>
                      <Button
                        size="micro"
                        variant="tertiary"
                        icon={ViewIcon}
                        onClick={() => {
                          navigate(`/app/rules/${rule.id}`);
                        }}
                        accessibilityLabel="View rule details"
                      >
                        View
                      </Button>
                      <Button
                        size="micro"
                        variant="tertiary"
                        tone={rule.active ? "critical" : "success"}
                        onClick={() => {
                          onToggleActive(rule.id, !rule.active);
                        }}
                        accessibilityLabel={
                          rule.active
                            ? "Disable rule (can still be scheduled)"
                            : "Enable rule"
                        }
                      >
                        {rule.active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="micro"
                        variant="tertiary"
                        tone="critical"
                        icon={DeleteIcon}
                        onClick={() => {
                          if (
                            confirm(
                              `Are you sure you want to delete "${rule.name}"?`,
                            )
                          ) {
                            onDelete(rule.id);
                          }
                        }}
                        accessibilityLabel="Delete rule"
                      />
                    </ButtonGroup>
                  </InlineStack>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ marginTop: "1rem", paddingLeft: "2rem" }}>
                      <InlineStack gap="400">
                        <div>
                          <Text
                            variant="bodyMd"
                            fontWeight="semibold"
                            as="span"
                          >
                            Collections ({rule.excludedCollections.length})
                          </Text>
                          <div style={{ marginTop: "0.5rem" }}>
                            {rule.excludedCollections.length === 0 ? (
                              <Text variant="bodyMd" tone="subdued" as="span">
                                No collections configured
                              </Text>
                            ) : (
                              rule.excludedCollections.map((collection) => (
                                <Badge key={collection.id} size="small">
                                  {`${collection.title} (${collection.productsCount.toString()})`}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>

                        {rule.isScheduled && planLimit?.planName !== "FREE" && (
                          <div>
                            <Text
                              variant="bodyMd"
                              fontWeight="semibold"
                              as="h4"
                            >
                              Schedule
                            </Text>
                            <Text variant="bodyMd" tone="subdued" as="span">
                              {formatSchedule(rule)}
                            </Text>
                          </div>
                        )}
                      </InlineStack>
                    </div>
                  )}
                </div>
              </ResourceItem>
            );
          }}
        />
      )}

      {/* Upgrade prompt for FREE users */}
      {planLimit?.planName === "FREE" && rules.length > 0 && (
        <div
          style={{
            padding: "1rem",
            borderTop: "1px solid #e1e3e5",
            marginTop: "1rem",
          }}
        >
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <Badge tone="attention">Premium Features</Badge>
              <Text variant="headingSm" as="h3">
                🌟 Unlock Advanced Rule Management
              </Text>
            </InlineStack>
            <Text variant="bodyMd" as="p">
              Want more control over your rules? Upgrade to Basic or Pro plan
              for:
            </Text>
            <BlockStack gap="100">
              <Text variant="bodySm" as="p">
                • 🎯 <strong>Priority Management:</strong> Set custom order of
                rule execution
              </Text>
              <Text variant="bodySm" as="p">
                • ⏰ <strong>Rule Scheduling:</strong> Automatically
                activate/deactivate rules by date & time
              </Text>
              <Text variant="bodySm" as="p">
                • 🔧 <strong>Apply Specific Rules:</strong> Target individual
                discounts with specific rules
              </Text>
            </BlockStack>
          </BlockStack>
        </div>
      )}
    </Card>
  );
}
