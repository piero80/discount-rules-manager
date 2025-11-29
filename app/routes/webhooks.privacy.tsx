import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// Handles Shopify mandatory privacy compliance webhooks
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Authenticate and verify HMAC
    const webhookResult = await authenticate.webhook(request);
    const topic = webhookResult?.topic ?? "";
    // Shopify's webhook context throws if HMAC is invalid, so just proceed

    switch (topic) {
      case "customers/data_request":
        // Handle customer data request (no customer data stored)
        break;
      case "customers/redact":
        // Handle customer redact (no customer data stored)
        break;
      case "shop/redact":
        // Handle shop redact (no customer data stored)
        break;
      default:
        break;
    }

    return new Response("OK");
  } catch (err) {
    return new Response("Unauthorized", { status: 401 });
  }
};
