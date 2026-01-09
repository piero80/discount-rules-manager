/**
 * Webhook Handler per Cart Updates
 * Applica conditional discounts in tempo reale quando il cart viene aggiornato
 */

import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { RuleEvaluationEngine } from "../services/rule-evaluation.server";
import { ShopifyDiscountService } from "../services/shopify-discount.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, shop } = await authenticate.webhook(request);

  try {
    const payload = await request.json();
    console.log("Cart update webhook received:", payload);

    // Estrai informazioni dal cart
    const cartData = {
      id: payload.id,
      token: payload.token,
      total_price: parseFloat(payload.total_price || "0"),
      line_items: payload.line_items || [],
      customer: payload.customer,
      created_at: payload.created_at,
      updated_at: payload.updated_at,
    };

    // Se non c'è customer, skip evaluation
    if (!cartData.customer?.email) {
      console.log("No customer email in cart, skipping discount evaluation");
      return new Response("OK", { status: 200 });
    }

    // Ottieni informazioni complete del customer da Shopify
    const customerInfo = await ShopifyDiscountService.findCustomerByEmail(
      admin,
      cartData.customer.email,
    );

    if (!customerInfo) {
      console.log("Customer not found:", cartData.customer.email);
      return new Response("OK", { status: 200 });
    }

    // Costruisci context per rule evaluation
    const evaluationContext = {
      customer: {
        id: customerInfo.id,
        email: customerInfo.email,
        tags: customerInfo.tags || [],
        ordersCount: customerInfo.numberOfOrders || 0,
        totalSpent: parseFloat(customerInfo.totalSpent || "0"),
        location: cartData.customer.default_address
          ? {
              country: cartData.customer.default_address.country,
              province: cartData.customer.default_address.province,
              city: cartData.customer.default_address.city,
            }
          : undefined,
      },
      cart: {
        id: cartData.id,
        total: cartData.total_price,
        itemCount: cartData.line_items.reduce(
          (sum: number, item: Record<string, unknown>) =>
            sum + (item.quantity as number),
          0,
        ),
        items: cartData.line_items.map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          variantId: item.variant_id,
          title: item.title,
          quantity: item.quantity,
          price: parseFloat(item.price || "0"),
        })),
      },
      timing: {
        dayOfWeek: new Date().toLocaleDateString("en-US", { weekday: "long" }),
        hour: new Date().getHours(),
        isWeekend: [0, 6].includes(new Date().getDay()),
      },
    };

    // TODO: Recupera regole attive dal database
    // Per ora usa le regole mock dall'app
    const activeRules = [
      {
        id: "1",
        name: "VIP Weekend Discount",
        description: "15% off for VIP customers",
        active: true,
        priority: 10,
        conditions: [
          {
            id: "c1",
            conditionType: "customer_tag",
            operator: "equals",
            value: "VIP",
            logicOperator: "AND",
          },
        ],
        actions: [
          {
            id: "a1",
            actionType: "percentage_discount",
            value: { percentage: 15 },
          },
        ],
        discountType: "percentage" as const,
        discountValue: 15,
        maxUsagePerCustomer: 5,
        maxTotalUsage: 1000,
      },
      {
        id: "test-tuesday",
        name: "VIP Tuesday Test",
        description: "Test rule for VIP customers on Tuesday",
        active: true,
        priority: 15,
        conditions: [
          {
            id: "tc1",
            conditionType: "customer_tag",
            operator: "equals",
            value: "VIP",
            logicOperator: "AND",
          },
          {
            id: "tc2",
            conditionType: "day_of_week",
            operator: "equals",
            value: "Tuesday",
            logicOperator: "AND",
          },
        ],
        actions: [
          {
            id: "ta1",
            actionType: "percentage_discount",
            value: { percentage: 25 },
          },
        ],
        discountType: "percentage" as const,
        discountValue: 25,
        maxUsagePerCustomer: 2,
        maxTotalUsage: 100,
      },
    ];

    // Valuta tutte le regole attive
    const engine = new RuleEvaluationEngine(admin, shop);

    for (const rule of activeRules) {
      try {
        const evaluation = await engine.evaluateRule(
          {
            ...rule,
            conditions: rule.conditions,
            actions: rule.actions,
          },
          evaluationContext,
        );

        if (evaluation.success && evaluation.shouldApply) {
          console.log(`Rule ${rule.name} applies, creating discount...`);

          // Crea discount specifico per questo customer e regola
          const discount =
            await ShopifyDiscountService.applyConditionalDiscount(
              admin,
              shop,
              customerInfo.id,
              {
                ruleId: rule.id,
                ruleName: rule.name,
                discountType: rule.discountType,
                value: rule.discountValue,
                conditions: rule.conditions,
                maxUsagePerCustomer: rule.maxUsagePerCustomer,
                maxTotalUsage: rule.maxTotalUsage,
              },
            );

          console.log(`Discount created:`, discount);

          // TODO: Notifica al frontend del discount disponibile
          // Potresti usare websockets o polling per aggiornare la UI
        } else {
          console.log(`Rule ${rule.name} does not apply:`, evaluation.reason);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing cart webhook:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
