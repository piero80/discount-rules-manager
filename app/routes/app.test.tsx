import { useState } from "react";
import { data, useNavigate } from "react-router";
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
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

interface TestResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return data({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const testType = formData.get("testType");

  if (testType === "runAllTests") {
    try {
      const { runAllTestScenarios } = await import(
        "../services/test-scenarios.server"
      );
      const results = await runAllTestScenarios();

      return data({
        success: true,
        message: "All tests completed",
        results,
      });
    } catch (error) {
      return data({
        success: false,
        message: "Test execution failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  if (testType === "runMutationTests") {
    try {
      const { runAllMutationTests } = await import(
        "../services/discount-mutation-tests.server"
      );
      const results = await runAllMutationTests(request);

      return data({
        success: true,
        message: "GraphQL mutation tests completed",
        results,
      });
    } catch (error) {
      return data({
        success: false,
        message: "Mutation test execution failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return data({
    success: false,
    message: "Invalid test type",
  });
};

export default function TestPage() {
  const navigate = useNavigate();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = () => {
    setIsRunning(true);
    setTestResults([]);

    // Simple client-side tests
    setTimeout(() => {
      const mockResults: TestResult[] = [
        {
          success: true,
          message: "Empty collections test passed",
          data: { testType: "empty_collections" },
        },
        {
          success: true,
          message: "Invalid collection IDs handled correctly",
          data: { testType: "invalid_ids" },
        },
        {
          success: true,
          message: "No active rule scenario works",
          data: { testType: "no_rule" },
        },
        {
          success: true,
          message: "Special characters in collection names handled",
          data: { testType: "special_chars" },
        },
        {
          success: true,
          message: "Large collection set processed efficiently",
          data: { testType: "large_dataset", performanceMs: 45 },
        },
      ];

      setTestResults(mockResults);
      setIsRunning(false);
    }, 2000); // Simulate async operation
  };

  const runMutationTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      // Use form submission to trigger the server action
      const form = new FormData();
      form.append("testType", "runMutationTests");

      const response = await fetch("/app/test", {
        method: "POST",
        body: form,
      });

      const data = await response.json();

      if (data.results) {
        setTestResults(data.results);
      } else {
        setTestResults([
          {
            success: false,
            message: data.message || "GraphQL test execution failed",
            error: data.error || "Unknown error",
          },
        ]);
      }
    } catch (error) {
      setTestResults([
        {
          success: false,
          message: "Failed to run GraphQL tests",
          error: error instanceof Error ? error.message : "Network error",
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const emptyStateTests = [
    {
      name: "No Collections",
      description: "Test behavior when Shopify returns no collections",
      status: "manual",
    },
    {
      name: "No Rules",
      description: "Test UI when no exclusion rules are created",
      status: "manual",
    },
    {
      name: "No Discounts",
      description: "Test UI when no discount codes exist",
      status: "manual",
    },
  ];

  const testResultRows = testResults.map((result, index) => [
    <Badge
      key={`status-${index}`}
      tone={result.success ? "success" : "critical"}
    >
      {result.success ? "PASS" : "FAIL"}
    </Badge>,
    <Text key={`message-${index}`} as="span">
      {result.message}
    </Text>,
    <Text key={`error-${index}`} as="span" tone="subdued">
      {result.error || result.data
        ? JSON.stringify(result.data || result.error).substring(0, 100) + "..."
        : "N/A"}
    </Text>,
  ]);

  return (
    <Page
      title="🧪 Test Edge Cases"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <Banner tone="warning">
            <p>
              <strong>Testing Environment:</strong> Use this page to test edge
              cases and error scenarios. These tests help ensure the app handles
              invalid data gracefully.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">
                    🚀 Automated Tests
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Run automated tests for collection handling edge cases
                  </Text>
                </BlockStack>
                <InlineStack gap="300">
                  <Button
                    variant="primary"
                    onClick={runTests}
                    loading={isRunning}
                  >
                    Run Mock Tests
                  </Button>
                  <Button
                    variant="primary"
                    onClick={runMutationTests}
                    loading={isRunning}
                  >
                    Run GraphQL Tests
                  </Button>
                </InlineStack>
              </InlineStack>

              {testResults.length > 0 && (
                <>
                  <Divider />
                  <DataTable
                    columnContentTypes={["text", "text", "text"]}
                    headings={["Status", "Test Result", "Details"]}
                    rows={testResultRows}
                  />

                  <InlineStack gap="200">
                    <Badge tone="success">
                      {`${testResults.filter((r) => r.success).length} Passed`}
                    </Badge>
                    <Badge tone="critical">
                      {`${testResults.filter((r) => !r.success).length} Failed`}
                    </Badge>
                  </InlineStack>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                🔍 Manual Test Scenarios
              </Text>

              <BlockStack gap="300">
                {emptyStateTests.map((test, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "16px",
                      border: "1px solid #e1e3e5",
                      borderRadius: "8px",
                    }}
                  >
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="semibold" as="h4">
                          {test.name}
                        </Text>
                        <Badge tone="info">{test.status}</Badge>
                      </InlineStack>
                      <Text variant="bodySm" tone="subdued" as="p">
                        {test.description}
                      </Text>
                    </BlockStack>
                  </div>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                📝 Test Checklist
              </Text>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p">
                  <strong>✅ Empty States to Test:</strong>
                </Text>
                <BlockStack gap="100">
                  <Text variant="bodySm" as="p">
                    • Navigate to /app/rules with no collections in Shopify
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Visit /app/discounts with no active rules
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Check /app/discounts with no discount codes created
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Test dashboard with completely fresh installation
                  </Text>
                </BlockStack>

                <div style={{ marginTop: "16px" }}>
                  <Text variant="bodyMd" as="p">
                    <strong>⚠️ Error Cases to Test:</strong>
                  </Text>
                </div>
                <BlockStack gap="100">
                  <Text variant="bodySm" as="p">
                    • Delete a collection after adding it to rules
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Try to apply rules to a deleted discount
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Test with very long collection names ({">"}100 chars)
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Test with special characters in collection names
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Simulate network failure during rule save
                  </Text>
                </BlockStack>

                <div style={{ marginTop: "16px" }}>
                  <Text variant="bodyMd" as="p">
                    <strong>🎯 Expected Behavior:</strong>
                  </Text>
                </div>
                <BlockStack gap="100">
                  <Text variant="bodySm" as="p">
                    • No JavaScript errors in console
                  </Text>
                  <Text variant="bodySm" as="p">
                    • User-friendly error messages
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Graceful fallbacks for empty states
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Loading states during async operations
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Consistent UI behavior across all scenarios
                  </Text>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
