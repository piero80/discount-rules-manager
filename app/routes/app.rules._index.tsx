import { useState, useCallback, useEffect } from "react";
import {
  data,
  useLoaderData,
  useSubmit,
  // useNavigation,
  useNavigate,
  useActionData,
} from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { Page, Layout, Toast, Frame } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import type { Session } from "@shopify/shopify-api";
import { discountRuleHelpers } from "../services/db.server";
import { SubscriptionService } from "../services/subscription.server";
import { MultipleRulesList } from "../components/MultipleRulesList";
import { RulesHeader } from "../components/RulesHeader";

// Types
// interface Rule {
//   id: string;
//   name: string;
//   description?: string;
//   mode: "exclude" | "include";
//   priority: number;
//   active: boolean;
//   isScheduled: boolean;
//   scheduledStart?: string;
//   scheduledEnd?: string;
//   excludedCollections: Array<{
//     id: string;
//     title: string;
//     productsCount: number;
//   }>;
// }

// interface RuleStats {
//   hasRules: boolean;
//   rulesCount: number;
//   lastActivity: string | null;
// }

interface ActionData {
  success: boolean;
  message: string;
  ruleId?: string;
}

// Loader: Fetch rules from database
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get all rules from database (active and inactive to allow management)
  const allRules = await discountRuleHelpers.getAllRules(session.shop);
  const ruleStats = await discountRuleHelpers.getRuleStats(session.shop);

  // Get subscription limits for plan enforcement
  const planLimit = await SubscriptionService.getPlanLimits(session.shop);

  return data({
    // Support for multiple rules
    allRules: allRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description || undefined,
      mode: rule.mode as "exclude" | "include",
      priority: rule.priority,
      active: rule.active,
      isScheduled: rule.isScheduled,
      scheduledStart: rule.scheduledStart?.toISOString(),
      scheduledEnd: rule.scheduledEnd?.toISOString(),
      excludedCollections: rule.excludedCollections.map((exc) => ({
        id: exc.collectionId,
        title: exc.title,
        productsCount: exc.productsCount,
      })),
    })),
    ruleStats: {
      hasRules: ruleStats.hasRules,
      rulesCount: ruleStats.rulesCount,
      lastActivity: ruleStats.lastActivity,
    },
    planLimit, // Add plan limits to the response
  });
};

// Action: Handle rule operations (delete, toggle only)
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const actionType = formData.get("actionType");

  if (actionType === "deleteRule") {
    return handleRuleDelete(session, formData);
  }

  if (actionType === "toggleRule") {
    return handleRuleToggle(session, formData);
  }

  return data({ success: false, message: "Invalid action" }, { status: 400 });
};

// Component
export default function RulesPage(): JSX.Element {
  const { allRules, ruleStats, planLimit } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  // const navigation = useNavigation();
  const navigate = useNavigate();

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  // const isLoading = navigation.state === "submitting";

  // Handle action results
  useEffect(() => {
    if (actionData) {
      setToastMessage(actionData.message);
      setToastError(!actionData.success);
      setToastActive(true);
    }
  }, [actionData]);

  const handleDeleteRule = useCallback(
    (ruleId: string) => {
      const formData = new FormData();
      formData.append("actionType", "deleteRule");
      formData.append("ruleId", ruleId);
      submit(formData, { method: "post" });
    },
    [submit],
  );

  const handleToggleActive = useCallback(
    (ruleId: string, active: boolean) => {
      const formData = new FormData();
      formData.append("actionType", "toggleRule");
      formData.append("ruleId", ruleId);
      formData.append("active", active.toString());
      submit(formData, { method: "post" });
    },
    [submit],
  );

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      onDismiss={() => setToastActive(false)}
      error={toastError}
    />
  ) : null;

  return (
    <Frame>
      {toastMarkup}
      <Page
        title="Discount Rules"
        backAction={{
          content: "Dashboard",
          onAction: () => navigate("/app"),
        }}
      >
        <Layout>
          <Layout.Section>
            <RulesHeader ruleStats={ruleStats} planLimit={planLimit} />
          </Layout.Section>

          {allRules.length > 0 && (
            <Layout.Section>
              <MultipleRulesList
                rules={allRules}
                onDelete={handleDeleteRule}
                onToggleActive={handleToggleActive}
                planLimit={planLimit}
              />
            </Layout.Section>
          )}
        </Layout>
      </Page>
    </Frame>
  );
}

// Helper functions for rule operations
async function handleRuleDelete(session: Session, formData: FormData) {
  try {
    const ruleId = formData.get("ruleId") as string;

    if (!ruleId) {
      return data(
        { success: false, message: "Rule ID required" },
        { status: 400 },
      );
    }

    await discountRuleHelpers.deleteRule(ruleId);

    await discountRuleHelpers.logAction(session.shop, "rule_deleted", ruleId, {
      timestamp: new Date().toISOString(),
    });

    return data({
      success: true,
      message: "Rule deleted successfully!",
    });
  } catch (error) {
    return data(
      { success: false, message: "Failed to delete rule. Please try again." },
      { status: 500 },
    );
  }
}

async function handleRuleToggle(session: Session, formData: FormData) {
  try {
    const ruleId = formData.get("ruleId") as string;
    const active = formData.get("active") === "true";

    if (!ruleId) {
      return data(
        { success: false, message: "Rule ID required" },
        { status: 400 },
      );
    }

    await discountRuleHelpers.updateRule(ruleId, { active });

    await discountRuleHelpers.logAction(session.shop, "rule_toggled", ruleId, {
      active,
      timestamp: new Date().toISOString(),
    });

    return data({
      success: true,
      message: `Rule ${active ? "activated" : "deactivated"} successfully!`,
    });
  } catch (error) {
    return data(
      { success: false, message: "Failed to toggle rule. Please try again." },
      { status: 500 },
    );
  }
}
