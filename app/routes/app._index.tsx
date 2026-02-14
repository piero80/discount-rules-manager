import { useNavigate, useLoaderData, data } from "react-router";
import { useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
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
} from "@shopify/polaris";
import type { FC } from "react";
import { authenticate } from "../shopify.server";
import { discountRuleHelpers } from "../services/db.server";
import {
  getDiscountCodes,
  getAllCollections,
} from "../services/discount.server";
import { useShopifyAppBridge } from "../hooks/useShopifyAppBridge";
import { StatsCardSkeleton } from "../components/LoadingSkeleton";
import { usePerformanceMonitor } from "../utils/performance-lcp";

// Import critical icons directly for faster LCP - these are above the fold
import {
  Zap,
  CheckCircle,
  Clock,
  BarChart3,
  Target,
  Activity,
} from "lucide-react";

// Dashboard stats type
interface DashboardStats {
  rulesCount: number;
  activeRulesCount: number;
  totalExcludedCollections: number;
  totalIncludedCollections: number;
  totalCollections: number;
  discountsManaged: number;
  lastActivity: string | null;
  hasRules: boolean;
  quickActions: {
    hasRules: boolean;
    hasDiscounts: boolean;
    canApplyRules: boolean;
  };
}

// Optimized loader with priority-based loading and aggressive caching
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const isInitialLoad = url.searchParams.get("initial") !== "false";

  try {
    const { admin, session } = await authenticate.admin(request);
    const start = performance.now();

    // Priority-based loading: Load critical data first, defer secondary
    if (isInitialLoad) {
      // First load: Only get essential data for immediate UI render
      const [ruleStats] = await Promise.allSettled([
        discountRuleHelpers.getRuleStats(session.shop),
      ]);

      const statsData =
        ruleStats.status === "fulfilled" ? ruleStats.value : null;

      // Minimal stats for fast initial render
      const quickStats: DashboardStats = {
        rulesCount: statsData?.rules.length || 0,
        activeRulesCount: statsData?.rules.length || 0, // All rules are considered active
        totalExcludedCollections:
          statsData?.rules.reduce(
            (acc, rule) =>
              rule.mode === "exclude" ? acc + rule.excludedCount : acc,
            0,
          ) || 0,
        totalIncludedCollections:
          statsData?.rules.reduce(
            (acc, rule) =>
              rule.mode === "include" ? acc + rule.excludedCount : acc,
            0,
          ) || 0,
        totalCollections: 0, // Will be loaded async
        discountsManaged: 0, // Will be loaded async
        lastActivity: null, // Will be calculated from rules if needed
        hasRules: statsData?.hasRules || false,
        quickActions: {
          hasRules: statsData?.hasRules || false,
          hasDiscounts: false, // Will update async
          canApplyRules: false, // Will update async
        },
      };

      return data(
        {
          stats: quickStats,
          collections: [],
          discounts: [],
          activeRules: statsData?.rules || [],
          isPartialLoad: true,
        },
        {
          headers: {
            "Cache-Control": "public, max-age=300", // Cache for 5 minutes
            "X-Performance-Optimized": "priority-load",
            "X-Load-Time": `${performance.now() - start}ms`,
          },
        },
      );
    }

    // Full data loading for subsequent requests
    const [collections, ruleStats, discounts] = await Promise.allSettled([
      getAllCollections(admin),
      discountRuleHelpers.getRuleStats(session.shop),
      getDiscountCodes(admin),
    ]);

    // Extract results with fallbacks
    const collectionsData =
      collections.status === "fulfilled" ? collections.value : [];
    const statsData = ruleStats.status === "fulfilled" ? ruleStats.value : null;
    const discountsData =
      discounts.status === "fulfilled" ? discounts.value : [];

    // Full stats calculation
    const stats: DashboardStats = {
      rulesCount: statsData?.rules.length || 0,
      activeRulesCount: statsData?.rules.length || 0, // All rules are considered active
      totalExcludedCollections:
        statsData?.rules.reduce(
          (acc, rule) =>
            rule.mode === "exclude" ? acc + rule.excludedCount : acc,
          0,
        ) || 0,
      totalIncludedCollections:
        statsData?.rules.reduce(
          (acc, rule) =>
            rule.mode === "include" ? acc + rule.excludedCount : acc,
          0,
        ) || 0,
      totalCollections: collectionsData.length,
      discountsManaged: discountsData.length,
      lastActivity: null, // Will be calculated from rules if needed
      hasRules: statsData?.hasRules || false,
      quickActions: {
        hasRules: statsData?.hasRules || false,
        hasDiscounts: discountsData.length > 0,
        canApplyRules:
          (statsData?.hasRules || false) && discountsData.length > 0,
      },
    };

    return data(
      {
        stats,
        collections: collectionsData,
        discounts: discountsData,
        activeRules: statsData?.rules || [],
        isPartialLoad: false,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300",
          "X-Performance-Optimized": "full-load",
          "X-Load-Time": `${performance.now() - start}ms`,
        },
      },
    );
  } catch (error) {
    console.error("Loader error:", error);
    const fallbackStats: DashboardStats = {
      rulesCount: 0,
      activeRulesCount: 0,
      totalExcludedCollections: 0,
      totalIncludedCollections: 0,
      totalCollections: 0,
      discountsManaged: 0,
      lastActivity: null,
      hasRules: false,
      quickActions: {
        hasRules: false,
        hasDiscounts: false,
        canApplyRules: false,
      },
    };

    return data({
      stats: fallbackStats,
      collections: [],
      discounts: [],
      activeRules: [],
      error: "Unable to load dashboard data. Please check your connection.",
      isPartialLoad: false,
    });
  }
};

// Type for lucide icon components - compatibile con LucideIcon
import type { LucideIcon } from "lucide-react";
type IconComponent = LucideIcon;

interface FeatureCardProps {
  icon: IconComponent;
  title: string;
  description: string;
  gradient: string;
}

const FeatureCard: FC<FeatureCardProps> = ({
  icon: Icon,
  title,
  description,
  gradient,
}) => {
  return (
    <Card>
      <div
        style={{
          height: "100%",
          minHeight: "240px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <BlockStack gap="300" inlineAlign="center">
          <div
            style={{
              background: gradient,
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            }}
          >
            <Icon size={32} color="white" />
          </div>
          <BlockStack gap="200" inlineAlign="center">
            <Text variant="headingMd" as="h3" alignment="center">
              {title}
            </Text>
            <Text variant="bodyMd" tone="subdued" as="p" alignment="center">
              {description}
            </Text>
          </BlockStack>
        </BlockStack>
      </div>
    </Card>
  );
};

interface StatsCardProps {
  icon: IconComponent;
  label: string;
  value: string | number;
  badge?: string;
  badgeTone?: "success" | "critical" | "warning" | "info";
  description?: string;
}

const StatsCard: FC<StatsCardProps> = ({
  icon: Icon,
  label,
  value,
  badge,
  badgeTone = "info",
  description,
}) => {
  return (
    <Card>
      <div style={{ padding: "20px" }}>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="start">
            <div
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                borderRadius: "8px",
                padding: "8px",
                display: "flex",
              }}
            >
              <Icon size={20} color="white" />
            </div>
            {badge && (
              <Badge tone={badgeTone} size="small">
                {badge}
              </Badge>
            )}
          </InlineStack>
          <BlockStack gap="100">
            <Text variant="headingLg" as="h3">
              {value}
            </Text>
            <Text variant="bodyMd" tone="subdued" as="p">
              {label}
            </Text>
            {description && (
              <Text variant="bodySm" tone="subdued" as="p">
                {description}
              </Text>
            )}
          </BlockStack>
        </BlockStack>
      </div>
    </Card>
  );
};

interface StepProps {
  number: number;
  title: string;
  description: string;
}

const Step: FC<StepProps> = ({ number, title, description }) => {
  return (
    <div style={{ display: "flex", gap: "16px" }}>
      <div
        style={{
          minWidth: "32px",
          height: "32px",
          borderRadius: "50%",
          background: "#10b981",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
        }}
      >
        {number}
      </div>
      <BlockStack gap="100">
        <Text variant="headingSm" as="h4">
          {title}
        </Text>
        <Text variant="bodyMd" tone="subdued" as="p">
          {description}
        </Text>
      </BlockStack>
    </div>
  );
};

export default function Index(): JSX.Element {
  const navigate = useNavigate();
  const { showToast } = useShopifyAppBridge();
  const { markLCP } = usePerformanceMonitor();
  const { stats, error, isPartialLoad } = useLoaderData() as {
    stats: DashboardStats;
    collections: Array<{ id: string; title: string }>;
    discounts: Array<Record<string, unknown>>;
    activeRules: Array<{
      id: string;
      name: string;
      mode: string;
      priority: number;
      isScheduled: boolean;
      excludedCount: number;
    }>;
    error?: string;
    isPartialLoad?: boolean;
  };

  // Mark LCP candidates for monitoring
  useEffect(() => {
    markLCP("Dashboard Header");
  }, [markLCP]);

  // Format last activity
  const formatLastActivity = (isoString: string | null): string => {
    if (!isoString) return "Never";

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "< 1h ago";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Load full data after initial render for better performance
  useEffect(() => {
    if (isPartialLoad) {
      // Defer secondary data loading to avoid blocking initial paint
      const timer = setTimeout(() => {
        navigate("?initial=false", { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isPartialLoad, navigate]);

  // Show welcome message on first visit (using a simple effect)
  useEffect(() => {
    const hasShownWelcome = sessionStorage.getItem("discount_rules_welcome");
    if (!hasShownWelcome) {
      showToast("Welcome to Discount Rules Manager! 🎉", "success");
      sessionStorage.setItem("discount_rules_welcome", "true");
    }
  }, [showToast]);

  const features: FeatureCardProps[] = [
    {
      icon: Zap,
      title: "Multiple Priority Rules",
      description:
        "Create multiple rules with priority ordering. Exclude some collections, include others - all automatically applied.",
      gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    },
    {
      icon: Clock,
      title: "Save Time",
      description:
        "Set up your rules once with priority ordering. Focus on growing your business instead of managing discount rules.",
      gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    },
    {
      icon: CheckCircle,
      title: "Smart Organization",
      description:
        "Organize your discount strategy with multiple rules. Handle complex scenarios with ease and confidence.",
      gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
    },
  ];

  const steps: StepProps[] = [
    {
      number: 1,
      title: "Create Multiple Rules",
      description:
        "Add multiple rules with different purposes - exclude sale items, include new collections, etc.",
    },
    {
      number: 2,
      title: "Set Priority Order",
      description:
        "Order your rules by priority (1 = highest). Rules are applied in sequence for precise control.",
    },
    {
      number: 3,
      title: "Apply & Manage",
      description:
        "Apply all rules to your discounts automatically. Update them anytime as your business evolves.",
    },
  ];

  return (
    <Page title="Dashboard - Smart Discount Rules Manager">
      <div style={{ marginBottom: "80px" }}>
        <Layout>
          {error && (
            <Layout.Section>
              <Banner tone="critical" title="Connection Error">
                <p>{error}</p>
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card>
              <div style={{ padding: "20px" }}>
                <BlockStack gap="500">
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="200">
                        <Text variant="headingLg" as="h1">
                          Dashboard - Multiple Rules System
                        </Text>
                        <Text variant="bodyMd" tone="subdued" as="p">
                          {stats.quickActions.hasRules
                            ? `${stats.activeRulesCount} active rule${stats.activeRulesCount !== 1 ? "s" : ""} with priority ordering`
                            : "No discount rules configured yet"}
                        </Text>
                      </BlockStack>
                      <InlineStack gap="200">
                        {stats.quickActions.canApplyRules && (
                          <Button onClick={() => navigate("/app/discounts")}>
                            Apply Rules Now
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          onClick={() => navigate("/app/rules")}
                        >
                          {stats.quickActions.hasRules
                            ? "Manage Rules"
                            : "Create Rules"}
                        </Button>
                      </InlineStack>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </div>
            </Card>
          </Layout.Section>

          {/* Stats Cards */}
          <Layout.Section>
            <InlineStack gap="400" align="start">
              {isPartialLoad &&
              (stats.totalCollections === 0 || stats.discountsManaged === 0) ? (
                <StatsCardSkeleton count={4} />
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <StatsCard
                      icon={Target}
                      label="Total Rules"
                      value={stats.rulesCount}
                      badge={
                        stats.activeRulesCount > 0
                          ? `${stats.activeRulesCount} Active`
                          : "None"
                      }
                      badgeTone={
                        stats.activeRulesCount > 0 ? "success" : "critical"
                      }
                      description={
                        stats.rulesCount > 0
                          ? `${stats.totalExcludedCollections} excluded, ${stats.totalIncludedCollections} included`
                          : "Create your first rule to get started"
                      }
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <StatsCard
                      icon={BarChart3}
                      label="Total Collections"
                      value={stats.totalCollections}
                      badge={stats.totalCollections > 0 ? "Ready" : "Empty"}
                      badgeTone={
                        stats.totalCollections > 0 ? "success" : "warning"
                      }
                      description={
                        stats.quickActions.hasRules
                          ? `Rules affect ${stats.totalExcludedCollections + stats.totalIncludedCollections} collections`
                          : "Available for discount rules"
                      }
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <StatsCard
                      icon={Zap}
                      label="Discounts Ready"
                      value={stats.discountsManaged}
                      badge={
                        stats.quickActions.canApplyRules
                          ? "Can Apply"
                          : "No Rules"
                      }
                      badgeTone={
                        stats.quickActions.canApplyRules ? "success" : "info"
                      }
                      description={
                        stats.quickActions.canApplyRules
                          ? "Ready for rule application"
                          : stats.discountsManaged > 0
                            ? "Create rules first"
                            : "No discounts found"
                      }
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <StatsCard
                      icon={Activity}
                      label="Last Activity"
                      value={formatLastActivity(stats.lastActivity)}
                      badge={stats.lastActivity ? "Updated" : "Never"}
                      badgeTone={stats.lastActivity ? "info" : "warning"}
                      description="Last rule update"
                    />
                  </div>
                </>
              )}
            </InlineStack>
          </Layout.Section>

          {/* Quick Actions
          {(stats.quickActions.hasRules || stats.discountsManaged > 0) && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Quick Actions
                  </Text>
                  <InlineStack gap="300" wrap={true}>
                    {stats.quickActions.canApplyRules && (
                      <Button
                        variant="primary"
                        onClick={() => navigate("/app/discounts")}
                      >
                        🚀 Apply rules to {stats.discountsManaged.toString()}{" "}
                        discounts
                      </Button>
                    )}
                    {!stats.quickActions.hasRules &&
                      stats.totalCollections > 0 && (
                        <Button
                          variant="primary"
                          onClick={() => navigate("/app/rules")}
                        >
                          ⚡ Create rules for{" "}
                          {stats.totalCollections.toString()} collections
                        </Button>
                      )}
                    {stats.quickActions.hasRules && (
                      <Button onClick={() => navigate("/app/rules")}>
                        ⚙️ Modify current rules
                      </Button>
                    )}
                    {stats.totalCollections === 0 && (
                      <Banner tone="info">
                        <p>
                          Create some collections in your Shopify admin first,
                          then come back to set up discount rules.
                        </p>
                      </Banner>
                    )}
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          )} */}

          <Layout.Section>
            <BlockStack gap="500">
              <Text variant="headingMd" as="h2" alignment="center">
                Why Choose Smart Multiple Rules?
              </Text>
              <InlineStack gap="400" align="space-evenly">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    style={{
                      flex: "1",
                      maxWidth: "320px",
                      minWidth: "280px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <FeatureCard {...feature} />
                  </div>
                ))}
              </InlineStack>
            </BlockStack>
          </Layout.Section>

          <Layout.Section>
            <InlineStack gap="600" align="center">
              <div style={{ flex: "1", maxWidth: "600px" }}>
                <Card>
                  <BlockStack gap="500">
                    <Text variant="headingMd" as="h3" alignment="center">
                      How it works
                    </Text>
                    <BlockStack gap="400">
                      {steps.map((step) => (
                        <Step key={step.number} {...step} />
                      ))}
                    </BlockStack>

                    <div style={{ marginTop: "24px", textAlign: "center" }}>
                      <Button
                        variant="primary"
                        size="large"
                        onClick={() => navigate("/app/rules")}
                      >
                        Create Your First Rules
                      </Button>
                    </div>
                  </BlockStack>
                </Card>
              </div>
            </InlineStack>
          </Layout.Section>
        </Layout>
      </div>
    </Page>
  );
}
