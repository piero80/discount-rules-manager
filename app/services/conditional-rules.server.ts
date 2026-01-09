/**
 * Conditional Rules Server Helpers
 * Gestisce CRUD operations per le conditional rules con database Prisma
 */

import { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "./db.server";
import { RuleEvaluationEngine } from "./rule-evaluation.server";
import { ShopifyDiscountService } from "./shopify-discount.server";
// import { authenticate } from "../shopify.server";

export interface ConditionalRuleData {
  id?: string;
  name: string;
  description?: string;
  active: boolean;
  priority: number;
  conditions: Array<{
    id: string;
    conditionType: string;
    operator: string;
    value: string | number | string[] | Record<string, unknown>;
    logicOperator: "AND" | "OR";
    negated?: boolean;
  }>;
  actions: Array<{
    id: string;
    actionType: string;
    value: string | number | string[] | Record<string, unknown>;
    maxAmount?: number;
  }>;
  maxUsagePerCustomer?: number;
  maxTotalUsage?: number;
  startDate?: Date;
  endDate?: Date;
}

export const conditionalRuleHelpers = {
  /**
   * Crea una nuova conditional rule
   */
  async createRule(
    shop: string,
    ruleData: ConditionalRuleData,
    admin: AdminApiContext,
  ) {
    try {
      // Salva nel database
      const rule = await prisma.conditionalRule.create({
        data: {
          shop,
          name: ruleData.name,
          description: ruleData.description,
          active: ruleData.active,
          priority: ruleData.priority,
          maxUsagePerCustomer: ruleData.maxUsagePerCustomer,
          maxTotalUsage: ruleData.maxTotalUsage,
          startDate: ruleData.startDate,
          endDate: ruleData.endDate,
          conditions: {
            create: ruleData.conditions.map((condition) => ({
              conditionType: condition.conditionType,
              operator: condition.operator,
              value: JSON.stringify(condition.value),
              logicOperator: condition.logicOperator,
              negated: condition.negated || false,
            })),
          },
          actions: {
            create: ruleData.actions.map((action) => ({
              actionType: action.actionType,
              value: JSON.stringify(action.value),
              maxAmount: action.maxAmount,
            })),
          },
        },
        include: {
          conditions: true,
          actions: true,
          executions: true,
        },
      });

      // Se la regola è attiva, crea/aggiorna discount automatico su Shopify
      if (rule.active && this.shouldCreateShopifyDiscount(ruleData)) {
        await this.createShopifyDiscountForRule(admin, shop, rule);
      }

      return rule;
    } catch (error) {
      console.error("Error creating conditional rule:", error);
      throw error;
    }
  },

  /**
   * Recupera tutte le regole per un shop
   */
  async getRules(shop: string, page = 1, pageSize = 20) {
    try {
      const rules = await prisma.conditionalRule.findMany({
        where: { shop },
        include: {
          conditions: true,
          actions: true,
          executions: {
            take: 5,
            orderBy: { executedAt: "desc" },
          },
        },
        orderBy: { priority: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      const totalRules = await prisma.conditionalRule.count({
        where: { shop },
      });

      // Trasforma i dati per il frontend
      const transformedRules = rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        active: rule.active,
        priority: rule.priority,
        maxUsagePerCustomer: rule.maxUsagePerCustomer,
        maxTotalUsage: rule.maxTotalUsage,
        startDate: rule.startDate,
        endDate: rule.endDate,
        conditions: rule.conditions.map((condition) => ({
          id: condition.id,
          conditionType: condition.conditionType,
          operator: condition.operator,
          value: JSON.parse(condition.value),
          logicOperator: condition.logicOperator,
          negated: condition.negated,
        })),
        actions: rule.actions.map((action) => ({
          id: action.id,
          actionType: action.actionType,
          value: JSON.parse(action.value),
          maxAmount: action.maxAmount,
        })),
        stats: {
          totalExecutions: rule.executions.length,
          lastExecution: rule.executions[0]?.executedAt,
        },
      }));

      return {
        rules: transformedRules,
        totalRules,
        page,
        pageSize,
        totalPages: Math.ceil(totalRules / pageSize),
      };
    } catch (error) {
      console.error("Error fetching conditional rules:", error);
      throw error;
    }
  },

  /**
   * Aggiorna una regola esistente
   */
  async updateRule(
    ruleId: string,
    ruleData: ConditionalRuleData,
    // admin: AdminApiContext,
  ) {
    try {
      // Elimina condizioni e azioni esistenti
      await prisma.ruleCondition.deleteMany({
        where: { ruleId: ruleId },
      });

      await prisma.ruleAction.deleteMany({
        where: { ruleId: ruleId },
      });

      // Aggiorna la regola
      const rule = await prisma.conditionalRule.update({
        where: { id: ruleId },
        data: {
          name: ruleData.name,
          description: ruleData.description,
          active: ruleData.active,
          priority: ruleData.priority,
          maxUsagePerCustomer: ruleData.maxUsagePerCustomer,
          maxTotalUsage: ruleData.maxTotalUsage,
          startDate: ruleData.startDate,
          endDate: ruleData.endDate,
          conditions: {
            create: ruleData.conditions.map((condition) => ({
              conditionType: condition.conditionType,
              operator: condition.operator,
              value: JSON.stringify(condition.value),
              logicOperator: condition.logicOperator,
              negated: condition.negated || false,
            })),
          },
          actions: {
            create: ruleData.actions.map((action) => ({
              actionType: action.actionType,
              value: JSON.stringify(action.value),
              maxAmount: action.maxAmount,
            })),
          },
        },
        include: {
          conditions: true,
          actions: true,
        },
      });

      return rule;
    } catch (error) {
      console.error("Error updating conditional rule:", error);
      throw error;
    }
  },

  /**
   * Elimina una regola
   */
  async deleteRule(ruleId: string) {
    try {
      // Elimina in cascata condizioni, azioni ed esecuzioni
      await prisma.ruleExecution.deleteMany({
        where: { ruleId: ruleId },
      });

      await prisma.ruleCondition.deleteMany({
        where: { ruleId: ruleId },
      });

      await prisma.ruleAction.deleteMany({
        where: { ruleId: ruleId },
      });

      await prisma.conditionalRule.delete({
        where: { id: ruleId },
      });

      return { success: true };
    } catch (error) {
      console.error("Error deleting conditional rule:", error);
      throw error;
    }
  },

  /**
   * Attiva/disattiva una regola
   */
  async toggleRule(ruleId: string, active: boolean) {
    try {
      const rule = await prisma.conditionalRule.update({
        where: { id: ruleId },
        data: { active },
        include: {
          conditions: true,
          actions: true,
        },
      });

      return rule;
    } catch (error) {
      console.error("Error toggling rule:", error);
      throw error;
    }
  },

  /**
   * Valuta tutte le regole attive per un customer/cart
   */
  async evaluateRulesForCustomer(
    shop: string,
    customerId: string,
    cartData?: unknown,
    admin?: unknown,
    customerData?: any, // Aggiunto parametro opzionale per dati mock
  ) {
    try {
      const activeRules = await prisma.conditionalRule.findMany({
        where: {
          shop,
          active: true,
        },
        include: {
          conditions: true,
          actions: true,
        },
        orderBy: { priority: "desc" },
      });

      if (!admin) {
        throw new Error("Admin API context required for rule evaluation");
      }

      const engine = new RuleEvaluationEngine(admin, shop);
      const evaluationResults = [];

      // Usa dati forniti o cerca via API
      let customerInfo;
      if (customerData) {
        console.log("Using provided customer data for evaluation");
        customerInfo = customerData;
      } else {
        console.log("Fetching customer data via API");
        customerInfo = await ShopifyDiscountService.getCustomerInfo(
          admin,
          customerId,
        );
      }

      if (!customerInfo) {
        throw new Error(`Customer ${customerId} not found`);
      }

      for (const rule of activeRules) {
        const context = {
          customer: {
            id: customerInfo.id,
            email: customerInfo.email,
            tags: customerInfo.tags || [],
            ordersCount:
              customerInfo.numberOfOrders || customerInfo.ordersCount || 0,
            totalSpent: parseFloat(customerInfo.totalSpent || "0"),
            location: customerInfo.defaultAddress
              ? {
                  country: customerInfo.defaultAddress.country,
                  province: customerInfo.defaultAddress.province,
                  city: customerInfo.defaultAddress.city,
                }
              : undefined,
          },
          cart: cartData || {},
          timing: {
            dayOfWeek: new Date().toLocaleDateString("en-US", {
              weekday: "long",
            }),
            hour: new Date().getHours(),
            isWeekend: [0, 6].includes(new Date().getDay()),
          },
        };

        const transformedRule = {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          active: rule.active,
          priority: rule.priority,
          conditions: rule.conditions.map((condition) => ({
            id: condition.id,
            conditionType: condition.conditionType,
            operator: condition.operator,
            value: JSON.parse(condition.value),
            logicOperator: condition.logicOperator,
            negated: condition.negated,
          })),
          actions: rule.actions.map((action) => ({
            id: action.id,
            actionType: action.actionType,
            value: JSON.parse(action.value),
            maxAmount: action.maxAmount,
          })),
        };

        const result = await engine.evaluateRule(transformedRule, context);
        evaluationResults.push({ rule: transformedRule, evaluation: result });

        // Se la regola si applica, registra l'esecuzione
        if (result.shouldApply) {
          await prisma.ruleExecution.create({
            data: {
              ruleId: rule.id,
              shop: shop,
              customerId: customerInfo.id,
              applied: true,
              discountAmount: result.discount || 0,
              executionData: JSON.stringify({
                context,
                evaluation: result,
                timestamp: new Date().toISOString(),
              }),
            },
          });
        }
      }

      return evaluationResults;
    } catch (error) {
      console.error("Error evaluating rules for customer:", error);
      throw error;
    }
  },

  /**
   * Determina se creare un discount automatico su Shopify
   */
  shouldCreateShopifyDiscount(ruleData: ConditionalRuleData): boolean {
    // Crea discount automatico solo per regole semplici
    // Regole complesse richiedono valutazione real-time
    const hasSimpleConditions = ruleData.conditions.every((condition) =>
      [
        "customer_tag",
        "customer_total_spent",
        "customer_orders_count",
      ].includes(condition.conditionType),
    );

    return (
      hasSimpleConditions &&
      ruleData.actions.some((action) =>
        ["percentage_discount", "fixed_discount"].includes(action.actionType),
      )
    );
  },

  /**
   * Crea discount automatico su Shopify per regole semplici
   */
  async createShopifyDiscountForRule(
    admin: unknown,
    shop: string,
    rule: ConditionalRuleData,
  ) {
    // Implementazione per regole che possono essere convertite in discount automatici Shopify
    // Per regole complesse, usa il webhook system
    console.log(`Creating Shopify discount for rule: ${rule.name}`);
  },
};
