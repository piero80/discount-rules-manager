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

// Types per le multiple global discount rules
export interface CreateDiscountRuleData {
  shop: string;
  name?: string;
  description?: string;
  mode: "exclude" | "include";
  priority?: number;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  isScheduled?: boolean;
  excludedCollections: Array<{
    collectionId: string;
    title: string;
    productsCount: number;
  }>;
}

export interface UpdateDiscountRuleData {
  name?: string;
  description?: string;
  mode?: "exclude" | "include";
  active?: boolean;
  priority?: number;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  isScheduled?: boolean;
  excludedCollections?: Array<{
    collectionId: string;
    title: string;
    productsCount: number;
  }>;
}

// Helper functions per le multiple global discount rules
export const discountRuleHelpers = {
  // Ottieni tutte le regole attive per uno shop (ordinate per priorità)
  async getActiveRules(shop: string) {
    return prisma.discountRule.findMany({
      where: {
        shop,
        active: true,
      },
      include: {
        excludedCollections: {
          select: {
            id: true,
            collectionId: true,
            title: true,
            productsCount: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { priority: "asc" }, // 0 = highest priority
        { updatedAt: "desc" },
      ],
    });
  },

  // Backward compatibility - ritorna la prima regola attiva
  async getActiveRule(shop: string) {
    const rules = await this.getActiveRules(shop);
    return rules.length > 0 ? rules[0] : null;
  },

  // Ottieni regole attive al momento corrente (considerando scheduling)
  async getActiveRulesAtTime(shop: string, currentTime: Date = new Date()) {
    const allRules = await this.getActiveRules(shop);

    return allRules.filter((rule) => {
      // Se non è schedulata, è sempre attiva
      if (!rule.isScheduled) return true;

      // Controlla se è nella finestra temporale
      const start = rule.scheduledStart;
      const end = rule.scheduledEnd;

      if (start && currentTime < start) return false;
      if (end && currentTime > end) return false;

      return true;
    });
  },

  // Dashboard stats per multiple rules
  async getRuleStats(shop: string) {
    const rules = await prisma.discountRule.findMany({
      where: { shop, active: true },
      select: {
        id: true,
        name: true,
        mode: true,
        priority: true,
        isScheduled: true,
        updatedAt: true,
        _count: {
          select: {
            excludedCollections: true,
          },
        },
      },
      orderBy: { priority: "asc" },
    });

    return {
      hasRules: rules.length > 0,
      rulesCount: rules.length,
      rules: rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        mode: rule.mode,
        priority: rule.priority,
        isScheduled: rule.isScheduled,
        excludedCount: rule._count.excludedCollections,
      })),
      lastActivity: rules.length > 0 ? rules[0].updatedAt?.toISOString() : null,
    };
  },

  // Crea una nuova regola (multiple rules allowed)
  async createRule(shop: string, data: CreateDiscountRuleData) {
    return prisma.discountRule.create({
      data: {
        shop: data.shop,
        name: data.name || "Rule",
        description: data.description,
        mode: data.mode,
        priority: data.priority || 0,
        scheduledStart: data.scheduledStart,
        scheduledEnd: data.scheduledEnd,
        isScheduled: data.isScheduled || false,
        active: true,
        excludedCollections: {
          create: data.excludedCollections,
        },
      },
      include: {
        excludedCollections: true,
      },
    });
  },

  // Backward compatibility - mantiene l'interfaccia esistente
  async createOrUpdateRule(shop: string, data: CreateDiscountRuleData) {
    // Per compatibilità, cerca se esiste già una regola e la aggiorna
    // Oppure crea la prima regola per questo shop
    const existingRule = await prisma.discountRule.findFirst({
      where: { shop },
      include: { excludedCollections: true },
    });

    if (existingRule) {
      // Aggiorna la prima regola esistente
      await prisma.excludedCollection.deleteMany({
        where: { ruleId: existingRule.id },
      });

      return prisma.discountRule.update({
        where: { id: existingRule.id },
        data: {
          name: data.name || existingRule.name,
          description: data.description || existingRule.description,
          mode: data.mode,
          priority: data.priority ?? existingRule.priority,
          scheduledStart: data.scheduledStart,
          scheduledEnd: data.scheduledEnd,
          isScheduled: data.isScheduled || false,
          active: true,
          updatedAt: new Date(),
          excludedCollections: {
            create: data.excludedCollections,
          },
        },
        include: {
          excludedCollections: true,
        },
      });
    } else {
      // Crea la prima regola
      return this.createRule(shop, data);
    }
  },

  // Aggiorna una regola esistente
  async updateRule(ruleId: string, data: Partial<UpdateDiscountRuleData>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Aggiorna solo i campi forniti
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.mode !== undefined) updateData.mode = data.mode;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.scheduledStart !== undefined)
      updateData.scheduledStart = data.scheduledStart;
    if (data.scheduledEnd !== undefined)
      updateData.scheduledEnd = data.scheduledEnd;
    if (data.isScheduled !== undefined)
      updateData.isScheduled = data.isScheduled;

    // Se ci sono collezioni escluse da aggiornare
    if (data.excludedCollections) {
      // Prima elimina tutte le collezioni esistenti
      await prisma.excludedCollection.deleteMany({
        where: { ruleId },
      });

      // Poi crea le nuove
      updateData.excludedCollections = {
        create: data.excludedCollections,
      };
    }

    return prisma.discountRule.update({
      where: { id: ruleId },
      data: updateData,
      include: {
        excludedCollections: true,
      },
    });
  },

  // Elimina una regola
  async deleteRule(ruleId: string) {
    return prisma.discountRule.delete({
      where: { id: ruleId },
      include: {
        excludedCollections: true,
      },
    });
  },

  // Ottieni tutte le regole per uno shop
  async getAllRules(shop: string) {
    return prisma.discountRule.findMany({
      where: { shop },
      include: {
        excludedCollections: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  // Log un'azione
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

  // Ottieni i log per uno shop
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
