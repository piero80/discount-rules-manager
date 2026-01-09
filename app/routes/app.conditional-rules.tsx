import React, { useState, useCallback } from "react";
import {
  data,
  useLoaderData,
  useSubmit,
  useNavigate,
  useActionData,
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
  Banner,
  DataTable,
  EmptyState,
  Modal,
  Toast,
  Frame,
  Pagination,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { AdvancedRuleBuilder } from "../components/AdvancedRuleBuilder";
import type { ConditionalRule } from "../components/AdvancedRuleBuilder";
import { AdminApiContext } from "@shopify/shopify-app-react-router/server";

interface LoaderData {
  rules: ConditionalRule[];
  totalRules: number;
  page: number;
  pageSize: number;
}

interface ActionData {
  success: boolean;
  message: string;
  rule?: ConditionalRule;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = 10;

  try {
    const { conditionalRuleHelpers } = await import(
      "../services/conditional-rules.server"
    );
    const result = await conditionalRuleHelpers.getRules(
      session.shop,
      page,
      pageSize,
    );

    return data({
      rules: result.rules,
      totalRules: result.totalRules,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Error loading conditional rules:", error);

    // Fallback to empty rules on error
    return data({
      rules: [],
      totalRules: 0,
      page: 1,
      pageSize,
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    console.log("Action type:", actionType);

    const { conditionalRuleHelpers } = await import(
      "../services/conditional-rules.server"
    );

    if (actionType === "create" || actionType === "update") {
      const ruleDataString = formData.get("ruleData") as string;
      console.log("Raw rule data:", ruleDataString);

      if (!ruleDataString) {
        throw new Error("Rule data is missing");
      }

      let ruleData;
      try {
        ruleData = JSON.parse(ruleDataString);
        console.log("Parsed rule data:", ruleData);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        throw new Error(
          `Invalid rule data format: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}`,
        );
      }

      // Validate required fields
      if (!ruleData.name) {
        throw new Error("Rule name is required");
      }
      if (!ruleData.conditions || ruleData.conditions.length === 0) {
        throw new Error("At least one condition is required");
      }
      if (!ruleData.actions || ruleData.actions.length === 0) {
        throw new Error("At least one action is required");
      }

      if (actionType === "create") {
        console.log("Creating rule with data:", ruleData);
        const newRule = await conditionalRuleHelpers.createRule(
          session.shop,
          ruleData,
          admin,
        );
        console.log("Rule created successfully:", newRule);
        return data({
          success: true,
          message: "Conditional rule created successfully",
          rule: newRule,
        });
      } else {
        console.log("Updating rule with ID:", ruleData.id);
        if (!ruleData.id) {
          throw new Error("Rule ID is required for update");
        }
        const updatedRule = await conditionalRuleHelpers.updateRule(
          ruleData.id,
          ruleData,
          admin,
        );
        console.log("Rule updated successfully:", updatedRule);
        return data({
          success: true,
          message: "Conditional rule updated successfully",
          rule: updatedRule,
        });
      }
    }

    if (actionType === "delete") {
      const ruleId = formData.get("ruleId") as string;
      if (!ruleId) {
        throw new Error("Rule ID is required for delete");
      }
      console.log("Deleting rule with ID:", ruleId);
      await conditionalRuleHelpers.deleteRule(ruleId);

      return data({
        success: true,
        message: "Conditional rule deleted successfully",
      });
    }

    if (actionType === "toggle") {
      const ruleId = formData.get("ruleId") as string;
      const active = formData.get("active") === "true";
      if (!ruleId) {
        throw new Error("Rule ID is required for toggle");
      }
      console.log("Toggling rule with ID:", ruleId, "to:", active);
      await conditionalRuleHelpers.toggleRule(ruleId, active);

      return data({
        success: true,
        message: `Rule ${active ? "activated" : "deactivated"} successfully`,
      });
    }

    throw new Error(`Invalid action type: ${actionType}`);
  } catch (error) {
    console.error("Error processing conditional rule action:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return data({
      success: false,
      message: `An error occurred: ${errorMessage}`,
    });
  }
};

export default function ConditionalRules() {
  const { rules, totalRules, page, pageSize } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const navigate = useNavigate();

  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<ConditionalRule | undefined>();
  const [showToast, setShowToast] = useState(false);

  // Handle rule save
  const handleRuleSave = useCallback(
    (rule: ConditionalRule) => {
      try {
        console.log("Saving rule:", rule);

        // Validate rule data before submit
        if (!rule.name || rule.name.trim() === "") {
          console.error("Rule name is required");
          return;
        }

        if (!rule.conditions || rule.conditions.length === 0) {
          console.error("At least one condition is required");
          return;
        }

        if (!rule.actions || rule.actions.length === 0) {
          console.error("At least one action is required");
          return;
        }

        const actionType = rule.id ? "update" : "create";

        // Clean and validate rule data
        const cleanRule = {
          ...rule,
          id: rule.id || undefined, // Ensure clean ID
          name: rule.name.trim(),
          description: rule.description?.trim() || "",
          active: Boolean(rule.active),
          priority: Number(rule.priority) || 1,
          maxUsagePerCustomer: rule.maxUsagePerCustomer
            ? Number(rule.maxUsagePerCustomer)
            : undefined,
          maxTotalUsage: rule.maxTotalUsage
            ? Number(rule.maxTotalUsage)
            : undefined,
          conditions: rule.conditions.map((condition, index) => ({
            ...condition,
            id: condition.id || `condition_${index}`,
            value: condition.value,
            logicOperator: condition.logicOperator || "AND",
            negated: Boolean(condition.negated),
          })),
          actions: rule.actions.map((action, index) => ({
            ...action,
            id: action.id || `action_${index}`,
            value: action.value,
          })),
        };

        console.log("Clean rule data:", cleanRule);

        submit(
          {
            actionType,
            ruleData: JSON.stringify(cleanRule),
          },
          { method: "post" },
        );

        setShowRuleBuilder(false);
        setEditingRule(undefined);
      } catch (error) {
        console.error("Error in handleRuleSave:", error);
        // Show error to user
        alert(
          `Error saving rule: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
    [submit],
  );

  // Handle rule delete
  const handleRuleDelete = useCallback(
    (ruleId: string) => {
      if (confirm("Are you sure you want to delete this rule?")) {
        submit(
          {
            actionType: "delete",
            ruleId,
          },
          { method: "post" },
        );
      }
    },
    [submit],
  );

  // Handle rule toggle
  const handleRuleToggle = useCallback(
    (ruleId: string, active: boolean) => {
      submit(
        {
          actionType: "toggle",
          ruleId,
          active: String(active),
        },
        { method: "post" },
      );
    },
    [submit],
  );

  // Table rows
  const tableRows = rules.map((rule) => [
    <InlineStack gap="200" key={rule.id}>
      <Text as="span" variant="bodyMd" fontWeight="medium">
        {rule.name}
      </Text>
      <Badge tone={rule.active ? "success" : undefined}>
        {rule.active ? "Active" : "Inactive"}
      </Badge>
      <Badge tone="info">{"Priority: " + String(rule.priority)}</Badge>
    </InlineStack>,
    <Text as="span" key="description" tone="subdued">
      {rule.description || "No description"}
    </Text>,
    <InlineStack gap="100" key="stats">
      <Badge tone="info">
        {String(rule.conditions.length) + " conditions"}
      </Badge>
      <Badge tone="success">{String(rule.actions.length) + " actions"}</Badge>
    </InlineStack>,
    <InlineStack gap="100" key="actions">
      <Button
        size="micro"
        onClick={() => {
          setEditingRule(rule);
          setShowRuleBuilder(true);
        }}
      >
        Edit
      </Button>
      <Button
        size="micro"
        tone={rule.active ? "critical" : "success"}
        onClick={() => handleRuleToggle(rule.id!, !rule.active)}
      >
        {rule.active ? "Disable" : "Enable"}
      </Button>
      <Button
        size="micro"
        tone="critical"
        onClick={() => handleRuleDelete(rule.id!)}
      >
        Delete
      </Button>
    </InlineStack>,
  ]);

  // Show success toast
  React.useEffect(() => {
    if (actionData?.success) {
      setShowToast(true);
    }
  }, [actionData]);

  const toastMarkup =
    showToast && actionData?.message ? (
      <Toast
        content={actionData.message}
        onDismiss={() => setShowToast(false)}
      />
    ) : null;

  const emptyStateMarkup =
    rules.length === 0 ? (
      <EmptyState
        heading="Create your first conditional rule"
        action={{
          content: "Create rule",
          onAction: () => {
            setEditingRule(undefined);
            setShowRuleBuilder(true);
          },
        }}
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <Text as="p" tone="subdued">
          Set up advanced discount logic with multiple conditions and actions
          that go beyond Shopify&apos;s native discount features.
        </Text>
      </EmptyState>
    ) : null;

  const rulesTableMarkup =
    rules.length > 0 ? (
      <Card>
        <DataTable
          columnContentTypes={["text", "text", "text", "text"]}
          headings={["Rule", "Description", "Configuration", "Actions"]}
          rows={tableRows}
        />
        {totalRules > pageSize && (
          <div
            style={{
              padding: "16px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Pagination
              hasNext={page * pageSize < totalRules}
              hasPrevious={page > 1}
              onNext={() => navigate(`?page=${page + 1}`)}
              onPrevious={() => navigate(`?page=${page - 1}`)}
            />
          </div>
        )}
      </Card>
    ) : null;

  const ruleBuilderMarkup = showRuleBuilder ? (
    <Modal
      size="large"
      open={showRuleBuilder}
      onClose={() => {
        setShowRuleBuilder(false);
        setEditingRule(undefined);
      }}
      title={editingRule ? "Edit Conditional Rule" : "Create Conditional Rule"}
    >
      <Modal.Section>
        <AdvancedRuleBuilder
          rule={editingRule}
          onSave={handleRuleSave}
          onCancel={() => {
            setShowRuleBuilder(false);
            setEditingRule(undefined);
          }}
        />
      </Modal.Section>
    </Modal>
  ) : null;

  return (
    <Frame>
      {toastMarkup}
      <Page
        title="Conditional Discount Rules"
        subtitle="Create advanced discount logic with multiple conditions and dynamic actions"
        primaryAction={{
          content: "Create Rule",
          onAction: () => {
            setEditingRule(undefined);
            setShowRuleBuilder(true);
          },
        }}
        secondaryActions={[
          {
            content: "Rule Templates",
            onAction: () => {
              // TODO: Navigate to templates page
            },
          },
          {
            content: "Performance Analytics",
            onAction: () => {
              // TODO: Navigate to analytics page
            },
          },
        ]}
      >
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Advanced Conditional Logic
                  </Text>
                  <Text as="p" tone="subdued">
                    Create sophisticated discount rules that combine multiple
                    conditions with logical operators. Go beyond Shopify&apos;s
                    native capabilities with customer segmentation, cart
                    analysis, temporal conditions, and dynamic discount
                    calculations.
                  </Text>
                  <InlineStack gap="400">
                    <div>
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        Total Rules: {String(totalRules)}
                      </Text>
                    </div>
                    <div>
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        Active Rules:{" "}
                        {String(rules.filter((r) => r.active).length)}
                      </Text>
                    </div>
                  </InlineStack>
                </BlockStack>
              </Card>

              {actionData && !actionData.success && (
                <Banner tone="critical" title="Error">
                  {actionData.message}
                </Banner>
              )}

              {emptyStateMarkup}
              {rulesTableMarkup}
            </BlockStack>
          </Layout.Section>
        </Layout>

        {ruleBuilderMarkup}
      </Page>
    </Frame>
  );
}
