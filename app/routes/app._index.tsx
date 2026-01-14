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
  excludedCollections: number;
  totalCollections: number;
  discountsManaged: number;
  lastActivity: string | null;
  mode: "exclude" | "include" | null;
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
      const [activeRule] = await Promise.allSettled([
        discountRuleHelpers.getActiveRule(session.shop),
      ]);

      const ruleData =
        activeRule.status === "fulfilled" ? activeRule.value : null;

      // Minimal stats for fast initial render
      const quickStats: DashboardStats = {
        rulesCount: ruleData ? 1 : 0,
        excludedCollections: ruleData?.excludedCollections.length || 0,
        totalCollections: 0, // Will be loaded async
        discountsManaged: 0, // Will be loaded async
        lastActivity: ruleData?.updatedAt?.toISOString() || null,
        mode: (ruleData?.mode as "exclude" | "include") || null,
        quickActions: {
          hasRules: !!ruleData,
          hasDiscounts: false, // Will update async
          canApplyRules: false, // Will update async
        },
      };

      return data(
        {
          stats: quickStats,
          collections: [],
          discounts: [],
          activeRule: ruleData,
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
    const [collections, activeRule, discounts] = await Promise.allSettled([
      getAllCollections(admin),
      discountRuleHelpers.getActiveRule(session.shop),
      getDiscountCodes(admin),
    ]);

    // Extract results with fallbacks
    const collectionsData =
      collections.status === "fulfilled" ? collections.value : [];
    const ruleData =
      activeRule.status === "fulfilled" ? activeRule.value : null;
    const discountsData =
      discounts.status === "fulfilled" ? discounts.value : [];

    // Full stats calculation
    const stats: DashboardStats = {
      rulesCount: ruleData ? 1 : 0,
      excludedCollections: ruleData?.excludedCollections.length || 0,
      totalCollections: collectionsData.length,
      discountsManaged: discountsData.length,
      lastActivity: ruleData?.updatedAt?.toISOString() || null,
      mode: (ruleData?.mode as "exclude" | "include") || null,
      quickActions: {
        hasRules: !!ruleData,
        hasDiscounts: discountsData.length > 0,
        canApplyRules: !!ruleData && discountsData.length > 0,
      },
    };

    return data(
      {
        stats,
        collections: collectionsData,
        discounts: discountsData,
        activeRule: ruleData,
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
      excludedCollections: 0,
      totalCollections: 0,
      discountsManaged: 0,
      lastActivity: null,
      mode: null,
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
      activeRule: null,
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
    activeRule: Record<string, unknown> | null;
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
      title: "Auto-Include New Collections",
      description:
        "New collections are automatically included in your discounts. No more manual updates needed.",
      gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    },
    {
      icon: Clock,
      title: "Save Time",
      description:
        "Set it once, forget about it. Focus on growing your business instead of managing discount rules.",
      gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    },
    {
      icon: CheckCircle,
      title: "No More Mistakes",
      description:
        "Eliminate the risk of forgetting to add new collections to your discount codes.",
      gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
    },
  ];

  const steps: StepProps[] = [
    {
      number: 1,
      title: "Choose Your Mode",
      description:
        "Select between smart exclusion mode (recommended) or manual inclusion mode.",
    },
    {
      number: 2,
      title: "Configure Collections",
      description:
        'Exclude collections you don\'t want (e.g., "Sale Items") or include only specific ones.',
    },
    {
      number: 3,
      title: "Done!",
      description:
        "Your rules will be applied automatically when you manage discounts.",
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
                          Dashboard
                        </Text>
                        <Text variant="bodyMd" tone="subdued" as="p">
                          {stats.quickActions.hasRules
                            ? `${stats.mode === "exclude" ? "Smart exclusion" : "Manual inclusion"} mode active`
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
                      label="Active Rules"
                      value={stats.rulesCount}
                      badge={stats.rulesCount > 0 ? "Active" : "None"}
                      badgeTone={stats.rulesCount > 0 ? "success" : "critical"}
                      description={
                        stats.rulesCount > 0
                          ? `${stats.excludedCollections} collections ${stats.mode === "exclude" ? "excluded" : "included"}`
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
                          ? `${stats.totalCollections - stats.excludedCollections} will receive discounts`
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
                Why Choose Smart Discount Rules?
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
                        Create Your First Rule
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
