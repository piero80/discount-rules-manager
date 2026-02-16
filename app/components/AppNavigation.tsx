// Navigation wrapper component for Shopify app with latest App Bridge
import { Link } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";

export function AppNavigation() {
  const app = useAppBridge();

  useEffect(() => {
    if (!app) return;

    // Log App Bridge availability for debugging
    console.log("App Bridge initialized:", !!app);
  }, [app]);

  return (
    <s-app-nav>
      <Link to="/app" style={{ textDecoration: "none" }}>
        <s-link>Dashboard</s-link>
      </Link>
      <Link to="/app/rules" style={{ textDecoration: "none" }}>
        <s-link>Exclusion Rules</s-link>
      </Link>
      <Link to="/app/discounts" style={{ textDecoration: "none" }}>
        <s-link>Manage Discounts</s-link>
      </Link>
      <Link to="/app/pricing" style={{ textDecoration: "none" }}>
        <s-link>⭐ Pricing</s-link>
      </Link>
      <Link to="/app/billing" style={{ textDecoration: "none" }}>
        <s-link>💳 Billing</s-link>
      </Link>
      {/* <Link to="/app/test" style={{ textDecoration: "none" }}>
        <s-link>🧪 Test</s-link>
      </Link> */}
    </s-app-nav>
  );
}
