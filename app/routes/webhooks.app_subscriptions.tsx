import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { SubscriptionService } from "../services/subscription.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`📧 Received ${topic} webhook for ${shop}`);

    switch (topic) {
      case "APP_SUBSCRIPTIONS_UPDATE": {
        const charge = payload;

        // Handle subscription updates
        if (
          charge.status === "cancelled" ||
          charge.status === "declined" ||
          charge.status === "expired"
        ) {
          console.log(`📧 Subscription ${charge.status} for shop ${shop}`);

          // Downgrade to free plan
          await SubscriptionService.changePlan(shop, "free", null);

          console.log(
            `✅ Shop ${shop} downgraded to free plan due to ${charge.status}`,
          );
        }
        break;
      }

      case "APP_UNINSTALLED": {
        console.log(`📧 App uninstalled for shop ${shop}`);

        // Cancel subscription when app is uninstalled
        await SubscriptionService.cancelSubscription(shop);

        console.log(`✅ Subscription cancelled for uninstalled app: ${shop}`);
        break;
      }

      default:
        console.log(`⚠️  Unhandled webhook topic: ${topic}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Error processing billing webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
};
