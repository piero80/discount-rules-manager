/**
 * TEST SUITE: Migration Testing
 * Simula i 3 utenti esistenti e testa la migrazione completa
 */

import { prisma } from "../app/services/db.server";

export class MigrationTestSuite {
  /**
   * Crea dati mock che simulano i 3 utenti reali
   */
  static async createMockLegacyData(): Promise<void> {
    console.log("🏗️  Creating mock legacy data for 3 users...");

    // User 1: Shop con 2 collections escluse, regola exclude
    await prisma.discountRule.create({
      data: {
        shop: "test-shop-1.myshopify.com",
        mode: "exclude",
        active: true,
        excludedCollections: {
          create: [
            {
              collectionId: "gid://shopify/Collection/1001",
              title: "Luxury Items",
              productsCount: 15,
            },
            {
              collectionId: "gid://shopify/Collection/1002",
              title: "Sale Items",
              productsCount: 8,
            },
          ],
        },
      },
    });

    // User 2: Shop con 1 collection esclusa, regola include
    await prisma.discountRule.create({
      data: {
        shop: "test-shop-2.myshopify.com",
        mode: "include",
        active: true,
        excludedCollections: {
          create: [
            {
              collectionId: "gid://shopify/Collection/2001",
              title: "Featured Products",
              productsCount: 25,
            },
          ],
        },
      },
    });

    // User 3: Shop con 3 collections escluse, regola exclude
    await prisma.discountRule.create({
      data: {
        shop: "test-shop-3.myshopify.com",
        mode: "exclude",
        active: true,
        excludedCollections: {
          create: [
            {
              collectionId: "gid://shopify/Collection/3001",
              title: "Electronics",
              productsCount: 42,
            },
            {
              collectionId: "gid://shopify/Collection/3002",
              title: "Books",
              productsCount: 18,
            },
            {
              collectionId: "gid://shopify/Collection/3003",
              title: "Gift Cards",
              productsCount: 3,
            },
          ],
        },
      },
    });

    console.log("✅ Mock legacy data created!");
  }

  /**
   * Mock function per simulare l'API Shopify che restituisce discount
   */
  static getMockDiscountsForShop(
    shop: string,
  ): Array<{ id: string; title: string; __typename: string }> {
    const discountMocks = {
      "test-shop-1.myshopify.com": [
        {
          id: "gid://shopify/DiscountNode/1001",
          title: "Summer Sale 20%",
          __typename: "DiscountCodeBasic",
        },
        {
          id: "gid://shopify/DiscountNode/1002",
          title: "VIP Discount",
          __typename: "DiscountAutomaticBasic",
        },
        {
          id: "gid://shopify/DiscountNode/1003",
          title: "Flash Sale",
          __typename: "DiscountCodeBasic",
        },
        {
          id: "gid://shopify/DiscountNode/1004",
          title: "BOGO Deal",
          __typename: "DiscountAutomaticBxgy",
        },
      ],
      "test-shop-2.myshopify.com": [
        {
          id: "gid://shopify/DiscountNode/2001",
          title: "New Customer 15%",
          __typename: "DiscountCodeBasic",
        },
        {
          id: "gid://shopify/DiscountNode/2002",
          title: "Free Shipping",
          __typename: "DiscountAutomaticFreeShipping",
        },
        {
          id: "gid://shopify/DiscountNode/2003",
          title: "Loyalty Reward",
          __typename: "DiscountAutomaticBasic",
        },
      ],
      "test-shop-3.myshopify.com": [
        {
          id: "gid://shopify/DiscountNode/3001",
          title: "Weekly Special",
          __typename: "DiscountCodeBasic",
        },
        {
          id: "gid://shopify/DiscountNode/3002",
          title: "Bundle Discount",
          __typename: "DiscountAutomaticBasic",
        },
      ],
    };

    return discountMocks[shop] || [];
  }

  /**
   * Migrazione di test per un singolo shop
   */
  static async migrateSingleShopTest(shop: string): Promise<{
    success: boolean;
    rulesCreated: number;
    originalCollections: number;
    migratedCollections: number;
    error?: string;
  }> {
    try {
      console.log(`🔄 Migrating ${shop}...`);

      // 1. Ottieni regola legacy
      const legacyRule = await prisma.discountRule.findFirst({
        where: { shop, active: true },
        include: { excludedCollections: true },
      });

      if (!legacyRule) {
        return {
          success: false,
          rulesCreated: 0,
          originalCollections: 0,
          migratedCollections: 0,
          error: "No legacy rule",
        };
      }

      const originalCollectionsCount = legacyRule.excludedCollections.length;

      // 2. Ottieni discount mock
      const discounts = this.getMockDiscountsForShop(shop);

      // 3. Crea ShopSettings
      await prisma.shopSettings.upsert({
        where: { shop },
        create: { shop, mode: "multiple", version: "2.0" },
        update: { mode: "multiple", version: "2.0" },
      });

      // 4. Crea DiscountSpecificRule per ogni discount
      let rulesCreated = 0;
      let totalMigratedCollections = 0;

      for (const discount of discounts) {
        const createdRule = await prisma.discountSpecificRule.create({
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
        totalMigratedCollections += legacyRule.excludedCollections.length;
      }

      return {
        success: true,
        rulesCreated,
        originalCollections: originalCollectionsCount,
        migratedCollections: totalMigratedCollections,
      };
    } catch (error) {
      return {
        success: false,
        rulesCreated: 0,
        originalCollections: 0,
        migratedCollections: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Test completo di migrazione per tutti i 3 shop
   */
  static async runCompleteMigrationTest(): Promise<{
    success: boolean;
    results: Array<{
      shop: string;
      success: boolean;
      rulesCreated: number;
      originalCollections: number;
      migratedCollections: number;
      discountCount: number;
      error?: string;
    }>;
    summary: {
      totalShops: number;
      successfulMigrations: number;
      totalRulesCreated: number;
      totalCollectionsMigrated: number;
    };
  }> {
    console.log("🧪 Starting complete migration test...");

    const shops = [
      "test-shop-1.myshopify.com",
      "test-shop-2.myshopify.com",
      "test-shop-3.myshopify.com",
    ];

    const results = [];
    let totalRulesCreated = 0;
    let totalCollectionsMigrated = 0;
    let successfulMigrations = 0;

    for (const shop of shops) {
      const discountCount = this.getMockDiscountsForShop(shop).length;
      const migrationResult = await this.migrateSingleShopTest(shop);

      results.push({
        shop,
        success: migrationResult.success,
        rulesCreated: migrationResult.rulesCreated,
        originalCollections: migrationResult.originalCollections,
        migratedCollections: migrationResult.migratedCollections,
        discountCount,
        error: migrationResult.error,
      });

      if (migrationResult.success) {
        successfulMigrations++;
        totalRulesCreated += migrationResult.rulesCreated;
        totalCollectionsMigrated += migrationResult.migratedCollections;
      }
    }

    const overallSuccess = successfulMigrations === shops.length;

    return {
      success: overallSuccess,
      results,
      summary: {
        totalShops: shops.length,
        successfulMigrations,
        totalRulesCreated,
        totalCollectionsMigrated,
      },
    };
  }

  /**
   * Verifica che i dati migrati siano corretti
   */
  static async verifyMigrationTest(): Promise<{
    valid: boolean;
    checks: Array<{
      test: string;
      passed: boolean;
      details: any;
    }>;
  }> {
    console.log("🔍 Verifying migration...");

    const checks = [];

    // Check 1: Tutti gli shop hanno ShopSettings in modalità multiple
    const shopSettings = await prisma.shopSettings.findMany({
      where: {
        shop: {
          in: [
            "test-shop-1.myshopify.com",
            "test-shop-2.myshopify.com",
            "test-shop-3.myshopify.com",
          ],
        },
      },
    });

    checks.push({
      test: "All shops have ShopSettings with multiple mode",
      passed:
        shopSettings.length === 3 &&
        shopSettings.every((s) => s.mode === "multiple"),
      details: {
        found: shopSettings.length,
        expected: 3,
        modes: shopSettings.map((s) => s.mode),
      },
    });

    // Check 2: Numero di regole create corrisponde a discount × shop
    const totalDiscountSpecificRules =
      await prisma.discountSpecificRule.count();
    const expectedRules = 4 + 3 + 2; // Shop1: 4 discount, Shop2: 3 discount, Shop3: 2 discount

    checks.push({
      test: "Correct number of DiscountSpecificRules created",
      passed: totalDiscountSpecificRules === expectedRules,
      details: { found: totalDiscountSpecificRules, expected: expectedRules },
    });

    // Check 3: Collections escluse sono state replicate correttamente
    for (const shop of [
      "test-shop-1.myshopify.com",
      "test-shop-2.myshopify.com",
      "test-shop-3.myshopify.com",
    ]) {
      const legacyCollections = await prisma.excludedCollection.count({
        where: { rule: { shop } },
      });

      const migratedCollections = await prisma.specificExcludedCollection.count(
        {
          where: { rule: { shop } },
        },
      );

      const discountCount = this.getMockDiscountsForShop(shop).length;
      const expectedMigratedCollections = legacyCollections * discountCount;

      checks.push({
        test: `Collections properly replicated for ${shop}`,
        passed: migratedCollections === expectedMigratedCollections,
        details: {
          shop,
          legacyCollections,
          migratedCollections,
          expectedMigratedCollections,
          discountCount,
        },
      });
    }

    // Check 4: Mode preservation
    const modeCheck = await prisma.$queryRaw`
      SELECT 
        dr.shop,
        dr.mode as legacy_mode,
        dsr.mode as new_mode,
        COUNT(dsr.id) as new_rules_count
      FROM "DiscountRule" dr
      JOIN "DiscountSpecificRule" dsr ON dr.shop = dsr.shop
      GROUP BY dr.shop, dr.mode, dsr.mode
    `;

    checks.push({
      test: "Modes preserved during migration",
      passed:
        Array.isArray(modeCheck) &&
        (modeCheck as any[]).every(
          (row: any) => row.legacy_mode === row.new_mode,
        ),
      details: modeCheck,
    });

    const allPassed = checks.every((check) => check.passed);

    return {
      valid: allPassed,
      checks,
    };
  }

  /**
   * Test di rollback - rimuove tutti i dati migrati
   */
  static async testRollback(): Promise<{
    success: boolean;
    deletedRecords: number;
  }> {
    console.log("🔄 Testing rollback...");

    try {
      // Rimuovi dati migrati nell'ordine corretto (foreign keys)
      const deletedSpecificCollections =
        await prisma.specificExcludedCollection.deleteMany({
          where: {
            rule: {
              shop: {
                in: [
                  "test-shop-1.myshopify.com",
                  "test-shop-2.myshopify.com",
                  "test-shop-3.myshopify.com",
                ],
              },
            },
          },
        });

      const deletedSpecificRules = await prisma.discountSpecificRule.deleteMany(
        {
          where: {
            shop: {
              in: [
                "test-shop-1.myshopify.com",
                "test-shop-2.myshopify.com",
                "test-shop-3.myshopify.com",
              ],
            },
          },
        },
      );

      const deletedShopSettings = await prisma.shopSettings.deleteMany({
        where: {
          shop: {
            in: [
              "test-shop-1.myshopify.com",
              "test-shop-2.myshopify.com",
              "test-shop-3.myshopify.com",
            ],
          },
        },
      });

      const totalDeleted =
        deletedSpecificCollections.count +
        deletedSpecificRules.count +
        deletedShopSettings.count;

      return { success: true, deletedRecords: totalDeleted };
    } catch (error) {
      console.error("Rollback failed:", error);
      return { success: false, deletedRecords: 0 };
    }
  }

  /**
   * Cleanup completo - rimuove anche i dati legacy mock
   */
  static async cleanupTestData(): Promise<{ success: boolean }> {
    console.log("🧹 Cleaning up all test data...");

    try {
      // Prima rimuovi migrated data
      await this.testRollback();

      // Poi rimuovi legacy mock data
      await prisma.excludedCollection.deleteMany({
        where: {
          rule: {
            shop: {
              in: [
                "test-shop-1.myshopify.com",
                "test-shop-2.myshopify.com",
                "test-shop-3.myshopify.com",
              ],
            },
          },
        },
      });

      await prisma.discountRule.deleteMany({
        where: {
          shop: {
            in: [
              "test-shop-1.myshopify.com",
              "test-shop-2.myshopify.com",
              "test-shop-3.myshopify.com",
            ],
          },
        },
      });

      return { success: true };
    } catch (error) {
      console.error("Cleanup failed:", error);
      return { success: false };
    }
  }
}

/**
 * RUNNER: Esegue tutti i test in sequenza
 */
export async function runMigrationTests(): Promise<void> {
  try {
    console.log("🎬 Starting migration test suite...\n");

    // Step 1: Cleanup eventuale data precedente
    await MigrationTestSuite.cleanupTestData();
    console.log("✅ Previous test data cleaned\n");

    // Step 2: Crea dati mock
    await MigrationTestSuite.createMockLegacyData();
    console.log("✅ Mock legacy data created\n");

    // Step 3: Esegui migrazione test
    const migrationResults =
      await MigrationTestSuite.runCompleteMigrationTest();

    console.log("📊 MIGRATION RESULTS:");
    console.log(`Overall success: ${migrationResults.success ? "✅" : "❌"}`);
    console.log(
      `Shops migrated: ${migrationResults.summary.successfulMigrations}/${migrationResults.summary.totalShops}`,
    );
    console.log(`Rules created: ${migrationResults.summary.totalRulesCreated}`);
    console.log(
      `Collections migrated: ${migrationResults.summary.totalCollectionsMigrated}\n`,
    );

    // Dettaglio per shop
    migrationResults.results.forEach((result) => {
      console.log(
        `${result.shop}: ${result.success ? "✅" : "❌"} ${result.rulesCreated} rules, ${result.migratedCollections} collections`,
      );
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });
    console.log("");

    // Step 4: Verifica migrazione
    if (migrationResults.success) {
      const verification = await MigrationTestSuite.verifyMigrationTest();

      console.log("🔍 VERIFICATION RESULTS:");
      console.log(`Overall valid: ${verification.valid ? "✅" : "❌"}\n`);

      verification.checks.forEach((check) => {
        console.log(`${check.passed ? "✅" : "❌"} ${check.test}`);
        if (!check.passed) {
          console.log(`  Details:`, check.details);
        }
      });
      console.log("");

      // Step 5: Test rollback
      console.log("🔄 Testing rollback capability...");
      const rollbackResult = await MigrationTestSuite.testRollback();
      console.log(
        `Rollback: ${rollbackResult.success ? "✅" : "❌"} (${rollbackResult.deletedRecords} records removed)\n`,
      );

      // Summary finale
      const allTestsPassed =
        migrationResults.success &&
        verification.valid &&
        rollbackResult.success;

      console.log("🎉 FINAL RESULT:");
      console.log(
        `Migration test suite: ${allTestsPassed ? "✅ PASSED" : "❌ FAILED"}`,
      );

      if (allTestsPassed) {
        console.log("\n✨ Migration is ready for production! ✨");
      } else {
        console.log("\n⚠️  Fix issues before running in production!");
      }
    }

    // Cleanup finale
    await MigrationTestSuite.cleanupTestData();
  } catch (error) {
    console.error("💥 Test suite failed:", error);
  }
}
