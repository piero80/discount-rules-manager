import { useState } from "react";
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
} from "@shopify/polaris";
import {
  EditIcon,
  DeleteIcon,
  ClockIcon,
  DragHandleIcon,
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
  onEdit: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggleActive: (ruleId: string, active: boolean) => void;
}

export function MultipleRulesList({
  rules,
  onEdit,
  onDelete,
  onToggleActive,
}: MultipleRulesListProps) {
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

    if (start && end) {
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    } else if (start) {
      return `From ${start.toLocaleDateString()}`;
    } else if (end) {
      return `Until ${end.toLocaleDateString()}`;
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
          Active Rules ({rules.length})
        </Text>
        <Text variant="bodyMd" as="p" tone="subdued">
          Rules are applied in priority order (lower numbers = higher priority)
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

                          <Badge
                            size="small"
                            tone={currentlyActive ? "success" : "info"}
                          >
                            {`Priority ${rule.priority.toString()}`}
                          </Badge>

                          {rule.isScheduled && (
                            <Tooltip content={formatSchedule(rule)}>
                              <Badge size="small" tone="info" icon={ClockIcon}>
                                Scheduled
                              </Badge>
                            </Tooltip>
                          )}

                          <Badge
                            size="small"
                            tone={currentlyActive ? "success" : "info"}
                          >
                            {currentlyActive ? "Active" : "Inactive"}
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
                        icon={EditIcon}
                        onClick={() => {
                          onEdit(rule.id);
                        }}
                        accessibilityLabel="Edit rule"
                      />
                      <Button
                        size="micro"
                        variant="tertiary"
                        tone={rule.active ? "critical" : "success"}
                        onClick={() => {
                          onToggleActive(rule.id, !rule.active);
                        }}
                        accessibilityLabel={
                          rule.active ? "Deactivate rule" : "Activate rule"
                        }
                      >
                        {rule.active ? "Deactivate" : "Activate"}
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

                        {rule.isScheduled && (
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
    </Card>
  );
}
