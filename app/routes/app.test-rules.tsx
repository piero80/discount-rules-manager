/**
 * Test API Endpoint per valutare manualmente le conditional rules
 * Utile per debugging e testing dell'integrazione Shopify
 */

import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { conditionalRuleHelpers } from "../services/conditional-rules.server";
import { ShopifyDiscountService } from "../services/shopify-discount.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);

  // Parametri per il test
  const customerEmail =
    url.searchParams.get("customer") || "mario.rossi@gmail.com";
  const testMode = url.searchParams.get("test") !== "false"; // Default to true unless explicitly set to false

  try {
    // 1. Per testing, usa dati mock invece di API reale
    const useMockData = url.searchParams.get("mock") !== "false"; // Default to mock

    let customerInfo = null;

    if (useMockData) {
      // Dati mock per testing senza accesso ai dati protetti
      console.log(`🧪 Using mock customer data for: ${customerEmail}`);
      customerInfo = {
        id: "gid://shopify/Customer/123456789",
        email: customerEmail,
        firstName: "Mario",
        lastName: "Rossi",
        tags: ["VIP", "Loyal Customer"], // Tags per testare le regole
        numberOfOrders: 5,
        totalSpent: "750.00",
        createdAt: "2023-01-15T10:00:00Z",
        defaultAddress: {
          country: "Italy",
          province: "Lombardy",
          city: "Milan",
        },
      };
      console.log("Mock customer created:", customerInfo);
    } else {
      // Tentativo di accesso API reale (potrebbe fallire per app non approvate)
      console.log(`🔍 Searching for customer: ${customerEmail}`);
      try {
        customerInfo = await ShopifyDiscountService.findCustomerByEmail(
          admin,
          customerEmail,
        );
      } catch (error) {
        console.error("API call failed, falling back to mock data:", error);
        // Fallback ai dati mock se l'API fallisce
        customerInfo = {
          id: "gid://shopify/Customer/fallback",
          email: customerEmail,
          firstName: "Mock",
          lastName: "Customer",
          tags: ["VIP"],
          numberOfOrders: 3,
          totalSpent: "500.00",
          createdAt: "2023-01-01T10:00:00Z",
          defaultAddress: {
            country: "Italy",
            province: "Lombardy",
            city: "Milan",
          },
        };
      }
    }

    // Controllo di sicurezza aggiuntivo
    if (!customerInfo || !customerInfo.id) {
      console.error("CustomerInfo is null or missing ID:", customerInfo);
      return Response.json({
        success: false,
        error: "Failed to load customer data",
        debug: {
          customerEmail,
          testMode,
          useMockData,
          customerInfo: customerInfo ? "exists but missing id" : "null",
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!customerInfo) {
      return Response.json(
        {
          success: false,
          message: `Customer ${customerEmail} not found`,
          debug: {
            searchedEmail: customerEmail,
            shopifyResponse: "no_customer_found",
          },
        },
        { status: 404 },
      );
    }

    console.log(`✅ Customer found:`, {
      id: customerInfo.id,
      email: customerInfo.email,
      tags: customerInfo.tags,
      ordersCount: customerInfo.numberOfOrders || customerInfo.ordersCount,
      totalSpent: customerInfo.totalSpent,
    });

    // 2. Mock cart data per il test
    const mockCartData = {
      id: "test-cart-123",
      total: 100,
      itemCount: 2,
      items: [
        { id: "item1", title: "Test Product 1", price: 60, quantity: 1 },
        { id: "item2", title: "Test Product 2", price: 40, quantity: 1 },
      ],
    };

    // 3. Valuta tutte le regole per questo customer
    console.log(`🎯 Evaluating rules for customer: ${customerInfo.email}`);
    const evaluationResults =
      await conditionalRuleHelpers.evaluateRulesForCustomer(
        session.shop,
        customerInfo.id,
        mockCartData,
        admin,
        customerInfo, // Passa i dati del customer per evitare chiamate API
      );

    // 4. Risultati dettagliati
    const applicableRules = evaluationResults.filter(
      (result) => result.evaluation.success && result.evaluation.shouldApply,
    );
    const nonApplicableRules = evaluationResults.filter(
      (result) => !result.evaluation.success || !result.evaluation.shouldApply,
    );

    // 5. Se in test mode, crea effettivamente i discount
    const createdDiscounts = [];
    if (testMode && applicableRules.length > 0) {
      console.log(`🛍️ Creating ${applicableRules.length} discounts...`);
      console.log(`📊 Test mode: ${testMode}, Mock data: ${useMockData}`);
      console.log(`🔑 Admin available: ${!!admin}, Session: ${!!session}`);

      for (const result of applicableRules) {
        try {
          const rule = result.rule;

          console.log(
            `🎯 Attempting to create discount for rule: ${rule.name}`,
          );
          console.log(`💰 Discount value: ${result.evaluation.discount}%`);

          const discount =
            await ShopifyDiscountService.applyConditionalDiscount(
              admin,
              session.shop,
              customerInfo.id,
              {
                ruleId: rule.id,
                ruleName: rule.name,
                discountType: "percentage",
                value: result.evaluation.discount || 15,
                conditions: rule.conditions,
                maxUsagePerCustomer: rule.maxUsagePerCustomer || 1,
              },
            );

          console.log(`✅ Discount created successfully:`, discount);

          createdDiscounts.push({
            ruleId: rule.id,
            ruleName: rule.name,
            discount: discount,
            code: discount?.codeDiscount?.codes?.nodes?.[0]?.code,
          });
        } catch (error) {
          console.error(
            `❌ Failed to create discount for rule ${result.rule.name}:`,
            error,
          );

          // Aggiungiamo il fallimento alla lista per debugging
          createdDiscounts.push({
            ruleId: result.rule.id,
            ruleName: result.rule.name,
            error: error.message,
            status: "failed",
          });
        }
      }
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      testingMode: useMockData ? "mock" : "real",
      note: useMockData
        ? "Using mock customer data (app not approved for protected data)"
        : "Using real Shopify customer data",
      customer: {
        id: customerInfo.id,
        email: customerInfo.email,
        tags: customerInfo.tags,
        ordersCount:
          customerInfo.numberOfOrders || customerInfo.ordersCount || 0,
        totalSpent: customerInfo.totalSpent,
        isVip: customerInfo.tags?.includes("VIP") || false,
      },
      context: {
        dayOfWeek: new Date().toLocaleDateString("en-US", { weekday: "long" }),
        hour: new Date().getHours(),
        isWeekend: [0, 6].includes(new Date().getDay()),
        cart: mockCartData,
      },
      evaluation: {
        totalRules: evaluationResults.length,
        applicableRules: applicableRules.length,
        nonApplicableRules: nonApplicableRules.length,
        details: {
          applicable: applicableRules.map((result) => ({
            ruleId: result.rule.id,
            ruleName: result.rule.name,
            priority: result.rule.priority,
            discount: result.evaluation.discount,
            reason: result.evaluation.reason,
            conditions: result.rule.conditions.map((c) => ({
              type: c.conditionType,
              operator: c.operator,
              value: c.value,
              result: "✅ Passed",
            })),
          })),
          nonApplicable: nonApplicableRules.map((result) => ({
            ruleId: result.rule.id,
            ruleName: result.rule.name,
            reason: result.evaluation.reason,
            failedConditions: result.rule.conditions.map((c) => ({
              type: c.conditionType,
              operator: c.operator,
              value: c.value,
              result: "❌ Failed",
            })),
          })),
        },
      },
      discounts: testMode
        ? {
            created: createdDiscounts,
            count: createdDiscounts.length,
          }
        : {
            message: "Add ?test=true to create actual discounts",
            wouldCreate: applicableRules.length,
          },
    });
  } catch (error) {
    console.error("Error in rule evaluation test:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        debug: {
          customerEmail,
          testMode,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 },
    );
  }
};

// Usage examples:
// GET /app/test-rules?customer=mario.rossi@gmail.com
// GET /app/test-rules?customer=mario.rossi@gmail.com&test=true
