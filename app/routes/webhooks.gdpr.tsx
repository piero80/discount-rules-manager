import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../services/db.server";

/**
 * GDPR Compliance Webhooks - OBBLIGATORI per Shopify App Store
 *
 * Questi 3 webhook sono richiesti da Shopify per conformità GDPR.
 * Devono essere implementati anche se l'app non memorizza dati customer.
 */

// TEMPORANEO - per verificare che la route funzioni
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response("GDPR webhook endpoint is active (use POST)", {
    status: 200,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop } = await authenticate.webhook(request);

    console.log(`🔒 GDPR Webhook received: ${topic} for shop ${shop}`);

    const payload = await request.json();

    switch (topic) {
      case "CUSTOMERS_DATA_REQUEST":
        await handleCustomersDataRequest(payload, shop);
        break;

      case "CUSTOMERS_REDACT":
        await handleCustomersRedact(payload, shop);
        break;

      case "SHOP_REDACT":
        await handleShopRedact(payload, shop);
        break;

      default:
        console.log(`Unhandled GDPR webhook topic: ${topic}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error: unknown) {
    console.error("❌ Unexpected error in GDPR webhook:");
    console.error(error);

    // Per qualsiasi errore imprevisto, ritorna comunque 401
    // (Shopify richiede 401 per problemi di autenticazione)
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
};

/**
 * 1. CUSTOMERS_DATA_REQUEST
 *
 * Triggered quando un merchant richiede i dati di un customer (GDPR Art. 15).
 * Devi fornire tutti i dati che hai su quel customer.
 *
 * Per la nostra app: NON memorizziamo dati customer diretti, solo regole discount.
 * Quindi rispondiamo che non abbiamo dati customer specifici.
 */
async function handleCustomersDataRequest(payload: unknown, shop: string) {
  console.log("📋 Customer data request received");
  console.log("Shop:", shop);
  const data = payload as { customer?: { email?: string; id?: string } };
  console.log("Customer email:", data.customer?.email);
  console.log("Customer ID:", data.customer?.id);

  // La nostra app NON memorizza dati customer personali
  // Memorizziamo solo:
  // - Regole di esclusione (a livello di shop)
  // - Collections escluse (dati pubblici del catalogo)

  // Se memorizzassimo dati customer (es: preferenze, usage logs),
  // dovremmo cercarli qui e inviarli al merchant via email.

  console.log(
    "ℹ️ No customer-specific data stored. Our app only stores shop-level discount rules.",
  );

  // Log della richiesta per audit trail
  await logGDPRRequest(shop, "data_request", data.customer?.id ?? null);

  // Nota: Se avessi dati customer, li invieresti così:
  // await sendCustomerDataToMerchant(shop, payload.customer, customerData);
}

/**
 * 2. CUSTOMERS_REDACT
 *
 * Triggered quando un merchant richiede la cancellazione dati customer (GDPR Art. 17).
 * Devi cancellare TUTTI i dati relativi a quel customer.
 *
 * Per la nostra app: Non memorizziamo dati customer, quindi niente da cancellare.
 */
async function handleCustomersRedact(payload: unknown, shop: string) {
  console.log("🗑️ Customer redact request received");
  console.log("Shop:", shop);
  const data = payload as { customer?: { email?: string; id?: string } };
  console.log("Customer email:", data.customer?.email);
  console.log("Customer ID:", data.customer?.id);

  // La nostra app NON memorizza dati customer
  // Se li memorizzassimo (es: user preferences, logs), li cancelleremmo qui:

  // Esempio:
  // await db.customerPreferences.deleteMany({
  //   where: {
  //     customerId: payload.customer.id,
  //     shop: shop,
  //   }
  // });

  console.log(
    "ℹ️ No customer data to redact. Our app doesn't store customer-specific information.",
  );

  // Log della richiesta per audit trail
  await logGDPRRequest(shop, "customer_redact", data.customer?.id ?? null);
}

/**
 * 3. SHOP_REDACT
 *
 * Triggered 48 ore DOPO che merchant disinstalla l'app.
 * Devi cancellare TUTTI i dati relativi a quello shop.
 *
 * Questo è IMPORTANTE: cancelliamo tutte le regole discount dello shop.
 */
async function handleShopRedact(payload: unknown, shop: string) {
  console.log("🏪 Shop redact request received");
  const data = payload as { shop_domain?: string; shop_id?: string };
  console.log("Shop domain:", data.shop_domain);
  console.log("Shop ID:", data.shop_id);

  try {
    // 1. Cancella tutte le discount rules dello shop
    const deletedRules = await prisma.discountRule.deleteMany({
      where: { shop: shop },
    });

    console.log(
      `✅ Deleted ${deletedRules.count} discount rules for shop ${shop}`,
    );

    // 2. Cancella excluded collections (cascade dovrebbe farlo automaticamente)
    // Ma per sicurezza verifichiamo:
    const deletedCollections = await prisma.excludedCollection.deleteMany({
      where: {
        rule: {
          shop: shop,
        },
      },
    });

    console.log(
      `✅ Deleted ${deletedCollections.count} excluded collections for shop ${shop}`,
    );

    // 3. Cancella eventuali logs
    const deletedLogs = await prisma.ruleLog.deleteMany({
      where: { shop: shop },
    });

    console.log(`✅ Deleted ${deletedLogs.count} logs for shop ${shop}`);

    // 4. Cancella session (se presente)
    await prisma.session.deleteMany({
      where: { shop: shop },
    });

    console.log(`✅ Deleted sessions for shop ${shop}`);

    // Log finale
    await logGDPRRequest(shop, "shop_redact", null);

    console.log(`🎉 Shop ${shop} data completely redacted`);
  } catch (error) {
    console.error(`❌ Error redacting shop ${shop}:`, error);
    throw error;
  }
}

/**
 * Helper: Log GDPR requests per audit trail
 */
async function logGDPRRequest(
  shop: string,
  requestType: string,
  customerId: string | null,
) {
  try {
    await prisma.ruleLog.create({
      data: {
        shop: shop,
        action: `gdpr_${requestType}`,
        metadata: JSON.stringify({
          customerId,
          timestamp: new Date().toISOString(),
        }),
      },
    });
  } catch (error) {
    console.error("Failed to log GDPR request:", error);
    // Non throware - il log non deve bloccare la compliance
  }
}

/**
 * Helper opzionale: Invia dati customer via email
 * (Usalo se memorizzi dati customer)
 */
/*
async function sendCustomerDataToMerchant(
  shop: string,
  customer: any,
  data: any
) {
  // Implementa invio email con dati customer
  // Es: usando SendGrid, Mailgun, ecc.
  
  const emailContent = {
    to: shop, // Email del merchant
    subject: `Customer Data Request - ${customer.email}`,
    body: `
      Customer Data for ${customer.email}:
      ${JSON.stringify(data, null, 2)}
    `,
  };
  
  // await sendEmail(emailContent);
}
*/
