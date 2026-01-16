import { prisma } from "./db.server";

//======================================
// DISCOUNT RULES MANAGER
// Multiple rules per discount
//======================================

export interface DiscountRule {
  id: string;
  shop: string;
  discountId: string;
  discountTitle: string;
  mode: "exclude" | "include";
  active: boolean;
  excludedCollections: Array<{
    id: string;
    collectionId: string;
    title: string;
    productsCount: number;
  }>;
  excludedProducts: Array<{
    id: string;
    productId: string;
    title: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export class RuleManager {
  /**
   * Recupera tutte le regole di uno shop
   */
  static async getRules(shop: string): Promise<DiscountRule[]> {
    const rules = await prisma.discountSpecificRule.findMany({
      where: { shop, active: true },
      include: {
        excludedCollections: true,
        excludedProducts: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return rules.map((rule) => ({
      id: rule.id,
      shop: rule.shop,
      discountId: rule.discountId,
      discountTitle: rule.discountTitle,
      mode: rule.mode as "exclude" | "include",
      active: rule.active,
      excludedCollections: rule.excludedCollections.map((col) => ({
        id: col.id,
        collectionId: col.collectionId,
        title: col.title,
        productsCount: col.productsCount,
      })),
      excludedProducts: rule.excludedProducts.map((prod) => ({
        id: prod.id,
        productId: prod.productId,
        title: prod.title,
      })),
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }));
  }

  /**
   * Recupera una regola specifica per un discount
   */
  static async getRuleForDiscount(
    shop: string,
    discountId: string,
  ): Promise<DiscountRule | null> {
    console.log(`🔍 [getRuleForDiscount] Searching rule for:`, {
      shop,
      discountId,
    });

    // Usa findFirst invece di findUnique con chiave composta che non funziona
    const rule = await prisma.discountSpecificRule.findFirst({
      where: {
        shop,
        discountId,
      },
      include: {
        excludedCollections: true,
        excludedProducts: true,
      },
    });

    console.log(
      `📊 [getRuleForDiscount] Query result:`,
      rule
        ? {
            id: rule.id,
            shop: rule.shop,
            discountId: rule.discountId,
            collectionsCount: rule.excludedCollections.length,
            productsCount: rule.excludedProducts.length,
          }
        : "NULL - No rule found",
    );

    if (!rule) {
      return null;
    }

    return {
      id: rule.id,
      shop: rule.shop,
      discountId: rule.discountId,
      discountTitle: rule.discountTitle,
      mode: rule.mode as "exclude" | "include",
      active: rule.active,
      excludedCollections: rule.excludedCollections.map((col) => ({
        id: col.id,
        collectionId: col.collectionId,
        title: col.title,
        productsCount: col.productsCount,
      })),
      excludedProducts: rule.excludedProducts.map((prod) => ({
        id: prod.id,
        productId: prod.productId,
        title: prod.title,
      })),
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  /**
   * Crea o aggiorna una regola
   */
  static async upsertRule(
    shop: string,
    data: {
      discountId: string;
      discountTitle?: string;
      discountType?: string;
      mode: "exclude" | "include";
      excludedCollections: Array<{
        id: string; // This comes from UI as 'id'
        title: string;
        productsCount?: number;
      }>;
      excludedProducts?: Array<{
        id: string; // This comes from UI as 'id'
        title: string;
      }>;
    },
  ): Promise<DiscountRule> {
    console.log("🔧 RuleManager.upsertRule called with:");
    console.log("- Shop:", shop);
    console.log("- Data:", data);

    if (!data.discountId) {
      throw new Error("discountId is required");
    }

    try {
      console.log("💾 Creating/updating rule in database...");

      // Map collections and products to the correct database format
      const mappedCollections = data.excludedCollections.map((col) => ({
        collectionId: col.id,
        title: col.title,
        productsCount: col.productsCount || 0,
      }));

      const mappedProducts = (data.excludedProducts || []).map((prod) => ({
        productId: prod.id,
        title: prod.title,
      }));

      console.log("📊 Mapped data for database:");
      console.log("- Collections:", mappedCollections);
      console.log("- Products:", mappedProducts);

      const rule = await prisma.discountSpecificRule.upsert({
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
            create: mappedCollections,
          },
          excludedProducts: {
            create: mappedProducts,
          },
        },
        update: {
          discountTitle: data.discountTitle,
          discountType: data.discountType,
          mode: data.mode,
          updatedAt: new Date(),
          excludedCollections: {
            deleteMany: {},
            create: mappedCollections,
          },
          excludedProducts: {
            deleteMany: {},
            create: mappedProducts,
          },
        },
        include: {
          excludedCollections: true,
          excludedProducts: true,
        },
      });

      console.log("✅ Database operation completed. Rule created/updated:");
      console.log("- Rule ID:", rule.id);
      console.log("- Collections count:", rule.excludedCollections.length);
      console.log("- Products count:", rule.excludedProducts.length);

      const result = {
        id: rule.id,
        shop: rule.shop,
        discountId: rule.discountId,
        discountTitle: rule.discountTitle,
        mode: rule.mode as "exclude" | "include",
        active: rule.active,
        excludedCollections: rule.excludedCollections.map((col) => ({
          id: col.id,
          collectionId: col.collectionId,
          title: col.title,
          productsCount: col.productsCount,
        })),
        excludedProducts: rule.excludedProducts.map((prod) => ({
          id: prod.id,
          productId: prod.productId,
          title: prod.title,
        })),
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      };

      console.log("🎯 Returning result:", result);
      return result;
    } catch (error) {
      console.error("❌ RuleManager.upsertRule failed:", error);
      throw error;
    }
  }

  /**
   * Elimina una regola specifica
   */
  static async deleteRule(shop: string, discountId: string): Promise<boolean> {
    try {
      await prisma.discountSpecificRule.delete({
        where: {
          shop_discountId: { shop, discountId },
        },
      });
      return true;
    } catch (error) {
      console.error("Failed to delete rule:", error);
      return false;
    }
  }

  /**
   * Disabilita una regola (soft delete)
   */
  static async disableRule(shop: string, discountId: string): Promise<boolean> {
    try {
      await prisma.discountSpecificRule.update({
        where: {
          shop_discountId: { shop, discountId },
        },
        data: {
          active: false,
          updatedAt: new Date(),
        },
      });
      return true;
    } catch (error) {
      console.error("Failed to disable rule:", error);
      return false;
    }
  }

  /**
   * Recupera la modalità dello shop (legacy o multiple rules)
   * Per ora ritorna sempre "multiple" poiché supportiamo solo regole multiple
   */
  static async getShopMode(): Promise<"legacy" | "multiple"> {
    // In futuro potremmo salvare questa preferenza nel database
    // Per ora assumiamo sempre modalità "multiple"
    return "multiple";
  }
  /**
   * Recupera i dettagli completi di un discount e delle sue regole per la configurazione
   */
  static async getDiscountRuleDetails(
    shop: string,
    discountId: string,
    admin?: any,
  ): Promise<{
    discountInfo: {
      id: string;
      title: string;
      value_type: string;
      value: string;
      status: string;
    } | null;
    rule: DiscountRule | null;
    hasExistingRule: boolean;
  }> {
    try {
      console.log(`🎯 [getDiscountRuleDetails] Starting for:`, {
        shop,
        discountId,
        hasAdmin: !!admin,
      });

      // Cerca la regola esistente per questo discount
      const existingRule = await this.getRuleForDiscount(shop, discountId);

      console.log(`🔍 [getDiscountRuleDetails] Existing rule result:`, {
        found: !!existingRule,
        ruleId: existingRule?.id,
        hasExclusions: existingRule
          ? {
              collections: existingRule.excludedCollections?.length || 0,
              products: existingRule.excludedProducts?.length || 0,
            }
          : null,
      });

      let discountInfo = null;

      // Se abbiamo l'admin object, recupera le informazioni reali dal discount
      if (admin) {
        try {
          const response = await admin.graphql(
            `#graphql
              query getDiscount($id: ID!) {
                discountNode(id: $id) {
                  discount {
                    ... on DiscountCodeBasic {
                      title
                      status
                      customerGets {
                        value {
                          ... on DiscountPercentage {
                            percentage
                          }
                          ... on DiscountAmount {
                            amount {
                              amount
                            }
                          }
                        }
                      }
                    }
                    ... on DiscountAutomaticBasic {
                      title
                      status
                      customerGets {
                        value {
                          ... on DiscountPercentage {
                            percentage
                          }
                          ... on DiscountAmount {
                            amount {
                              amount
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }`,
            {
              variables: { id: `gid://shopify/DiscountCodeNode/${discountId}` },
            },
          );

          const result = (await response.json()) as any;
          if (result.data?.discountNode?.discount) {
            const discount = result.data.discountNode.discount;
            const value = discount.customerGets?.value;

            discountInfo = {
              id: discountId,
              title: discount.title || `Discount ${discountId}`,
              value_type:
                value?.percentage !== undefined ? "percentage" : "fixed_amount",
              value:
                value?.percentage !== undefined
                  ? (value.percentage * 100).toString()
                  : value?.amount?.amount || "0",
              status: discount.status || "ACTIVE",
            };
          }
        } catch (apiError) {
          console.error(
            "Failed to fetch discount details from Shopify:",
            apiError,
          );
        }
      }

      // Fallback se non riusciamo a ottenere info reali
      if (!discountInfo) {
        discountInfo = {
          id: discountId,
          title: `Discount ${discountId}`,
          value_type: "percentage",
          value: "10",
          status: "ACTIVE",
        };
      }

      return {
        discountInfo,
        rule: existingRule,
        hasExistingRule: !!existingRule,
      };
    } catch (error) {
      console.error("Failed to get discount rule details:", error);
      return {
        discountInfo: null,
        rule: null,
        hasExistingRule: false,
      };
    }
  }
}
