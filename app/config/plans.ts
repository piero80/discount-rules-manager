// Plan configurations - Shared between server and client
// Optimized for Shopify App Store

export const PLAN_CONFIGS = {
  free: {
    name: "Free",
    maxRules: 1, // Enough to test multiple rules without being too generous
    price: 0,
    features: [
      "Up to 1 discount rule",
      "Basic rule management",
      "Collection include/exclude",
    ],
    trial: false, // FREE plan non ha bisogno di trial
  },
  starter: {
    name: "Starter",
    maxRules: 5,
    price: 4.99, // Prezzo entry-level più accessibile
    features: [
      "Up to 5 discount rules",
      "Priority management",
      "Rule scheduling",
      "Apply specific rules",
      "Email support",
      "Basic analytics",
      "7-day free trial",
    ],
    popular: false,
    trial: true,
  },
  professional: {
    name: "Professional",
    maxRules: 25,
    price: 12.99, // Prezzo medio-alto
    features: [
      "Up to 25 discount rules",
      "Priority management",
      "Rule scheduling",
      "Apply specific rules",
      "Advanced analytics",
      "Priority support",
      "7-day free trial",
    ],
    popular: true, // Piano più popolare
    trial: true,
  },
  enterprise: {
    name: "Enterprise",
    maxRules: 100, // Invece di "unlimited"
    price: 29.99,
    features: [
      "Up to 100 discount rules",
      "Priority management",
      "Rule scheduling",
      "Apply specific rules",
      "Multi-store management",
      "Custom integrations",
      "Dedicated support",
      "7-day free trial",
    ],
    popular: false,
    trial: true,
  },
} as const;

export type PlanName = keyof typeof PLAN_CONFIGS;
export type PlanConfig = (typeof PLAN_CONFIGS)[PlanName];
