import { useState, useEffect } from "react";
import {
  data,
  useLoaderData,
  useActionData,
  useSubmit,
  useNavigation,
  useNavigate,
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
  DataTable,
  Banner,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  getDiscountCodes,
  applyRuleToPriceRule,
  applyRuleToAllPriceRules,
} from "../services/discount.server";

interface DiscountWithCodes {
  id: string;
  title: string;
  value_type: string;
  value: string;
  discount_codes: Array<{ code: string; usage_count: number }>;
  collections_count: number;
  target_selection: string;
}

interface LoaderData {
  discounts: DiscountWithCodes[];
  hasActiveRule: boolean;
}

interface ActionData {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discounts = await getDiscountCodes(admin as any);

  console.log(discounts, "discounts");

  // Check if shop has active rule
  const { discountRuleHelpers } = await import("../services/db.server");
  const activeRule = await discountRuleHelpers.getActiveRule(session.shop);

  return data({
    discounts,
    hasActiveRule: !!activeRule,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const priceRuleId = formData.get("priceRuleId");

  if (actionType === "applyToOne" && priceRuleId) {
    const result = await applyRuleToPriceRule(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      session.shop,
      priceRuleId as string,
    );
    return data(result);
  }

  if (actionType === "applyToAll") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyRuleToAllPriceRules(admin as any, session.shop);
    return data({
      success: result.success > 0,
      message: `Applied to ${result.success} of ${result.total} discounts`,
      details: result,
    });
  }

  return data({
    success: false,
    message: "Invalid action",
  });
};

export default function DiscountsPage() {
  const { discounts, hasActiveRule } = useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData | undefined;
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(true);
  const [loadingDiscountId, setLoadingDiscountId] = useState<string | null>(
    null,
  );

  // Reset loading state when navigation completes
  useEffect(() => {
    if (navigation.state === "idle") {
      setLoadingDiscountId(null);
    }
  }, [navigation.state]);

  const handleApplyToOne = (priceRuleId: string) => {
    setLoadingDiscountId(priceRuleId);
    const formData = new FormData();
    formData.append("actionType", "applyToOne");
    formData.append("priceRuleId", priceRuleId);
    submit(formData, { method: "post" });
  };

  const handleApplyToAll = () => {
    setLoadingDiscountId("all");
    const formData = new FormData();
    formData.append("actionType", "applyToAll");
    submit(formData, { method: "post" });
  };

  const rows = discounts.map((discount) => [
    <Text key={`title-${discount.id}`} as="span" fontWeight="semibold">
      {discount.title}
    </Text>,
    <InlineStack key={`codes-${discount.id}`} gap="100" wrap={false}>
      {discount.discount_codes.map((code) => (
        <Badge key={code.code} tone="info">
          {code.code}
        </Badge>
      ))}
    </InlineStack>,
    <Badge
      key={`value-${discount.id}`}
      tone={discount.value_type === "percentage" ? "success" : "attention"}
    >
      {discount.value_type === "percentage"
        ? `${discount.value}%`
        : `$${discount.value}`}
    </Badge>,
    <Text
      key={`collections-${discount.id}`}
      as="span"
      variant="bodySm"
      tone="subdued"
    >
      {discount.collections_count} collections
    </Text>,
    <Button
      key={`button-${discount.id}`}
      size="slim"
      onClick={() => handleApplyToOne(discount.id)}
      loading={loadingDiscountId === discount.id}
    >
      Apply Rules
    </Button>,
  ]);

  if (!hasActiveRule) {
    return (
      <Page
        title="Smart Discount Manager"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
        secondaryActions={[
          {
            content: "Create Rules",
            onAction: () => navigate("/app/rules"),
          },
        ]}
      >
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="No active exclusion rules"
              action={{
                content: "Create Rules",
                onAction: () => navigate("/app/rules"),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                You need to create exclusion rules before applying them to
                discounts.
              </p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (discounts.length === 0) {
    return (
      <Page
        title="Smart Discount Manager"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
        secondaryActions={[
          {
            content: "Edit Rules",
            onAction: () => navigate("/app/rules"),
          },
        ]}
      >
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="No discount codes found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Create discount codes in your Shopify admin, then return here to
                apply your exclusion rules.
              </p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Smart Discount Manager"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      primaryAction={{
        content: "Apply Rules to All",
        onAction: handleApplyToAll,
        loading: loadingDiscountId === "all",
        disabled: discounts.length === 0,
      }}
      secondaryActions={[
        {
          content: "Edit Rules",
          onAction: () => navigate("/app/rules"),
        },
      ]}
    >
      <Layout>
        {actionData && showBanner && (
          <Layout.Section>
            <Banner
              tone={actionData.success ? "success" : "critical"}
              onDismiss={() => setShowBanner(false)}
            >
              <p>{actionData.message}</p>
              {actionData.details && (
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm">
                    Success:{" "}
                    {(actionData.details as { success: number }).success} /
                    Failed: {(actionData.details as { failed: number }).failed}
                  </Text>
                </BlockStack>
              )}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">
                    Your Discount Codes
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Apply your exclusion rules to existing discount codes
                  </Text>
                </BlockStack>
                <Badge tone="info">{`${discounts.length} total`}</Badge>
              </InlineStack>

              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text"]}
                headings={[
                  "Discount Name",
                  "Codes",
                  "Value",
                  "Collections",
                  "Action",
                ]}
                rows={rows}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">
                💡 How it works
              </Text>
              <BlockStack gap="200">
                <Text variant="bodyMd" as="p">
                  • Click <strong>Apply Rules</strong> on individual discounts
                  to apply your exclusion rules
                </Text>
                <Text variant="bodyMd" as="p">
                  • Use <strong>Apply Rules to All</strong> to update all
                  discounts at once
                </Text>
                <Text variant="bodyMd" as="p">
                  • Excluded collections will be automatically removed from the
                  discount&apos;s eligible items
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
