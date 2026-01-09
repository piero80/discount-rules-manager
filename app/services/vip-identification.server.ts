/**
 * Sistema di Identificazione Clienti VIP
 * Diversi metodi per determinare se un cliente è VIP
 */

import type { EvaluationContext } from "./rule-evaluation.server";

export interface VipCriteria {
  method: "tag" | "spending" | "orders" | "combined" | "custom";
  config: Record<string, unknown>;
}

export class VipIdentificationService {
  /**
   * Metodo 1: Controllo Tag Shopify
   * Il più semplice - tag assegnato manualmente o da automazioni
   */
  static checkVipByTag(context: EvaluationContext): boolean {
    const customerTags = context.customer?.tags || [];

    // Controlla vari possibili tag VIP
    const vipTags = ["VIP", "vip", "Premium", "PREMIUM", "Gold", "Platinum"];

    return customerTags.some((tag) => vipTags.includes(tag));
  }

  /**
   * Metodo 2: Controllo per Spesa Totale
   * Cliente che ha speso oltre una certa soglia
   */
  static checkVipBySpending(
    context: EvaluationContext,
    threshold: number = 1000,
  ): boolean {
    const totalSpent = context.customer?.totalSpent || 0;
    return totalSpent >= threshold;
  }

  /**
   * Metodo 3: Controllo per Numero Ordini
   * Cliente fedele con molti acquisti
   */
  static checkVipByOrderCount(
    context: EvaluationContext,
    minOrders: number = 10,
  ): boolean {
    const ordersCount = context.customer?.ordersCount || 0;
    return ordersCount >= minOrders;
  }

  /**
   * Metodo 4: Criteri Combinati (Più Sofisticato)
   * Combina spesa, ordini e frequenza
   */
  static checkVipByCombinedCriteria(context: EvaluationContext): boolean {
    if (!context.customer) return false;

    const { totalSpent = 0, ordersCount = 0, createdAt } = context.customer;

    // Calcola l'età dell'account in giorni
    const accountAge = createdAt
      ? Math.floor(
          (context.currentTime.getTime() - new Date(createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    // Criteri VIP combinati
    const criteria = {
      // Alta spesa
      highSpender: totalSpent >= 500,

      // Cliente attivo (molti ordini)
      frequentBuyer: ordersCount >= 5,

      // Cliente di lunga data
      longTimeCustomer: accountAge >= 180, // 6 mesi

      // Spesa media per ordine elevata
      highAverageOrder:
        ordersCount > 0 ? totalSpent / ordersCount >= 75 : false,
    };

    // È VIP se soddisfa almeno 2 criteri su 4
    const metCriteria = Object.values(criteria).filter(Boolean).length;
    return metCriteria >= 2;
  }

  /**
   * Metodo 5: Segmentazione Dinamica
   * Calcola il "VIP Score" del cliente
   */
  static calculateVipScore(context: EvaluationContext): number {
    if (!context.customer) return 0;

    const { totalSpent = 0, ordersCount = 0, createdAt } = context.customer;

    let score = 0;

    // Punti per spesa totale (max 40 punti)
    score += Math.min(totalSpent / 50, 40);

    // Punti per numero ordini (max 30 punti)
    score += Math.min(ordersCount * 3, 30);

    // Punti per fedeltà (max 20 punti)
    if (createdAt) {
      const monthsAsCustomer = Math.floor(
        (context.currentTime.getTime() - new Date(createdAt).getTime()) /
          (1000 * 60 * 60 * 24 * 30),
      );
      score += Math.min(monthsAsCustomer * 2, 20);
    }

    // Punti bonus per spesa media alta (max 10 punti)
    const avgOrderValue = ordersCount > 0 ? totalSpent / ordersCount : 0;
    if (avgOrderValue >= 100) score += 10;
    else if (avgOrderValue >= 75) score += 5;

    return Math.min(score, 100); // Massimo 100 punti
  }

  /**
   * Metodo 6: Integrazione con Metafield Personalizzati
   * Usa metafield Shopify per dati VIP personalizzati
   */
  static async checkVipByMetafield(
    admin: unknown,
    customerId: string,
  ): Promise<boolean> {
    try {
      const response = await admin.graphql(
        `
        query GetCustomerMetafield($customerId: ID!) {
          customer(id: $customerId) {
            metafield(namespace: "custom", key: "vip_status") {
              value
            }
            vipTier: metafield(namespace: "loyalty", key: "tier") {
              value
            }
          }
        }
      `,
        { variables: { customerId } },
      );

      const data = await response.json();
      const customer = data.data?.customer;

      // Controlla metafield "vip_status"
      const vipStatus = customer?.metafield?.value;
      if (vipStatus === "true" || vipStatus === "active") return true;

      // Controlla tier di loyalty
      const vipTier = customer?.vipTier?.value;
      if (
        ["gold", "platinum", "diamond", "vip"].includes(vipTier?.toLowerCase())
      ) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking VIP metafield:", error);
      return false;
    }
  }

  /**
   * Metodo Principale - Determina VIP Status
   * Combina tutti i metodi per una valutazione completa
   */
  static async isCustomerVip(
    context: EvaluationContext,
    admin?: any,
    criteria: VipCriteria = { method: "combined", config: {} },
  ): Promise<boolean> {
    switch (criteria.method) {
      case "tag":
        return this.checkVipByTag(context);

      case "spending":
        const spendingThreshold = criteria.config.threshold || 1000;
        return this.checkVipBySpending(context, spendingThreshold);

      case "orders":
        const orderThreshold = criteria.config.minOrders || 10;
        return this.checkVipByOrderCount(context, orderThreshold);

      case "combined":
        return this.checkVipByCombinedCriteria(context);

      case "custom":
        if (admin && context.customer?.id) {
          const metafieldVip = await this.checkVipByMetafield(
            admin,
            context.customer.id,
          );
          if (metafieldVip) return true;
        }

        // Fallback ai criteri combinati
        return this.checkVipByCombinedCriteria(context);

      default:
        return this.checkVipByTag(context);
    }
  }
}

/**
 * Template di regole VIP pronte all'uso
 */
export const VIP_RULE_TEMPLATES = {
  // Template 1: VIP by Tag
  vipByTag: {
    name: "Sconto VIP - Tag Based",
    conditions: [
      {
        conditionType: "customer_tag",
        operator: "equals",
        value: "VIP",
        logicOperator: "AND",
      },
    ],
  },

  // Template 2: VIP by Spending
  vipBySpending: {
    name: "Sconto High Spender",
    conditions: [
      {
        conditionType: "customer_total_spent",
        operator: "greater_than",
        value: 1000,
        logicOperator: "AND",
      },
    ],
  },

  // Template 3: VIP Combinato
  vipCombined: {
    name: "Sconto VIP Avanzato",
    conditions: [
      {
        conditionType: "customer_total_spent",
        operator: "greater_than",
        value: 500,
        logicOperator: "AND",
      },
      {
        conditionType: "customer_orders_count",
        operator: "greater_than",
        value: 5,
        logicOperator: "AND",
      },
    ],
  },

  // Template 4: VIP Score Based
  vipScoreBased: {
    name: "Sconto VIP Score",
    conditions: [
      {
        conditionType: "customer_vip_score",
        operator: "greater_than",
        value: 70, // Score VIP > 70
        logicOperator: "AND",
      },
    ],
  },
};

/**
 * Esempi di configurazione VIP per diversi business
 */
export const VIP_BUSINESS_EXAMPLES = {
  // E-commerce fashion
  fashion: {
    criteria: { method: "combined", config: {} },
    thresholds: {
      spending: 800,
      orders: 8,
      avgOrder: 100,
    },
  },

  // Elettronica high-ticket
  electronics: {
    criteria: { method: "spending", config: { threshold: 2000 } },
    thresholds: {
      spending: 2000,
      orders: 3,
      avgOrder: 500,
    },
  },

  // Cosmetici/Beauty
  beauty: {
    criteria: { method: "combined", config: {} },
    thresholds: {
      spending: 400,
      orders: 10,
      avgOrder: 50,
    },
  },

  // B2B/Wholesale
  wholesale: {
    criteria: { method: "tag", config: {} },
    tags: ["Wholesale", "B2B", "Reseller", "VIP"],
  },
};
