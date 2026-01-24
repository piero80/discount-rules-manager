/**
 * Script per eseguire i test delle Multiple Global Rules
 */

import {
  testMultipleGlobalRules,
  testBasicMultipleRules,
} from "../app/services/multiple-rules-test.server";

async function runTests() {
  console.log("🚀 Starting Multiple Global Rules Database Tests...\n");

  // Test 1: Basic functionality
  console.log("=".repeat(60));
  console.log("🧪 TEST 1: Basic Multiple Rules Functionality");
  console.log("=".repeat(60));

  const basicResult = await testBasicMultipleRules();
  if (basicResult.success) {
    console.log("✅ BASIC TEST PASSED:", basicResult.message);
  } else {
    console.log("❌ BASIC TEST FAILED:", basicResult.message);
    if (basicResult.error) console.log("   Error:", basicResult.error);
    return; // Stop if basic test fails
  }

  console.log("\n");

  // Test 2: Full comprehensive test
  console.log("=".repeat(60));
  console.log("🧪 TEST 2: Comprehensive Multiple Rules Test");
  console.log("=".repeat(60));

  const fullResult = await testMultipleGlobalRules();
  if (fullResult.success) {
    console.log("✅ COMPREHENSIVE TEST PASSED:", fullResult.message);
    console.log("📊 Test Summary:", fullResult.data);
  } else {
    console.log("❌ COMPREHENSIVE TEST FAILED:", fullResult.message);
    if (fullResult.error) console.log("   Error:", fullResult.error);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 All tests completed!");
  console.log("=".repeat(60));
}

// Execute tests
runTests().catch((error) => {
  console.error("❌ Test execution failed:", error);
  process.exit(1);
});
