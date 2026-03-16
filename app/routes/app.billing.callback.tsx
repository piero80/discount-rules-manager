import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { ShopifyBillingService } from "../services/shopify-billing.server";
import { authenticate } from "../shopify.server";
import { type PlanName } from "../config/plans";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");
  const plan = url.searchParams.get("plan") as Exclude<PlanName, "free">;

  if (!chargeId || !plan) {
    console.error("❌ Missing charge_id or plan in billing callback");
    return redirect("/app/billing?error=missing_parameters");
  }

  try {
    const result = await ShopifyBillingService.activateCharge(
      request,
      chargeId,
      plan,
    );

    if (result.success) {
      // Redirect to success page with plan info
      return redirect(`/app/billing?success=true&plan=${plan}`);
    } else {
      // Redirect to billing page with error
      return redirect(
        `/app/billing?error=${encodeURIComponent(result.error || "activation_failed")}`,
      );
    }
  } catch (error) {
    console.error("❌ Error in billing callback:", error);
    return redirect("/app/billing?error=unexpected_error");
  }
}
