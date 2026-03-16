/**
 * Quick Billing Test Script
 * Run this in browser console during billing test
 */

// 1. Test upgrade button click
function testUpgradeFlow(planName = "starter") {
  console.log(`🧪 Testing upgrade to ${planName}`);

  // Check if upgrade button exists and click it
  const upgradeBtn = document.querySelector(`[data-plan="${planName}"]`);
  if (upgradeBtn) {
    console.log("✅ Upgrade button found");
    upgradeBtn.click();
  } else {
    console.log("❌ Upgrade button not found");
  }
}

// 2. Check billing callback success
function checkBillingCallback() {
  const url = window.location.href;
  const urlParams = new URLSearchParams(window.location.search);

  console.log("📍 Current URL:", url);
  console.log("📋 URL params:", Object.fromEntries(urlParams));

  if (url.includes("/billing/callback")) {
    console.log("✅ In billing callback page");

    if (urlParams.get("charge_id")) {
      console.log("✅ Charge ID present:", urlParams.get("charge_id"));
    } else {
      console.log("❌ No charge ID in callback");
    }
  }
}

// 3. Test database state via API
async function checkSubscriptionState() {
  try {
    const response = await fetch("/app/billing");
    const html = await response.text();

    // Look for plan indicators in HTML
    if (html.includes("Starter Plan")) {
      console.log("✅ Successfully upgraded to Starter");
    } else if (html.includes("Professional Plan")) {
      console.log("✅ Successfully upgraded to Professional");
    } else if (html.includes("Free Plan")) {
      console.log("ℹ️ Currently on Free plan");
    } else {
      console.log("❓ Could not determine current plan");
    }
  } catch (error) {
    console.error("❌ Error checking subscription state:", error);
  }
}

// Run all tests
console.log("🚀 Starting billing flow tests...");
checkBillingCallback();
checkSubscriptionState();

// Export functions for manual use
window.testBilling = {
  testUpgradeFlow,
  checkBillingCallback,
  checkSubscriptionState,
};

console.log(
  '💡 Use window.testBilling.testUpgradeFlow("professional") to test upgrades',
);
