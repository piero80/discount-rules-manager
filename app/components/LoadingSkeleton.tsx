import { Card, BlockStack } from "@shopify/polaris";
import type { FC } from "react";

interface LoadingSkeletonProps {
  height?: string;
  width?: string;
  borderRadius?: string;
  count?: number;
}

export const LoadingSkeleton: FC<LoadingSkeletonProps> = ({
  height = "20px",
  width = "100%",
  borderRadius = "4px",
  count = 1,
}) => {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="loading-skeleton"
          style={{
            height,
            width,
            borderRadius,
            marginBottom: index < count - 1 ? "8px" : "0",
          }}
        />
      ))}
    </>
  );
};

interface StatsCardSkeletonProps {
  count?: number;
}

export const StatsCardSkeleton: FC<StatsCardSkeletonProps> = ({
  count = 4,
}) => {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index}>
          <div style={{ padding: "20px" }}>
            <BlockStack gap="300">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div
                  className="loading-skeleton"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                  }}
                />
                <LoadingSkeleton
                  height="20px"
                  width="60px"
                  borderRadius="12px"
                />
              </div>
              <BlockStack gap="100">
                <LoadingSkeleton height="32px" width="80px" />
                <LoadingSkeleton height="16px" width="120px" />
                <LoadingSkeleton height="14px" width="100px" />
              </BlockStack>
            </BlockStack>
          </div>
        </Card>
      ))}
    </>
  );
};

interface FeatureCardSkeletonProps {
  count?: number;
}

export const FeatureCardSkeleton: FC<FeatureCardSkeletonProps> = ({
  count = 3,
}) => {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index}>
          <div
            style={{
              height: "240px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <BlockStack gap="300" inlineAlign="center">
              <div
                className="loading-skeleton"
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "12px",
                }}
              />
              <BlockStack gap="200" inlineAlign="center">
                <LoadingSkeleton height="24px" width="180px" />
                <LoadingSkeleton height="16px" width="240px" count={2} />
              </BlockStack>
            </BlockStack>
          </div>
        </Card>
      ))}
    </>
  );
};
