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

// Types per le discount rules
export interface CreateDiscountRuleData {
  shop: string;
  mode: "exclude" | "include";
  excludedCollections: Array<{
    collectionId: string;
    title: string;
    productsCount: number;
  }>;
}

export interface UpdateDiscountRuleData {
  mode?: "exclude" | "include";
  active?: boolean;
  excludedCollections?: Array<{
    collectionId: string;
    title: string;
    productsCount: number;
  }>;
}

// Helper functions per le discount rules
export const discountRuleHelpers = {
  // Ottieni la regola per uno shop (dovrebbe essere una sola)
  async getActiveRule(shop: string) {
    return prisma.discountRule.findFirst({
      where: {
        shop,
        active: true,
      },
      include: {
        excludedCollections: true,
      },
      orderBy: {
        updatedAt: "desc", // Prende la più recente nel caso ci fossero duplicati
      },
    });
  },

  // Crea o aggiorna una regola (una sola regola per shop)
  async createOrUpdateRule(shop: string, data: CreateDiscountRuleData) {
    // Cerca la regola esistente per questo shop
    const existingRule = await prisma.discountRule.findFirst({
      where: { shop },
      include: { excludedCollections: true },
    });

    if (existingRule) {
      // Aggiorna la regola esistente
      // Prima elimina tutte le collezioni escluse esistenti
      await prisma.excludedCollection.deleteMany({
        where: { ruleId: existingRule.id },
      });

      // Poi aggiorna la regola con i nuovi dati
      return prisma.discountRule.update({
        where: { id: existingRule.id },
        data: {
          mode: data.mode,
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
      // Crea una nuova regola se non esiste
      return prisma.discountRule.create({
        data: {
          shop: data.shop,
          mode: data.mode,
          active: true,
          excludedCollections: {
            create: data.excludedCollections,
          },
        },
        include: {
          excludedCollections: true,
        },
      });
    }
  },

  // Aggiorna una regola esistente
  async updateRule(ruleId: string, data: UpdateDiscountRuleData) {
    const updateData: {
      mode?: "exclude" | "include";
      active?: boolean;
      updatedAt: Date;
      excludedCollections?: {
        create: Array<{
          collectionId: string;
          title: string;
          productsCount: number;
        }>;
      };
    } = {
      mode: data.mode,
      active: data.active,
      updatedAt: new Date(),
    };

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
