/**
 * Advanced Conditional Rule Templates
 * Pre-built rule configurations for common business scenarios
 */

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category:
    | "loyalty"
    | "seasonal"
    | "cart_optimization"
    | "customer_acquisition"
    | "inventory_management";
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedROI: string;
  ruleConfig: {
    name: string;
    description: string;
    conditions: Array<{
      conditionType: string;
      operator: string;
      value: unknown;
      logicOperator: "AND" | "OR";
      negated?: boolean;
    }>;
    actions: Array<{
      actionType: string;
      value: unknown;
      maxAmount?: number;
    }>;
    priority: number;
  };
  tags: string[];
}

/**
 * Template Library - Real-world conditional discount scenarios
 */
export const RULE_TEMPLATES: RuleTemplate[] = [
  // Loyalty & VIP Templates
  {
    id: "vip_weekend_boost",
    name: "VIP Weekend Boost",
    description:
      "Extra discount for VIP customers during weekends to drive weekend sales",
    category: "loyalty",
    difficulty: "beginner",
    estimatedROI: "15-25% increase in weekend revenue",
    ruleConfig: {
      name: "VIP Weekend Boost",
      description: "Give VIP customers 15% off + free shipping on weekends",
      conditions: [
        {
          conditionType: "customer_tag",
          operator: "equals",
          value: "VIP",
          logicOperator: "AND",
        },
        {
          conditionType: "day_of_week",
          operator: "in_list",
          value: ["Saturday", "Sunday"],
          logicOperator: "AND",
        },
        {
          conditionType: "cart_total",
          operator: "greater_than",
          value: 100,
          logicOperator: "AND",
        },
      ],
      actions: [
        {
          actionType: "percentage_discount",
          value: { percentage: 15 },
          maxAmount: 50,
        },
        {
          actionType: "free_shipping",
          value: {},
        },
      ],
      priority: 10,
    },
    tags: ["vip", "weekend", "loyalty", "free-shipping"],
  },

  {
    id: "loyal_customer_escalation",
    name: "Loyalty Escalation Program",
    description:
      "Progressive discounts based on customer lifetime value and order frequency",
    category: "loyalty",
    difficulty: "advanced",
    estimatedROI: "20-35% increase in customer retention",
    ruleConfig: {
      name: "Loyalty Escalation Program",
      description:
        "Higher discounts for customers with more orders and spending",
      conditions: [
        {
          conditionType: "customer_orders_count",
          operator: "greater_than",
          value: 5,
          logicOperator: "AND",
        },
        {
          conditionType: "customer_total_spent",
          operator: "greater_than",
          value: 500,
          logicOperator: "AND",
        },
      ],
      actions: [
        {
          actionType: "percentage_discount",
          value: { percentage: 20 },
          maxAmount: 100,
        },
      ],
      priority: 8,
    },
    tags: ["loyalty", "progressive", "high-value", "retention"],
  },

  // Seasonal & Time-based Templates
  {
    id: "flash_friday_clearance",
    name: "Flash Friday Clearance",
    description:
      "Time-sensitive clearance sale for overstocked items every Friday",
    category: "seasonal",
    difficulty: "intermediate",
    estimatedROI: "30-50% reduction in dead inventory",
    ruleConfig: {
      name: "Flash Friday Clearance",
      description: "Deep discounts on clearance items every Friday 12-6pm",
      conditions: [
        {
          conditionType: "day_of_week",
          operator: "equals",
          value: "Friday",
          logicOperator: "AND",
        },
        {
          conditionType: "time_of_day",
          operator: "between",
          value: "12-18", // 12pm to 6pm
          logicOperator: "AND",
        },
        {
          conditionType: "cart_product_tags",
          operator: "contains",
          value: "clearance",
          logicOperator: "AND",
        },
      ],
      actions: [
        {
          actionType: "percentage_discount",
          value: { percentage: 40 },
        },
      ],
      priority: 7,
    },
    tags: ["flash-sale", "clearance", "time-sensitive", "inventory"],
  },

  {
    id: "new_customer_welcome",
    name: "New Customer Welcome Series",
    description:
      "Special discount for first-time customers within their first 30 days",
    category: "customer_acquisition",
    difficulty: "beginner",
    estimatedROI: "25-40% improvement in first purchase conversion",
    ruleConfig: {
      name: "New Customer Welcome",
      description: "Welcome discount for customers within 30 days of signup",
      conditions: [
        {
          conditionType: "customer_orders_count",
          operator: "equals",
          value: 0,
          logicOperator: "AND",
        },
        {
          conditionType: "customer_account_age",
          operator: "less_than",
          value: 30,
          logicOperator: "AND",
        },
        {
          conditionType: "cart_total",
          operator: "greater_than",
          value: 50,
          logicOperator: "AND",
        },
      ],
      actions: [
        {
          actionType: "percentage_discount",
          value: { percentage: 20 },
          maxAmount: 25,
        },
      ],
      priority: 9,
    },
    tags: ["new-customer", "welcome", "acquisition", "first-purchase"],
  },

  // Cart Optimization Templates
  {
    id: "cart_abandonment_recovery",
    name: "Smart Cart Recovery",
    description:
      "Progressive discounts to recover abandoned carts based on cart value",
    category: "cart_optimization",
    difficulty: "advanced",
    estimatedROI: "15-30% reduction in cart abandonment",
    ruleConfig: {
      name: "Smart Cart Recovery",
      description:
        "Escalating discounts for returning customers with abandoned carts",
      conditions: [
        {
          conditionType: "customer_orders_count",
          operator: "greater_than",
          value: 0, // Returning customer
          logicOperator: "AND",
        },
        {
          conditionType: "cart_total",
          operator: "greater_than",
          value: 75,
          logicOperator: "AND",
        },
        {
          conditionType: "days_since_last_order",
          operator: "greater_than",
          value: 14,
          logicOperator: "AND",
        },
      ],
      actions: [
        {
          actionType: "percentage_discount",
          value: { percentage: 12 },
          maxAmount: 30,
        },
      ],
      priority: 6,
    },
    tags: ["cart-recovery", "abandonment", "returning-customer", "progressive"],
  },

  {
    id: "bulk_purchase_incentive",
    name: "Bulk Purchase Accelerator",
    description:
      "Encourage larger orders with quantity-based progressive discounts",
    category: "cart_optimization",
    difficulty: "intermediate",
    estimatedROI: "20-35% increase in average order value",
    ruleConfig: {
      name: "Bulk Purchase Accelerator",
      description: "Better discounts for larger quantity purchases",
      conditions: [
        {
          conditionType: "cart_quantity",
          operator: "greater_than",
          value: 10,
          logicOperator: "AND",
        },
        {
          conditionType: "cart_total",
          operator: "greater_than",
          value: 200,
          logicOperator: "AND",
        },
      ],
      actions: [
        {
          actionType: "percentage_discount",
          value: { percentage: 18 },
          maxAmount: 75,
        },
      ],
      priority: 5,
    },
    tags: ["bulk", "quantity", "aov-boost", "wholesale"],
  },

  // Cross-selling Templates
  {
    id: "accessory_bundle_boost",
    name: "Smart Accessory Bundling",
    description: "Discount accessories when main products are in cart",
    category: "cart_optimization",
    difficulty: "advanced",
    estimatedROI: "25-45% increase in accessories sales",
    ruleConfig: {
      name: "Smart Accessory Bundling",
      description: "Discount accessories when electronics are in cart",
      conditions: [
        {
          conditionType: "cart_contains_collection",
          operator: "equals",
          value: "electronics",
          logicOperator: "AND",
        },
        {
          conditionType: "cart_contains_collection",
          operator: "equals",
          value: "accessories",
          logicOperator: "AND",
          negated: true,
        },
      ],
      actions: [
        {
          actionType: "collection_discount",
          value: {
            collection: "accessories",
            percentage: 25,
          },
        },
      ],
      priority: 4,
    },
    tags: ["cross-sell", "bundling", "accessories", "electronics"],
  },

  // Geographic & Demographic Templates
  {
    id: "regional_expansion_promo",
    name: "Regional Market Penetration",
    description: "Special discounts for customers in new geographic markets",
    category: "customer_acquisition",
    difficulty: "intermediate",
    estimatedROI: "40-60% improvement in new region adoption",
    ruleConfig: {
      name: "Regional Market Penetration",
      description:
        "Special discount for customers in targeted expansion regions",
      conditions: [
        {
          conditionType: "customer_location",
          operator: "in_list",
          value: ["Texas", "Florida", "California"],
          logicOperator: "AND",
        },
        {
          conditionType: "customer_orders_count",
          operator: "less_than",
          value: 2, // New to brand in region
          logicOperator: "AND",
        },
      ],
      actions: [
        {
          actionType: "percentage_discount",
          value: { percentage: 25 },
          maxAmount: 40,
        },
        {
          actionType: "free_shipping",
          value: {},
        },
      ],
      priority: 7,
    },
    tags: ["geographic", "expansion", "regional", "market-penetration"],
  },

  // Inventory Management Templates
  {
    id: "slow_moving_inventory",
    name: "Intelligent Inventory Clearance",
    description: "Dynamic discounts for products with high inventory levels",
    category: "inventory_management",
    difficulty: "advanced",
    estimatedROI: "50-70% faster inventory turnover",
    ruleConfig: {
      name: "Intelligent Inventory Clearance",
      description: "Progressive discounts for overstocked items",
      conditions: [
        {
          conditionType: "product_inventory",
          operator: "greater_than",
          value: 50, // High stock levels
          logicOperator: "AND",
        },
        {
          conditionType: "product_created_date",
          operator: "before",
          value: "90_days_ago",
          logicOperator: "AND",
        },
      ],
      actions: [
        {
          actionType: "percentage_discount",
          value: { percentage: 35 },
          maxAmount: 100,
        },
      ],
      priority: 3,
    },
    tags: ["inventory", "clearance", "overstock", "automation"],
  },

  // Seasonal Event Templates
  {
    id: "holiday_early_bird",
    name: "Holiday Early Bird Special",
    description: "Reward early holiday shoppers with progressive discounts",
    category: "seasonal",
    difficulty: "intermediate",
    estimatedROI: "30-45% increase in early holiday sales",
    ruleConfig: {
      name: "Holiday Early Bird Special",
      description: "Better discounts for early holiday shopping",
      conditions: [
        {
          conditionType: "date_range",
          operator: "between",
          value: "2024-11-01,2024-11-20", // Early November
          logicOperator: "AND",
        },
        {
          conditionType: "cart_product_tags",
          operator: "contains",
          value: "gift",
          logicOperator: "AND",
        },
        {
          conditionType: "cart_total",
          operator: "greater_than",
          value: 150,
          logicOperator: "AND",
        },
      ],
      actions: [
        {
          actionType: "percentage_discount",
          value: { percentage: 22 },
          maxAmount: 60,
        },
      ],
      priority: 8,
    },
    tags: ["holiday", "early-bird", "seasonal", "gift"],
  },
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): RuleTemplate[] {
  return RULE_TEMPLATES.filter((template) => template.category === category);
}

/**
 * Get templates by difficulty
 */
export function getTemplatesByDifficulty(difficulty: string): RuleTemplate[] {
  return RULE_TEMPLATES.filter(
    (template) => template.difficulty === difficulty,
  );
}

/**
 * Search templates by name or tags
 */
export function searchTemplates(query: string): RuleTemplate[] {
  const lowercaseQuery = query.toLowerCase();
  return RULE_TEMPLATES.filter(
    (template) =>
      template.name.toLowerCase().includes(lowercaseQuery) ||
      template.description.toLowerCase().includes(lowercaseQuery) ||
      template.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)),
  );
}

/**
 * Get featured templates for dashboard
 */
export function getFeaturedTemplates(): RuleTemplate[] {
  return [
    RULE_TEMPLATES.find((t) => t.id === "vip_weekend_boost")!,
    RULE_TEMPLATES.find((t) => t.id === "new_customer_welcome")!,
    RULE_TEMPLATES.find((t) => t.id === "bulk_purchase_incentive")!,
    RULE_TEMPLATES.find((t) => t.id === "flash_friday_clearance")!,
  ].filter(Boolean);
}
