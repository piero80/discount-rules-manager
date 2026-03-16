import { useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Text,
  ProgressBar,
  InlineStack,
  Badge,
  Card,
} from "@shopify/polaris";

interface RuleApplicationResult {
  success: boolean;
  message: string;
  details?: {
    success: number;
    failed: number;
    skipped?: number;
    total: number;
    errors?: string[];
  };
}

interface RuleApplicationStatusProps {
  result?: RuleApplicationResult;
  isLoading: boolean;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function RuleApplicationStatus({
  result,
  isLoading,
  onDismiss,
  onRetry,
}: RuleApplicationStatusProps) {
  const [progress, setProgress] = useState(0);

  // Simulate progress while loading
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 20;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setProgress(100);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <Card>
        <BlockStack gap="400">
          <Text variant="headingSm" as="h3">
            Applying Rules to Discounts...
          </Text>
          <BlockStack gap="200">
            <Text variant="bodySm" tone="subdued" as="p">
              Processing your discount codes with active rules
            </Text>
            <ProgressBar progress={progress} size="small" />
          </BlockStack>
        </BlockStack>
      </Card>
    );
  }

  if (!result) return null;

  const { success, message, details } = result;
  const hasDetails = details && details.total > 0;

  return (
    <Banner
      tone={success ? "success" : "critical"}
      onDismiss={onDismiss}
      action={
        !success && onRetry
          ? {
              content: "Retry",
              onAction: onRetry,
            }
          : undefined
      }
    >
      <BlockStack gap="300">
        <Text as="p">{message}</Text>

        {hasDetails && (
          <BlockStack gap="200">
            <InlineStack gap="400">
              <InlineStack gap="100" blockAlign="center">
                <Badge tone="success">{`Applied: ${details.success}`}</Badge>
                {details.skipped && details.skipped > 0 && (
                  <Badge tone="warning">{`Skipped: ${details.skipped}`}</Badge>
                )}
                <Badge tone="critical">{`Failed: ${details.failed}`}</Badge>
                <Badge tone="info">{`Total: ${details.total}`}</Badge>
              </InlineStack>
            </InlineStack>

            {success && details.success > 0 && (
              <Text variant="bodySm" tone="success" as="p">
                ✅ {details.success} discount{details.success !== 1 ? "s" : ""}{" "}
                successfully updated with rule configurations
              </Text>
            )}

            {details.skipped && details.skipped > 0 && (
              <Text variant="bodySm" tone="subdued" as="p">
                ⚠️ {details.skipped} discount{details.skipped !== 1 ? "s" : ""}{" "}
                were skipped because applying rules would make them empty (unusable)
              </Text>
            )}

            {details.failed > 0 && (
              <Text variant="bodySm" tone="critical" as="p">
                ❌ {details.failed} discount{details.failed !== 1 ? "s" : ""}{" "}
                could not be updated
              </Text>
            )}

            {details.errors && details.errors.length > 0 && (
              <BlockStack gap="100">
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  Errors encountered:
                </Text>
                {details.errors.slice(0, 3).map((error, index) => (
                  <Text key={index} variant="bodySm" tone="subdued" as="p">
                    • {error}
                  </Text>
                ))}
                {details.errors.length > 3 && (
                  <Text variant="bodySm" tone="subdued" as="p">
                    ... and {details.errors.length - 3} more errors
                  </Text>
                )}
              </BlockStack>
            )}
          </BlockStack>
        )}
      </BlockStack>
    </Banner>
  );
}

// Hook per gestire lo stato dell'applicazione delle regole
export function useRuleApplication() {
  const [result, setResult] = useState<RuleApplicationResult | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const startApplication = () => {
    setIsLoading(true);
    setResult(undefined);
  };

  const completeApplication = (newResult: RuleApplicationResult) => {
    setIsLoading(false);
    setResult(newResult);
  };

  const dismissResult = () => {
    setResult(undefined);
  };

  const reset = () => {
    setIsLoading(false);
    setResult(undefined);
  };

  return {
    result,
    isLoading,
    startApplication,
    completeApplication,
    dismissResult,
    reset,
  };
}
