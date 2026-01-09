import React, { useState, useCallback } from "react";
import {
  Card,
  Button,
  TextField,
  Select,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Collapsible,
  Banner,
  ChoiceList,
  ButtonGroup,
} from "@shopify/polaris";
import {
  PlusIcon,
  DeleteIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@shopify/polaris-icons";

// Types for conditional rules
export interface RuleCondition {
  id: string;
  conditionType: string;
  operator: string;
  value:
    | string
    | string[]
    | number
    | { method?: string; config?: Record<string, unknown> };
  logicOperator: "AND" | "OR";
  negated?: boolean;
  parentId?: string;
}

export interface RuleAction {
  id: string;
  actionType: string;
  target?: string;
  value: Record<string, unknown>;
  maxAmount?: number;
}

export interface ConditionalRule {
  id?: string;
  name: string;
  description?: string;
  active: boolean;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  maxUsagePerCustomer?: number;
  maxTotalUsage?: number;
  startDate?: Date;
  endDate?: Date;
}

// Condition types configuration
const CONDITION_TYPES = {
  customer: {
    label: "Customer Conditions",
    options: [
      { value: "customer_tag", label: "Customer has tag" },
      { value: "customer_is_vip", label: "🌟 Customer is VIP (Smart)" },
      { value: "customer_vip_score", label: "🎯 VIP Score" },
      { value: "customer_email", label: "Customer email" },
      { value: "customer_orders_count", label: "Number of orders" },
      { value: "customer_total_spent", label: "Total spent" },
      { value: "customer_location", label: "Customer location" },
      { value: "customer_account_age", label: "Account age (days)" },
    ],
  },
  cart: {
    label: "Cart Conditions",
    options: [
      { value: "cart_total", label: "Cart total value" },
      { value: "cart_quantity", label: "Total quantity" },
      { value: "cart_weight", label: "Total weight" },
      { value: "cart_contains_product", label: "Contains specific product" },
      {
        value: "cart_contains_collection",
        label: "Contains products from collection",
      },
      { value: "cart_product_tags", label: "Products with tags" },
    ],
  },
  product: {
    label: "Product Conditions",
    options: [
      { value: "product_tag", label: "Product has tag" },
      { value: "product_type", label: "Product type" },
      { value: "product_vendor", label: "Product vendor" },
      { value: "product_price", label: "Product price" },
      { value: "product_inventory", label: "Inventory level" },
      { value: "product_created_date", label: "Product created date" },
    ],
  },
  temporal: {
    label: "Time Conditions",
    options: [
      { value: "day_of_week", label: "Day of week" },
      { value: "time_of_day", label: "Time of day" },
      { value: "date_range", label: "Date range" },
      { value: "days_since_signup", label: "Days since customer signup" },
      { value: "season", label: "Season" },
    ],
  },
};

const OPERATORS = {
  string: [
    { value: "equals", label: "equals" },
    { value: "contains", label: "contains" },
    { value: "starts_with", label: "starts with" },
    { value: "ends_with", label: "ends with" },
    { value: "in_list", label: "is one of" },
  ],
  number: [
    { value: "equals", label: "equals" },
    { value: "greater_than", label: "greater than" },
    { value: "less_than", label: "less than" },
    { value: "between", label: "between" },
  ],
  date: [
    { value: "before", label: "before" },
    { value: "after", label: "after" },
    { value: "on", label: "on" },
    { value: "between", label: "between" },
  ],
  boolean: [
    { value: "is_true", label: "is true" },
    { value: "is_false", label: "is false" },
  ],
};

const ACTION_TYPES = {
  discount: {
    label: "Discount Actions",
    options: [
      { value: "percentage_discount", label: "Percentage discount" },
      { value: "fixed_discount", label: "Fixed amount discount" },
      { value: "free_shipping", label: "Free shipping" },
      { value: "buy_x_get_y", label: "Buy X Get Y" },
    ],
  },
  products: {
    label: "Product Actions",
    options: [
      { value: "gift_product", label: "Gift product" },
      { value: "product_discount", label: "Discount specific products" },
      { value: "collection_discount", label: "Discount collection" },
    ],
  },
};

interface AdvancedRuleBuilderProps {
  rule?: ConditionalRule;
  onSave: (rule: ConditionalRule) => void;
  onCancel: () => void;
}

export const AdvancedRuleBuilder: React.FC<AdvancedRuleBuilderProps> = ({
  rule,
  onSave,
  onCancel,
}) => {
  const [currentRule, setCurrentRule] = useState<ConditionalRule>(
    rule || {
      name: "",
      description: "",
      active: true,
      priority: 0,
      conditions: [],
      actions: [],
    },
  );

  const [expandedConditions, setExpandedConditions] = useState<Set<string>>(
    new Set(),
  );

  // Add new condition
  const addCondition = useCallback((parentId?: string) => {
    const newCondition: RuleCondition = {
      id: `condition_${Date.now()}`,
      conditionType: "",
      operator: "",
      value: "",
      logicOperator: "AND",
      parentId,
    };

    setCurrentRule((prev) => ({
      ...prev,
      conditions: [...prev.conditions, newCondition],
    }));
  }, []);

  // Update condition
  const updateCondition = useCallback(
    (id: string, updates: Partial<RuleCondition>) => {
      setCurrentRule((prev) => ({
        ...prev,
        conditions: prev.conditions.map((condition) =>
          condition.id === id ? { ...condition, ...updates } : condition,
        ),
      }));
    },
    [],
  );

  // Remove condition
  const removeCondition = useCallback((id: string) => {
    setCurrentRule((prev) => ({
      ...prev,
      conditions: prev.conditions.filter(
        (condition) => condition.id !== id && condition.parentId !== id,
      ),
    }));
  }, []);

  // Add new action
  const addAction = useCallback(() => {
    const newAction: RuleAction = {
      id: `action_${Date.now()}`,
      actionType: "",
      value: {},
    };

    setCurrentRule((prev) => ({
      ...prev,
      actions: [...prev.actions, newAction],
    }));
  }, []);

  // Update action
  const updateAction = useCallback(
    (id: string, updates: Partial<RuleAction>) => {
      setCurrentRule((prev) => ({
        ...prev,
        actions: prev.actions.map((action) =>
          action.id === id ? { ...action, ...updates } : action,
        ),
      }));
    },
    [],
  );

  // Remove action
  const removeAction = useCallback((id: string) => {
    setCurrentRule((prev) => ({
      ...prev,
      actions: prev.actions.filter((action) => action.id !== id),
    }));
  }, []);

  // Render condition input based on type
  const renderConditionInput = useCallback(
    (condition: RuleCondition) => {
      const conditionConfig = Object.values(CONDITION_TYPES)
        .flatMap((category) => category.options)
        .find((opt) => opt.value === condition.conditionType);

      if (!conditionConfig) return null;

      // Special handling for VIP conditions
      if (condition.conditionType === "customer_is_vip") {
        return (
          <InlineStack gap="200">
            <div style={{ minWidth: "150px" }}>
              <Select
                label="VIP Detection Method"
                options={[
                  { value: "tag", label: "By Tag (VIP, Premium, etc.)" },
                  { value: "spending", label: "By Total Spending" },
                  { value: "orders", label: "By Order Count" },
                  { value: "combined", label: "Smart Combined Criteria" },
                  { value: "custom", label: "Custom Metafields" },
                ]}
                value={
                  typeof condition.value === "object" &&
                  condition.value !== null &&
                  !Array.isArray(condition.value) &&
                  "method" in condition.value
                    ? condition.value.method || "tag"
                    : "tag"
                }
                onChange={(value) =>
                  updateCondition(condition.id, {
                    value: { method: value, config: {} },
                    operator: "is_true",
                  })
                }
              />
            </div>
            {typeof condition.value === "object" &&
              condition.value !== null &&
              !Array.isArray(condition.value) &&
              "method" in condition.value &&
              condition.value.method === "spending" && (
                <div style={{ flexGrow: 1 }}>
                  <TextField
                    label="Minimum Spending ($)"
                    type="number"
                    autoComplete="off"
                    value={String(
                      (condition.value as { config?: { threshold?: number } })
                        .config?.threshold || 1000,
                    )}
                    onChange={(value) =>
                      updateCondition(condition.id, {
                        value: {
                          ...(condition.value as object),
                          config: { threshold: Number(value) },
                        },
                      })
                    }
                  />
                </div>
              )}
            {typeof condition.value === "object" &&
              condition.value !== null &&
              !Array.isArray(condition.value) &&
              "method" in condition.value &&
              condition.value.method === "orders" && (
                <div style={{ flexGrow: 1 }}>
                  <TextField
                    label="Minimum Orders"
                    type="number"
                    autoComplete="off"
                    value={String(
                      (condition.value as { config?: { minOrders?: number } })
                        .config?.minOrders || 10,
                    )}
                    onChange={(value) =>
                      updateCondition(condition.id, {
                        value: {
                          ...(condition.value as object),
                          config: { minOrders: Number(value) },
                        },
                      })
                    }
                  />
                </div>
              )}
          </InlineStack>
        );
      }

      if (condition.conditionType === "customer_vip_score") {
        return (
          <InlineStack gap="200">
            <div style={{ minWidth: "150px" }}>
              <Select
                label="Operator"
                options={[
                  { value: "greater_than", label: "Greater than" },
                  {
                    value: "greater_than_or_equal",
                    label: "Greater than or equal",
                  },
                  { value: "less_than", label: "Less than" },
                  { value: "equals", label: "Equals" },
                ]}
                value={condition.operator}
                onChange={(value) =>
                  updateCondition(condition.id, { operator: value })
                }
              />
            </div>
            <div style={{ flexGrow: 1 }}>
              <TextField
                label="VIP Score (0-100)"
                type="number"
                autoComplete="off"
                suffix="points"
                value={String(condition.value)}
                onChange={(value) =>
                  updateCondition(condition.id, { value: Number(value) })
                }
                helpText="70+ = High VIP, 50+ = Medium VIP, <50 = Regular"
              />
            </div>
          </InlineStack>
        );
      }

      // Determine input type based on condition
      const getInputType = () => {
        if (
          condition.conditionType.includes("count") ||
          condition.conditionType.includes("total") ||
          condition.conditionType.includes("age") ||
          condition.conditionType.includes("inventory") ||
          condition.conditionType.includes("score")
        ) {
          return "number";
        }
        if (condition.conditionType.includes("date")) {
          return "date";
        }
        return "string";
      };

      const inputType = getInputType();
      const operators = OPERATORS[inputType] || OPERATORS.string;

      return (
        <InlineStack gap="200">
          <div style={{ minWidth: "150px" }}>
            <Select
              label="Operator"
              options={operators}
              value={condition.operator}
              onChange={(value) =>
                updateCondition(condition.id, { operator: value })
              }
            />
          </div>
          <div style={{ flexGrow: 1 }}>
            {inputType === "number" ? (
              <TextField
                label="Value"
                type="number"
                autoComplete="off"
                value={String(condition.value)}
                onChange={(value) =>
                  updateCondition(condition.id, { value: Number(value) })
                }
              />
            ) : inputType === "date" ? (
              <TextField
                label="Date"
                type="date"
                autoComplete="off"
                value={String(condition.value)}
                onChange={(value) => updateCondition(condition.id, { value })}
              />
            ) : (
              <TextField
                label="Value"
                autoComplete="off"
                value={String(condition.value)}
                onChange={(value) => updateCondition(condition.id, { value })}
                multiline={condition.operator === "in_list"}
                helpText={
                  condition.operator === "in_list"
                    ? "Enter values separated by commas"
                    : undefined
                }
              />
            )}
          </div>
        </InlineStack>
      );
    },
    [updateCondition],
  );

  // Render single condition
  const renderCondition = useCallback(
    (condition: RuleCondition, index: number) => {
      const isExpanded = expandedConditions.has(condition.id);

      return (
        <Card key={condition.id}>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <InlineStack gap="200">
                {index > 0 && (
                  <Badge
                    tone={
                      condition.logicOperator === "AND" ? "info" : "warning"
                    }
                  >
                    {condition.logicOperator}
                  </Badge>
                )}
                <Text as="h3" variant="headingMd">
                  Condition {index + 1}
                  {condition.negated && <Badge tone="critical">NOT</Badge>}
                </Text>
              </InlineStack>
              <ButtonGroup>
                <Button
                  icon={isExpanded ? ChevronUpIcon : ChevronDownIcon}
                  onClick={() => {
                    const newExpanded = new Set(expandedConditions);
                    if (isExpanded) {
                      newExpanded.delete(condition.id);
                    } else {
                      newExpanded.add(condition.id);
                    }
                    setExpandedConditions(newExpanded);
                  }}
                />
                <Button
                  icon={DeleteIcon}
                  onClick={() => removeCondition(condition.id)}
                  tone="critical"
                />
              </ButtonGroup>
            </InlineStack>

            <Collapsible open={isExpanded} id={`condition-${condition.id}`}>
              <BlockStack gap="300">
                {index > 0 && (
                  <ChoiceList
                    title="Logic operator"
                    choices={[
                      {
                        label: "AND - All conditions must be true",
                        value: "AND",
                      },
                      { label: "OR - Any condition can be true", value: "OR" },
                    ]}
                    selected={[condition.logicOperator]}
                    onChange={(selected) =>
                      updateCondition(condition.id, {
                        logicOperator: selected[0] as "AND" | "OR",
                      })
                    }
                  />
                )}

                <Select
                  label="Condition type"
                  options={Object.values(CONDITION_TYPES).map((category) => ({
                    title: category.label,
                    options: category.options,
                  }))}
                  value={condition.conditionType}
                  onChange={(value) =>
                    updateCondition(condition.id, {
                      conditionType: value,
                      operator: "",
                      value: "",
                    })
                  }
                />

                {condition.conditionType && renderConditionInput(condition)}

                <ChoiceList
                  title="Advanced options"
                  allowMultiple
                  choices={[
                    { label: "Negate this condition (NOT)", value: "negated" },
                  ]}
                  selected={condition.negated ? ["negated"] : []}
                  onChange={(selected) =>
                    updateCondition(condition.id, {
                      negated: selected.includes("negated"),
                    })
                  }
                />
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Card>
      );
    },
    [
      expandedConditions,
      removeCondition,
      updateCondition,
      renderConditionInput,
    ],
  );

  // Render action
  const renderAction = useCallback(
    (action: RuleAction, index: number) => {
      return (
        <Card key={action.id}>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingMd">
                Action {index + 1}
              </Text>
              <Button
                icon={DeleteIcon}
                onClick={() => removeAction(action.id)}
                tone="critical"
              />
            </InlineStack>

            <Select
              label="Action type"
              options={Object.values(ACTION_TYPES).map((category) => ({
                title: category.label,
                options: category.options,
              }))}
              value={action.actionType}
              onChange={(value) =>
                updateAction(action.id, {
                  actionType: value,
                  value: {},
                })
              }
            />

            {action.actionType === "percentage_discount" && (
              <TextField
                label="Discount percentage"
                type="number"
                autoComplete="off"
                suffix="%"
                value={String(action.value.percentage || "")}
                onChange={(value) =>
                  updateAction(action.id, {
                    value: { ...action.value, percentage: Number(value) },
                  })
                }
              />
            )}

            {action.actionType === "fixed_discount" && (
              <TextField
                label="Discount amount"
                type="number"
                autoComplete="off"
                prefix="$"
                value={String(action.value.amount || "")}
                onChange={(value) =>
                  updateAction(action.id, {
                    value: { ...action.value, amount: Number(value) },
                  })
                }
              />
            )}

            {(action.actionType === "percentage_discount" ||
              action.actionType === "fixed_discount") && (
              <TextField
                label="Maximum discount amount (optional)"
                type="number"
                autoComplete="off"
                prefix="$"
                value={String(action.maxAmount || "")}
                onChange={(value) =>
                  updateAction(action.id, {
                    maxAmount: value ? Number(value) : undefined,
                  })
                }
                helpText="Leave empty for no maximum"
              />
            )}
          </BlockStack>
        </Card>
      );
    },
    [removeAction, updateAction],
  );

  const handleSave = useCallback(() => {
    if (!currentRule.name.trim()) {
      return; // Show validation error
    }

    if (currentRule.conditions.length === 0) {
      return; // Show validation error
    }

    if (currentRule.actions.length === 0) {
      return; // Show validation error
    }

    onSave(currentRule);
  }, [currentRule, onSave]);

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingLg">
            Rule Configuration
          </Text>

          <InlineStack gap="400">
            <div style={{ flexGrow: 1 }}>
              <TextField
                label="Rule name"
                autoComplete="off"
                value={currentRule.name}
                onChange={(value) =>
                  setCurrentRule((prev) => ({ ...prev, name: value }))
                }
                placeholder="e.g., VIP Customer Weekend Discount"
              />
            </div>
            <div style={{ minWidth: "120px" }}>
              <TextField
                label="Priority"
                type="number"
                autoComplete="off"
                value={String(currentRule.priority)}
                onChange={(value) =>
                  setCurrentRule((prev) => ({
                    ...prev,
                    priority: Number(value),
                  }))
                }
                helpText="Higher numbers = higher priority"
              />
            </div>
          </InlineStack>

          <TextField
            label="Description (optional)"
            autoComplete="off"
            value={currentRule.description || ""}
            onChange={(value) =>
              setCurrentRule((prev) => ({ ...prev, description: value }))
            }
            multiline={3}
            placeholder="Describe what this rule does and when it should apply"
          />

          <InlineStack gap="400">
            <TextField
              label="Max uses per customer"
              type="number"
              autoComplete="off"
              value={String(currentRule.maxUsagePerCustomer || "")}
              onChange={(value) =>
                setCurrentRule((prev) => ({
                  ...prev,
                  maxUsagePerCustomer: value ? Number(value) : undefined,
                }))
              }
              placeholder="Unlimited"
            />
            <TextField
              label="Max total uses"
              type="number"
              autoComplete="off"
              value={String(currentRule.maxTotalUsage || "")}
              onChange={(value) =>
                setCurrentRule((prev) => ({
                  ...prev,
                  maxTotalUsage: value ? Number(value) : undefined,
                }))
              }
              placeholder="Unlimited"
            />
          </InlineStack>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text as="h2" variant="headingLg">
              Conditions ({currentRule.conditions.length})
            </Text>
            <Button icon={PlusIcon} onClick={() => addCondition()}>
              Add Condition
            </Button>
          </InlineStack>

          {currentRule.conditions.length === 0 ? (
            <Banner tone="info">
              <Text as="p">
                Add conditions that must be met for this rule to apply. You can
                combine multiple conditions with AND/OR logic.
              </Text>
            </Banner>
          ) : (
            <BlockStack gap="300">
              {currentRule.conditions.map((condition, index) =>
                renderCondition(condition, index),
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text as="h2" variant="headingLg">
              Actions ({currentRule.actions.length})
            </Text>
            <Button icon={PlusIcon} onClick={addAction}>
              Add Action
            </Button>
          </InlineStack>

          {currentRule.actions.length === 0 ? (
            <Banner tone="info">
              <Text as="p">
                Define what happens when all conditions are met. You can apply
                multiple actions.
              </Text>
            </Banner>
          ) : (
            <BlockStack gap="300">
              {currentRule.actions.map((action, index) =>
                renderAction(action, index),
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      <Card>
        <InlineStack align="end" gap="300">
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={
              !currentRule.name.trim() ||
              currentRule.conditions.length === 0 ||
              currentRule.actions.length === 0
            }
          >
            Save Rule
          </Button>
        </InlineStack>
      </Card>
    </BlockStack>
  );
};
