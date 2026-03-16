import prisma from "./db.server";
import { PLAN_CONFIGS, type PlanName } from "../config/plans";

export interface PlanLimits {
  current: number;
  max: number;
  planName: string;
}

export interface SubscriptionInfo {
  planName: string;
  status: string;
  maxRules: number;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
}

export class SubscriptionService {
  /**
   * Get or create subscription for a shop
   */
  static async getSubscription(shop: string): Promise<SubscriptionInfo> {
    try {
      let subscription = await prisma.subscription.findUnique({
        where: { shop },
      });

      if (!subscription) {
        // Create free subscription for new shops
        subscription = await prisma.subscription.create({
          data: {
            shop,
            planName: "free",
            status: "ACTIVE",
            maxRules: PLAN_CONFIGS.free.maxRules,
            // No trial for free plan - it's free forever
            trialEndsAt: null,
          },
        });
      }

      return {
        planName: subscription.planName,
        status: subscription.status,
        maxRules: subscription.maxRules,
        trialEndsAt: subscription.trialEndsAt || undefined,
        currentPeriodEnd: subscription.currentPeriodEnd || undefined,
      };
    } catch (error) {
      console.error("❌ Error in getSubscription:", error);
      // Return default subscription on error
      return {
        planName: "free",
        status: "ACTIVE",
        maxRules: PLAN_CONFIGS.free.maxRules,
      };
    }
  }

  /**
   * Check plan limits for rules creation
   */
  static async getPlanLimits(shop: string): Promise<PlanLimits> {
    try {
      const subscription = await this.getSubscription(shop);

      const currentRules = await prisma.discountRule.count({
        where: { shop, active: true },
      });

      return {
        current: currentRules,
        max: subscription.maxRules,
        planName: subscription.planName,
      };
    } catch (error) {
      console.error("❌ Error in getPlanLimits:", error);
      // Return default limits on error
      return {
        current: 0,
        max: 2,
        planName: "free",
      };
    }
  }

  /**
   * Check if user can create more rules
   */
  static async canCreateRule(shop: string): Promise<boolean> {
    const limits = await this.getPlanLimits(shop);
    return limits.current < limits.max;
  }

  /**
   * Change plan (upgrade or downgrade) - For internal use only
   * Use ShopifyBillingService for billing integration
   */
  static async changePlan(
    shop: string,
    newPlan: PlanName,
    shopifyChargeId?: string | null,
  ): Promise<void> {
    const config = PLAN_CONFIGS[newPlan];
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    // Only set period for paid plans
    if (newPlan !== "free") {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }

    await prisma.subscription.upsert({
      where: { shop },
      update: {
        planName: newPlan,
        status: "ACTIVE",
        maxRules: config.maxRules,
        currentPeriodStart: newPlan !== "free" ? currentPeriodStart : null,
        currentPeriodEnd: newPlan !== "free" ? currentPeriodEnd : null,
        shopifyChargeId: shopifyChargeId,
        updatedAt: new Date(),
      },
      create: {
        shop,
        planName: newPlan,
        status: "ACTIVE",
        maxRules: config.maxRules,
        currentPeriodStart: newPlan !== "free" ? currentPeriodStart : null,
        currentPeriodEnd: newPlan !== "free" ? currentPeriodEnd : null,
        shopifyChargeId: shopifyChargeId,
      },
    });
  }

  /**
   * Upgrade subscription (legacy method - use changePlan instead)
   * @deprecated Use changePlan for better flexibility
   */
  static async upgradeSubscription(
    shop: string,
    newPlan: Exclude<PlanName, "free">,
  ): Promise<void> {
    await this.changePlan(shop, newPlan);
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(shop: string): Promise<void> {
    await prisma.subscription.update({
      where: { shop },
      data: {
        status: "CANCELED",
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Check if user is in trial period
   */
  static async isInTrial(shop: string): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
      where: { shop },
    });

    if (!subscription?.trialEndsAt) return false;

    return subscription.trialEndsAt > new Date();
  }
}
