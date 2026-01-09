import {
  VipIdentificationService,
  type VipCriteria,
} from "./vip-identification.server";

// Types for rule evaluation
export interface EvaluationContext {
  customer?: {
    id: string;
    email?: string;
    tags?: string[];
    ordersCount?: number;
    totalSpent?: number;
    createdAt?: string;
    location?: {
      country?: string;
      province?: string;
      city?: string;
    };
  };
  cart?: {
    totalValue: number;
    totalQuantity: number;
    totalWeight?: number;
    items: Array<{
      id: string;
      productId: string;
      variantId: string;
      title: string;
      price: number;
      quantity: number;
      tags?: string[];
      vendor?: string;
      productType?: string;
      collections?: string[];
    }>;
  };
  shop?: {
    timezone?: string;
    currency?: string;
  };
  currentTime: Date;
}

export interface RuleCondition {
  id: string;
  conditionType: string;
  operator: string;
  value: string | string[] | number;
  logicOperator: "AND" | "OR";
  negated?: boolean;
  parentId?: string;
}

export interface RuleAction {
  id: string;
  actionType: string;
  target?: string;
  value: string | string[] | number | Record<string, unknown>;
  maxAmount?: number;
}

export interface ConditionalRule {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  maxUsagePerCustomer?: number;
  maxTotalUsage?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface EvaluationResult {
  ruleId: string;
  success: boolean;
  shouldApply: boolean;
  discount?: number;
  reason?: string;
  appliedActions: Array<{
    actionType: string;
    value: Record<string, unknown>;
    discount?: number;
  }>;
  conditionResults: Array<{
    conditionId: string;
    passed: boolean;
    reason?: string;
  }>;
  executionTime: number;
  details: Record<string, unknown>;
}

export interface DiscountCalculation {
  type: "percentage" | "fixed" | "free_shipping" | "gift_product";
  value: number;
  maxAmount?: number;
  applicableItems?: string[]; // Product/variant IDs
  description?: string;
}

/**
 * Advanced Rule Evaluation Engine
 * Processes conditional discount rules with complex logic
 */
export class RuleEvaluationEngine {
  private admin: Record<string, unknown>;
  private shop: string;

  constructor(admin: Record<string, unknown>, shop: string) {
    this.admin = admin;
    this.shop = shop;
  }

  /**
   * Evaluate all rules for a given context
   */
  async evaluateRules(
    rules: ConditionalRule[],
    context: EvaluationContext,
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    // Sort rules by priority (highest first)
    const sortedRules = rules
      .filter((rule) => rule.active)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const result = await this.evaluateRule(rule, context);
      results.push(result);

      // Stop if we found an applicable rule (unless we want to allow stacking)
      if (result.success && result.shouldApply) {
        // For now, take the first applicable rule
        // TODO: Implement rule stacking logic
        break;
      }
    }

    return results;
  }

  /**
   * Evaluate a single rule
   */
  async evaluateRule(
    rule: ConditionalRule,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    try {
      // Check if rule is within time bounds
      if (!this.isRuleActiveAtTime(rule, context.currentTime)) {
        return {
          ruleId: rule.id,
          success: false,
          shouldApply: false,
          reason: "Rule not active at current time",
          appliedActions: [],
          conditionResults: [],
          executionTime: 0,
          details: {},
        };
      }

      // Check usage limits
      const usageLimitCheck = await this.checkUsageLimits(rule, context);
      if (!usageLimitCheck.allowed) {
        return {
          ruleId: rule.id,
          success: false,
          shouldApply: false,
          reason: usageLimitCheck.reason,
          appliedActions: [],
          conditionResults: [],
          executionTime: 0,
          details: {},
        };
      }

      // Evaluate all conditions
      const conditionsResult = await this.evaluateConditions(
        rule.conditions,
        context,
      );

      if (!conditionsResult.success) {
        return {
          ruleId: rule.id,
          success: false,
          shouldApply: false,
          reason: conditionsResult.reason,
          appliedActions: [],
          conditionResults: [],
          executionTime: 0,
          details: conditionsResult.details,
        };
      }

      // Calculate discount actions
      const discountCalculations = await this.calculateDiscounts(
        rule.actions,
        context,
      );

      return {
        ruleId: rule.id,
        success: true,
        shouldApply: true,
        discount: discountCalculations.reduce(
          (sum, calc) => sum + calc.value,
          0,
        ),
        appliedActions: rule.actions.map((action) => ({
          actionType: action.actionType,
          value: action.value as Record<string, unknown>,
          discount: discountCalculations.find((calc) => calc.value)?.value,
        })),
        conditionResults: [],
        executionTime: 0,
        details: {
          conditions: conditionsResult.details,
          calculations: discountCalculations,
        },
      };
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
      return {
        ruleId: rule.id,
        success: false,
        shouldApply: false,
        reason: `Evaluation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        appliedActions: [],
        conditionResults: [],
        executionTime: 0,
        details: {},
      };
    }
  }

  /**
   * Evaluate multiple conditions with logical operators
   */
  private async evaluateConditions(
    conditions: RuleCondition[],
    context: EvaluationContext,
  ): Promise<{
    success: boolean;
    reason?: string;
    details: Record<string, unknown>;
  }> {
    if (conditions.length === 0) {
      return { success: true, details: {} };
    }

    const evaluationDetails: Record<string, unknown> = {};
    const results: Array<{ condition: RuleCondition; result: boolean }> = [];

    // Evaluate each condition
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context);
      results.push({ condition, result });
      evaluationDetails[condition.id] = {
        type: condition.conditionType,
        operator: condition.operator,
        expected: condition.value,
        result,
        negated: condition.negated,
      };
    }

    // Apply logical operators
    let finalResult = results[0]?.result || false;
    let currentOperator: "AND" | "OR" = "AND";

    for (let i = 1; i < results.length; i++) {
      const { condition, result } = results[i];
      currentOperator = condition.logicOperator;

      if (currentOperator === "AND") {
        finalResult = finalResult && result;
      } else if (currentOperator === "OR") {
        finalResult = finalResult || result;
      }

      // Short circuit evaluation
      if (currentOperator === "AND" && !finalResult) {
        break;
      }
    }

    return {
      success: finalResult,
      reason: finalResult ? undefined : "One or more conditions not met",
      details: evaluationDetails,
    };
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: RuleCondition,
    context: EvaluationContext,
  ): Promise<boolean> {
    let result = false;

    switch (condition.conditionType) {
      // Customer conditions
      case "customer_tag":
        result = this.evaluateCustomerTag(condition, context);
        break;
      case "customer_email":
        result = this.evaluateCustomerEmail(condition, context);
        break;
      case "customer_orders_count":
        result = this.evaluateNumericCondition(
          context.customer?.ordersCount || 0,
          condition.operator,
          Number(condition.value),
        );
        break;
      case "customer_total_spent":
        result = this.evaluateNumericCondition(
          context.customer?.totalSpent || 0,
          condition.operator,
          Number(condition.value),
        );
        break;
      case "customer_location":
        result = this.evaluateCustomerLocation(condition, context);
        break;
      case "customer_account_age":
        result = this.evaluateCustomerAccountAge(condition, context);
        break;

      // VIP conditions - Enhanced VIP detection
      case "customer_is_vip":
        result = await this.evaluateCustomerIsVip(condition, context);
        break;
      case "customer_vip_score":
        result = this.evaluateCustomerVipScore(condition, context);
        break;

      // Cart conditions
      case "cart_total":
        result = this.evaluateNumericCondition(
          context.cart?.totalValue || 0,
          condition.operator,
          Number(condition.value),
        );
        break;
      case "cart_quantity":
        result = this.evaluateNumericCondition(
          context.cart?.totalQuantity || 0,
          condition.operator,
          Number(condition.value),
        );
        break;
      case "cart_weight":
        result = this.evaluateNumericCondition(
          context.cart?.totalWeight || 0,
          condition.operator,
          Number(condition.value),
        );
        break;
      case "cart_contains_product":
        result = this.evaluateCartContainsProduct(condition, context);
        break;
      case "cart_contains_collection":
        result = this.evaluateCartContainsCollection(condition, context);
        break;
      case "cart_product_tags":
        result = this.evaluateCartProductTags(condition, context);
        break;

      // Product conditions (applied to cart items)
      case "product_tag":
        result = this.evaluateProductTag(condition, context);
        break;
      case "product_type":
        result = this.evaluateProductType(condition, context);
        break;
      case "product_vendor":
        result = this.evaluateProductVendor(condition, context);
        break;

      // Temporal conditions
      case "day_of_week":
        result = this.evaluateDayOfWeek(condition, context);
        break;
      case "time_of_day":
        result = this.evaluateTimeOfDay(condition, context);
        break;
      case "date_range":
        result = this.evaluateDateRange(condition, context);
        break;
      case "days_since_signup":
        result = this.evaluateDaysSinceSignup(condition, context);
        break;

      default:
        console.warn(`Unknown condition type: ${condition.conditionType}`);
        result = false;
    }

    // Apply negation if specified
    return condition.negated ? !result : result;
  }

  // Customer condition evaluators
  private evaluateCustomerTag(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const customerTags = context.customer?.tags || [];
    return this.evaluateStringCondition(
      customerTags,
      condition.operator,
      condition.value,
    );
  }

  private evaluateCustomerEmail(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const email = context.customer?.email || "";
    return this.evaluateStringCondition(
      [email],
      condition.operator,
      condition.value,
    );
  }

  private evaluateCustomerLocation(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const location = context.customer?.location;
    if (!location) return false;

    const locationValues = [
      location.country,
      location.province,
      location.city,
    ].filter((value): value is string => Boolean(value));
    return this.evaluateStringCondition(
      locationValues,
      condition.operator,
      condition.value,
    );
  }

  private evaluateCustomerAccountAge(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    if (!context.customer?.createdAt) return false;

    const accountCreated = new Date(context.customer.createdAt);
    const daysSinceCreation = Math.floor(
      (context.currentTime.getTime() - accountCreated.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    return this.evaluateNumericCondition(
      daysSinceCreation,
      condition.operator,
      Number(condition.value),
    );
  }

  // VIP condition evaluators
  private async evaluateCustomerIsVip(
    condition: RuleCondition,
    context: EvaluationContext,
  ): Promise<boolean> {
    // Determina il metodo VIP dal valore della condizione
    const vipMethod: VipCriteria =
      typeof condition.value === "object" &&
      condition.value !== null &&
      "method" in condition.value
        ? (condition.value as VipCriteria)
        : { method: "tag", config: {} };

    return await VipIdentificationService.isCustomerVip(
      context,
      this.admin,
      vipMethod,
    );
  }

  private evaluateCustomerVipScore(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const vipScore = VipIdentificationService.calculateVipScore(context);
    return this.evaluateNumericCondition(
      vipScore,
      condition.operator,
      Number(condition.value),
    );
  }

  // Cart condition evaluators
  private evaluateCartContainsProduct(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const cartItems = context.cart?.items || [];
    const targetProductId = String(condition.value);

    return cartItems.some(
      (item) =>
        item.productId === targetProductId ||
        item.variantId === targetProductId,
    );
  }

  private evaluateCartContainsCollection(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const cartItems = context.cart?.items || [];
    const targetCollection = String(condition.value);

    return cartItems.some((item) =>
      item.collections?.includes(targetCollection),
    );
  }

  private evaluateCartProductTags(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const cartItems = context.cart?.items || [];
    const allTags = cartItems.flatMap((item) => item.tags || []);

    return this.evaluateStringCondition(
      allTags,
      condition.operator,
      condition.value,
    );
  }

  // Product condition evaluators
  private evaluateProductTag(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const cartItems = context.cart?.items || [];
    const allTags = cartItems.flatMap((item) => item.tags || []);

    return this.evaluateStringCondition(
      allTags,
      condition.operator,
      condition.value,
    );
  }

  private evaluateProductType(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const cartItems = context.cart?.items || [];
    const productTypes = cartItems
      .map((item) => item.productType)
      .filter(Boolean);

    return this.evaluateStringCondition(
      productTypes,
      condition.operator,
      condition.value,
    );
  }

  private evaluateProductVendor(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const cartItems = context.cart?.items || [];
    const vendors = cartItems.map((item) => item.vendor).filter(Boolean);

    return this.evaluateStringCondition(
      vendors,
      condition.operator,
      condition.value,
    );
  }

  // Temporal condition evaluators
  private evaluateDayOfWeek(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const currentDay = context.currentTime.toLocaleDateString("en-US", {
      weekday: "long",
    });
    const targetDays = Array.isArray(condition.value)
      ? condition.value
      : [condition.value];

    return targetDays.map((d) => String(d)).includes(currentDay);
  }

  private evaluateTimeOfDay(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const currentHour = context.currentTime.getHours();
    const [startHour, endHour] = String(condition.value).split("-").map(Number);

    return currentHour >= startHour && currentHour <= endHour;
  }

  private evaluateDateRange(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    const currentDate = context.currentTime;
    const [startDate, endDate] = String(condition.value)
      .split(",")
      .map((d) => new Date(d.trim()));

    return currentDate >= startDate && currentDate <= endDate;
  }

  private evaluateDaysSinceSignup(
    condition: RuleCondition,
    context: EvaluationContext,
  ): boolean {
    if (!context.customer?.createdAt) return false;

    const signupDate = new Date(context.customer.createdAt);
    const daysSinceSignup = Math.floor(
      (context.currentTime.getTime() - signupDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    return this.evaluateNumericCondition(
      daysSinceSignup,
      condition.operator,
      Number(condition.value),
    );
  }

  // Helper methods for condition evaluation
  private evaluateStringCondition(
    values: string[],
    operator: string,
    expectedValue: string | string[] | number,
  ): boolean {
    const expected = Array.isArray(expectedValue)
      ? expectedValue.map(String)
      : [String(expectedValue)];

    switch (operator) {
      case "equals":
        return values.some((v) => expected.includes(v));
      case "contains":
        return values.some((v) => expected.some((e) => v.includes(e)));
      case "starts_with":
        return values.some((v) => expected.some((e) => v.startsWith(e)));
      case "ends_with":
        return values.some((v) => expected.some((e) => v.endsWith(e)));
      case "in_list":
        return values.some((v) => expected.includes(v));
      default:
        return false;
    }
  }

  private evaluateNumericCondition(
    value: number,
    operator: string,
    expected: number,
  ): boolean {
    switch (operator) {
      case "equals":
        return value === expected;
      case "greater_than":
        return value > expected;
      case "less_than":
        return value < expected;
      case "greater_than_or_equal":
        return value >= expected;
      case "less_than_or_equal":
        return value <= expected;
      default:
        return false;
    }
  }

  // Rule timing and usage limit checks
  private isRuleActiveAtTime(
    rule: ConditionalRule,
    currentTime: Date,
  ): boolean {
    if (rule.startDate && currentTime < rule.startDate) {
      return false;
    }

    if (rule.endDate && currentTime > rule.endDate) {
      return false;
    }

    return true;
  }

  private async checkUsageLimits(
    rule: ConditionalRule,
    context: EvaluationContext,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // TODO: Implement actual usage tracking queries
    // For now, always allow
    return { allowed: true };
  }

  // Discount calculation
  private async calculateDiscounts(
    actions: RuleAction[],
    context: EvaluationContext,
  ): Promise<DiscountCalculation[]> {
    const calculations: DiscountCalculation[] = [];

    for (const action of actions) {
      switch (action.actionType) {
        case "percentage_discount":
          calculations.push({
            type: "percentage",
            value: action.value.percentage,
            maxAmount: action.maxAmount,
            description: `${action.value.percentage}% off`,
          });
          break;

        case "fixed_discount":
          calculations.push({
            type: "fixed",
            value: action.value.amount,
            description: `$${action.value.amount} off`,
          });
          break;

        case "free_shipping":
          calculations.push({
            type: "free_shipping",
            value: 0, // Will be calculated based on actual shipping cost
            description: "Free shipping",
          });
          break;

        default:
          console.warn(`Unknown action type: ${action.actionType}`);
      }
    }

    return calculations;
  }
}

/**
 * Helper function to create evaluation context from Shopify data
 */
export async function createEvaluationContext(
  admin: AdminApiContext["admin"],
  customerId?: string,
  cartData?: Record<string, unknown>,
): Promise<EvaluationContext> {
  const context: EvaluationContext = {
    currentTime: new Date(),
  };

  // Fetch customer data if provided
  if (customerId) {
    try {
      const customerResponse = await admin.graphql(
        `
        query GetCustomer($id: ID!) {
          customer(id: $id) {
            id
            email
            tags
            numberOfOrders
            createdAt
            defaultAddress {
              country
              province
              city
            }
            orders(first: 50) {
              nodes {
                totalPrice
              }
            }
          }
        }
      `,
        { variables: { id: customerId } },
      );

      const customerData = await customerResponse.json();

      if (customerData.data?.customer) {
        const customer = customerData.data.customer;

        // Calcola totalSpent dai orders
        const totalSpent =
          customer.orders?.nodes?.reduce((sum: number, order: any) => {
            return sum + parseFloat(order.totalPrice || 0);
          }, 0) || 0;

        context.customer = {
          id: customer.id,
          email: customer.email,
          tags: customer.tags,
          ordersCount: customer.numberOfOrders || 0,
          totalSpent: totalSpent,
          createdAt: customer.createdAt,
          location: customer.defaultAddress
            ? {
                country: customer.defaultAddress.country,
                province: customer.defaultAddress.province,
                city: customer.defaultAddress.city,
              }
            : undefined,
        };
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
    }
  }

  // Process cart data if provided
  if (cartData) {
    context.cart = {
      totalValue: cartData.totalValue || 0,
      totalQuantity: cartData.totalQuantity || 0,
      totalWeight: cartData.totalWeight,
      items: cartData.items || [],
    };
  }

  return context;
}
