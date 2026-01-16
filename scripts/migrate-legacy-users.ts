import { prisma } from "../app/services/db.server";
import { getDiscountCodes } from "../app/services/discount.server";

/**
 * MIGRATION SCRIPT: Legacy to Multiple Rules
 * Per migrare i 3 utenti esistenti dal sistema legacy al nuovo sistema multiple rules
 */

interface LegacyRule {
  id: string;
  shop: string;
  mode: string;
  active: boolean;
  excludedCollections: Array<{
    id: string;
    collectionId: string;
    title: string;
    productsCount: number;
  }>;
}

interface ShopifyDiscount {
  id: string;
  title: string;
  __typename: string;
}

export class MigrationService {
  /**
   * Migra TUTTI gli shop con regole legacy al nuovo sistema
   */
  static async migrateAllLegacyUsers(): Promise<{
    success: boolean;
    migratedShops: number;
    migratedRules: number;
    errors: string[];
  }> {
    console.log("🚀 Starting migration of legacy users...");

    const results = {
      success: true,
      migratedShops: 0,
      migratedRules: 0,
      errors: [] as string[],
    };

    try {
      // Step 1: Trova tutti gli shop con regole legacy
      const legacyShops = await this.getLegacyShops();
      console.log(`Found ${legacyShops.length} shops with legacy rules`);

      // Step 2: Per ogni shop, esegui la migrazione
      for (const shop of legacyShops) {
        try {
          console.log(`Migrating shop: ${shop}`);
          const migrationResult = await this.migrateSingleShop(shop);

          if (migrationResult.success) {
            results.migratedShops++;
            results.migratedRules += migrationResult.rulesCreated;
            console.log(
              `✅ ${shop}: ${migrationResult.rulesCreated} rules migrated`,
            );
          } else {
            results.errors.push(`${shop}: ${migrationResult.error}`);
            console.error(`❌ ${shop}: ${migrationResult.error}`);
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          results.errors.push(`${shop}: ${errorMsg}`);
          console.error(`❌ ${shop}: ${errorMsg}`);
        }
      }

      // Step 3: Se ci sono stati errori, la migrazione non è completamente riuscita
      if (results.errors.length > 0) {
        results.success = false;
      }

      console.log("🎉 Migration completed!");
      console.log(
        `📊 Results: ${results.migratedShops} shops, ${results.migratedRules} rules, ${results.errors.length} errors`,
      );

      return results;
    } catch (error) {
      console.error("💥 Migration failed:", error);
      return {
        success: false,
        migratedShops: 0,
        migratedRules: 0,
        errors: [
          error instanceof Error ? error.message : "Unknown migration error",
        ],
      };
    }
  }

  /**
   * Trova tutti gli shop che hanno regole legacy attive
   */
  private static async getLegacyShops(): Promise<string[]> {
    const shops = await prisma.discountRule.findMany({
      where: { active: true },
      select: { shop: true },
      distinct: ["shop"],
    });

    return shops.map((s) => s.shop);
  }

  /**
   * Migra un singolo shop dal legacy al multiple rules
   */
  private static async migrateSingleShop(shop: string): Promise<{
    success: boolean;
    rulesCreated: number;
    error?: string;
  }> {
    try {
      // Step 1: Ottieni la regola legacy esistente
      const legacyRule = await this.getLegacyRuleForShop(shop);

      if (!legacyRule) {
        return {
          success: false,
          rulesCreated: 0,
          error: "No legacy rule found",
        };
      }

      // Step 2: Ottieni tutti i discount di questo shop
      // NOTA: Qui servirebbe l'admin API, per ora simulo con dati mock
      const discounts = await this.getDiscountsForShop(shop);

      if (discounts.length === 0) {
        return {
          success: false,
          rulesCreated: 0,
          error: "No discounts found for shop",
        };
      }

      // Step 3: Crea ShopSettings
      await prisma.shopSettings.upsert({
        where: { shop },
        create: {
          shop,
          mode: "multiple",
          version: "2.0",
        },
        update: {
          mode: "multiple",
          version: "2.0",
        },
      });

      // Step 4: Per ogni discount, crea una DiscountSpecificRule
      let rulesCreated = 0;

      for (const discount of discounts) {
        await prisma.discountSpecificRule.create({
          data: {
            shop,
            discountId: discount.id,
            discountTitle: discount.title,
            discountType: discount.__typename,
            mode: legacyRule.mode,
            active: true,
            excludedCollections: {
              create: legacyRule.excludedCollections.map((ec) => ({
                collectionId: ec.collectionId,
                title: ec.title,
                productsCount: ec.productsCount,
              })),
            },
          },
        });

        rulesCreated++;
      }

      return { success: true, rulesCreated };
    } catch (error) {
      return {
        success: false,
        rulesCreated: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Ottieni la regola legacy per uno shop
   */
  private static async getLegacyRuleForShop(
    shop: string,
  ): Promise<LegacyRule | null> {
    const rule = await prisma.discountRule.findFirst({
      where: { shop, active: true },
      include: { excludedCollections: true },
    });

    if (!rule) return null;

    return {
      id: rule.id,
      shop: rule.shop,
      mode: rule.mode,
      active: rule.active,
      excludedCollections: rule.excludedCollections.map((ec) => ({
        id: ec.id,
        collectionId: ec.collectionId,
        title: ec.title,
        productsCount: ec.productsCount,
      })),
    };
  }

  /**
   * Ottieni tutti i discount per uno shop
   * NOTA: In produzione, questo dovrebbe usare l'admin API Shopify
   */
  private static async getDiscountsForShop(
    shop: string,
  ): Promise<ShopifyDiscount[]> {
    // Per ora ritorna dati mock - in produzione servirà admin API
    // Esempio di come dovrebbe funzionare:
    /*
    const admin = await getAdminForShop(shop);
    const discounts = await getDiscountCodes(admin);
    return discounts.map(d => ({
      id: d.id,
      title: d.title,
      __typename: d.__typename
    }));
    */

    // Mock data per testing
    const mockDiscounts = [
      {
        id: `${shop}-discount-1`,
        title: "Summer Sale",
        __typename: "DiscountCodeBasic",
      },
      {
        id: `${shop}-discount-2`,
        title: "VIP Discount",
        __typename: "DiscountAutomaticBasic",
      },
    ];

    return mockDiscounts;
  }

  /**
   * Verifica lo stato della migrazione
   */
  static async verifyMigration(): Promise<{
    legacyShops: number;
    migratedShops: number;
    totalRules: number;
    comparison: Array<{
      shop: string;
      legacyCollections: number;
      migratedCollections: number;
      match: boolean;
    }>;
  }> {
    // Conta shop legacy
    const legacyShopsCount = await prisma.discountRule.count({
      where: { active: true },
    });

    // Conta shop migrated
    const migratedShopsCount = await prisma.shopSettings.count({
      where: { mode: "multiple" },
    });

    // Conta regole totali
    const totalRules = await prisma.discountSpecificRule.count();

    // Confronto per shop
    const legacyRules = await prisma.discountRule.findMany({
      where: { active: true },
      include: { excludedCollections: true },
    });

    const comparison = [];

    for (const legacyRule of legacyRules) {
      const migratedCollections = await prisma.specificExcludedCollection.count(
        {
          where: {
            rule: {
              shop: legacyRule.shop,
            },
          },
        },
      );

      comparison.push({
        shop: legacyRule.shop,
        legacyCollections: legacyRule.excludedCollections.length,
        migratedCollections: migratedCollections,
        match:
          legacyRule.excludedCollections.length > 0
            ? migratedCollections > 0
            : migratedCollections === 0,
      });
    }

    return {
      legacyShops: legacyShopsCount,
      migratedShops: migratedShopsCount,
      totalRules,
      comparison,
    };
  }

  /**
   * Cleanup dei dati legacy (SOLO dopo verifica completa)
   */
  static async cleanupLegacyData(): Promise<{
    success: boolean;
    deletedRecords: number;
  }> {
    console.log("🧹 Starting cleanup of legacy data...");

    try {
      // Prima rimuovi le excluded collections
      const deletedCollections = await prisma.excludedCollection.deleteMany({});

      // Poi rimuovi le discount rules
      const deletedRules = await prisma.discountRule.deleteMany({});

      const totalDeleted = deletedCollections.count + deletedRules.count;

      console.log(`✅ Cleanup completed: ${totalDeleted} records deleted`);

      return { success: true, deletedRecords: totalDeleted };
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
      return { success: false, deletedRecords: 0 };
    }
  }
}

// Esempio di utilizzo:
/*
async function runMigration() {
  try {
    // 1. Esegui migrazione
    const result = await MigrationService.migrateAllLegacyUsers();
    console.log("Migration result:", result);
    
    // 2. Verifica migrazione
    const verification = await MigrationService.verifyMigration();
    console.log("Verification:", verification);
    
    // 3. Se tutto ok, cleanup (opzionale)
    if (result.success && verification.comparison.every(c => c.match)) {
      const cleanup = await MigrationService.cleanupLegacyData();
      console.log("Cleanup:", cleanup);
    }
  } catch (error) {
    console.error("Migration failed:", error);
  }
}
*/
