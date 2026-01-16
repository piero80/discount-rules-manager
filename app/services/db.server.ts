import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Singleton pattern per Prisma Client
let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      log: ["query", "error", "warn"],
    });
  }
  prisma = global.prismaGlobal;
}

export default prisma;
export { prisma };

// Types for Multiple Discount Rules System
export interface CreateDiscountRuleData {
  shop: string;
  discountId: string;
  discountTitle?: string;
  discountType?: string;
  mode: "exclude" | "include";
  excludedCollections: Array<{
    collectionId: string;
    title: string;
    productsCount: number;
  }>;
  excludedProducts?: Array<{
    productId: string;
    title: string;
  }>;
}

export interface UpdateDiscountRuleData {
  discountTitle?: string;
  discountType?: string;
  mode?: "exclude" | "include";
  active?: boolean;
  excludedCollections?: Array<{
    collectionId: string;
    title: string;
    productsCount: number;
  }>;
  excludedProducts?: Array<{
    productId: string;
    title: string;
  }>;
}

// Helper functions for multiple discount rules
export const discountRuleHelpers = {
  // Get all rules for a shop
  async getRulesForShop(shop: string) {
    return prisma.discountSpecificRule.findMany({
      where: {
        shop,
        active: true,
      },
      include: {
        excludedCollections: true,
        excludedProducts: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  },

  // Get rule for specific discount
  async getRuleForDiscount(shop: string, discountId: string) {
    return prisma.discountSpecificRule.findUnique({
      where: {
        shop_discountId: { shop, discountId },
      },
      include: {
        excludedCollections: true,
        excludedProducts: true,
      },
    });
  },

  // Create or update a rule for a specific discount
  async upsertDiscountRule(shop: string, data: CreateDiscountRuleData) {
    return prisma.discountSpecificRule.upsert({
      where: {
        shop_discountId: { shop, discountId: data.discountId },
      },
      create: {
        shop,
        discountId: data.discountId,
        discountTitle: data.discountTitle || "",
        discountType: data.discountType || "",
        mode: data.mode,
        excludedCollections: {
          create: data.excludedCollections,
        },
        excludedProducts: {
          create: data.excludedProducts || [],
        },
      },
      update: {
        discountTitle: data.discountTitle,
        discountType: data.discountType,
        mode: data.mode,
        updatedAt: new Date(),
        excludedCollections: {
          deleteMany: {},
          create: data.excludedCollections,
        },
        excludedProducts: {
          deleteMany: {},
          create: data.excludedProducts || [],
        },
      },
      include: {
        excludedCollections: true,
        excludedProducts: true,
      },
    });
  },

  // Update existing rule
  async updateDiscountRule(
    shop: string,
    discountId: string,
    data: UpdateDiscountRuleData,
  ) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.discountTitle !== undefined)
      updateData.discountTitle = data.discountTitle;
    if (data.discountType !== undefined)
      updateData.discountType = data.discountType;
    if (data.mode !== undefined) updateData.mode = data.mode;
    if (data.active !== undefined) updateData.active = data.active;

    if (data.excludedCollections) {
      updateData.excludedCollections = {
        deleteMany: {},
        create: data.excludedCollections,
      };
    }

    if (data.excludedProducts) {
      updateData.excludedProducts = {
        deleteMany: {},
        create: data.excludedProducts,
      };
    }

    return prisma.discountSpecificRule.update({
      where: {
        shop_discountId: { shop, discountId },
      },
      data: updateData,
      include: {
        excludedCollections: true,
        excludedProducts: true,
      },
    });
  },

  // Delete a rule
  async deleteDiscountRule(shop: string, discountId: string) {
    return prisma.discountSpecificRule.delete({
      where: {
        shop_discountId: { shop, discountId },
      },
    });
  },

  // Get rule stats for dashboard
  async getRuleStats(shop: string) {
    const rules = await prisma.discountSpecificRule.findMany({
      where: { shop, active: true },
      select: {
        id: true,
        discountId: true,
        discountTitle: true,
        mode: true,
        updatedAt: true,
        _count: {
          select: {
            excludedCollections: true,
            excludedProducts: true,
          },
        },
      },
    });

    return {
      totalRules: rules.length,
      rules: rules.map((rule) => ({
        discountId: rule.discountId,
        discountTitle: rule.discountTitle,
        mode: rule.mode,
        excludedCollections: rule._count.excludedCollections,
        excludedProducts: rule._count.excludedProducts,
        lastUpdated: rule.updatedAt.toISOString(),
      })),
    };
  },

  // Disable a rule (soft delete)
  async disableDiscountRule(shop: string, discountId: string) {
    return prisma.discountSpecificRule.update({
      where: {
        shop_discountId: { shop, discountId },
      },
      data: {
        active: false,
        updatedAt: new Date(),
      },
    });
  },

  // Enable a rule
  async enableDiscountRule(shop: string, discountId: string) {
    return prisma.discountSpecificRule.update({
      where: {
        shop_discountId: { shop, discountId },
      },
      data: {
        active: true,
        updatedAt: new Date(),
      },
    });
  },

  // Log an action (optional logging system)
  async logAction(
    shop: string,
    action: string,
    ruleId?: string,
    metadata?: Record<string, unknown>,
  ) {
    return prisma.ruleLog.create({
      data: {
        shop,
        action,
        ruleId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  },

  // Get logs for a shop (optional logging system)
  async getLogs(shop: string, limit = 50) {
    return prisma.ruleLog.findMany({
      where: { shop },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
  },
};
