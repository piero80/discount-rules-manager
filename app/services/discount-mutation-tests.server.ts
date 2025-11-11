import { authenticate } from "../shopify.server";
import {
  applyRuleToPriceRule,
  getDiscountCodes,
  debugDiscountCollectionUpdate,
} from "./discount.server";

interface MutationTestResult {
  testName: string;
  success: boolean;
  message: string;
  discountType: string;
  discountId?: string;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Test mutation per DiscountCodeBasic
 */
export async function testDiscountCodeBasicMutation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  shop: string,
): Promise<MutationTestResult> {
  try {
    console.log("🧪 Testing DiscountCodeBasic mutation...");

    const discounts = await getDiscountCodes(admin);
    const basicCodeDiscount = discounts.find(
      (d) => d.type === "DiscountCodeBasic",
    );

    if (!basicCodeDiscount) {
      return {
        testName: "DiscountCodeBasic Mutation",
        success: false,
        message: "No DiscountCodeBasic found for testing",
        discountType: "DiscountCodeBasic",
        error: "Test discount not available",
      };
    }

    console.log("🎯 Found DiscountCodeBasic:", basicCodeDiscount.title);

    // Type assertion for the ID
    const discountId = String(basicCodeDiscount.id);
    const result = await applyRuleToPriceRule(admin, shop, discountId);

    return {
      testName: "DiscountCodeBasic Mutation",
      success: result.success,
      message: result.success
        ? `Successfully applied rules to ${basicCodeDiscount.title}`
        : `Failed to apply rules: ${result.message}`,
      discountType: "DiscountCodeBasic",
      discountId: discountId,
      details: { discountTitle: basicCodeDiscount.title },
    };
  } catch (error) {
    console.error("❌ Error testing DiscountCodeBasic:", error);
    return {
      testName: "DiscountCodeBasic Mutation",
      success: false,
      message: "Exception occurred during test",
      discountType: "DiscountCodeBasic",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test mutation per DiscountAutomaticBasic
 */
export async function testDiscountAutomaticBasicMutation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  shop: string,
): Promise<MutationTestResult> {
  try {
    console.log("🧪 Testing DiscountAutomaticBasic mutation...");

    const discounts = await getDiscountCodes(admin);
    const automaticDiscount = discounts.find(
      (d) => d.type === "DiscountAutomaticBasic",
    );

    if (!automaticDiscount) {
      return {
        testName: "DiscountAutomaticBasic Mutation",
        success: false,
        message: "No DiscountAutomaticBasic found for testing",
        discountType: "DiscountAutomaticBasic",
        error: "Test discount not available",
      };
    }

    console.log("🎯 Found DiscountAutomaticBasic:", automaticDiscount.title);

    // Type assertion for the ID
    const discountId = String(automaticDiscount.id);
    const result = await applyRuleToPriceRule(admin, shop, discountId);

    return {
      testName: "DiscountAutomaticBasic Mutation",
      success: result.success,
      message: result.success
        ? `Successfully applied rules to ${automaticDiscount.title}`
        : `Failed to apply rules: ${result.message}`,
      discountType: "DiscountAutomaticBasic",
      discountId: discountId,
      details: { discountTitle: automaticDiscount.title },
    };
  } catch (error) {
    console.error("❌ Error testing DiscountAutomaticBasic:", error);
    return {
      testName: "DiscountAutomaticBasic Mutation",
      success: false,
      message: "Exception occurred during test",
      discountType: "DiscountAutomaticBasic",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test per tipi di discount non supportati (BXGY, Free Shipping)
 */
export async function testUnsupportedDiscountTypes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  shop: string,
): Promise<MutationTestResult[]> {
  try {
    console.log("🧪 Testing unsupported discount types...");

    const discounts = await getDiscountCodes(admin);
    const results: MutationTestResult[] = [];

    const unsupportedTypes = [
      "DiscountCodeBxgy",
      "DiscountAutomaticBxgy",
      "DiscountCodeFreeShipping",
      "DiscountAutomaticFreeShipping",
    ];

    for (const type of unsupportedTypes) {
      const discount = discounts.find((d) => d.type === type);

      if (discount) {
        console.log(`🎯 Found ${type}:`, discount.title);

        // Should fail gracefully with appropriate message
        const discountId = String(discount.id);
        const result = await applyRuleToPriceRule(admin, shop, discountId);

        results.push({
          testName: `${type} Rejection Test`,
          success: !result.success, // Success means it correctly rejected
          message: result.success
            ? "ERROR: Should have rejected unsupported type"
            : `Correctly rejected: ${result.message}`,
          discountType: type,
          discountId: discountId,
          details: { discountTitle: discount.title },
        });
      } else {
        results.push({
          testName: `${type} Rejection Test`,
          success: true,
          message: `No ${type} found (OK - not testing rejection)`,
          discountType: type,
          error: "Test discount not available",
        });
      }
    }

    return results;
  } catch (error) {
    console.error("❌ Error testing unsupported types:", error);
    return [
      {
        testName: "Unsupported Types Test",
        success: false,
        message: "Exception occurred during test",
        discountType: "Various",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    ];
  }
}

/**
 * Test GraphQL schema validation
 */
export async function testGraphQLSchemaValidation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<MutationTestResult> {
  try {
    console.log("🧪 Testing GraphQL schema validation...");

    // Test invalid mutation structure
    const invalidMutation = `#graphql
      mutation testInvalidMutation {
        discountCodeBasicUpdate(id: "invalid", basicCodeDiscount: {
          invalidField: "this should fail"
        }) {
          userErrors {
            field
            message
          }
        }
      }`;

    try {
      const response = await admin.graphql(invalidMutation);
      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        return {
          testName: "GraphQL Schema Validation",
          success: true,
          message: "Schema correctly rejected invalid mutation",
          discountType: "Schema Test",
          details: { errors: result.errors },
        };
      } else {
        return {
          testName: "GraphQL Schema Validation",
          success: false,
          message: "Schema did not reject invalid mutation",
          discountType: "Schema Test",
          error: "Validation should have failed",
        };
      }
    } catch (schemaError) {
      return {
        testName: "GraphQL Schema Validation",
        success: true,
        message: "Schema correctly rejected invalid mutation with exception",
        discountType: "Schema Test",
        details: {
          validationError:
            schemaError instanceof Error ? schemaError.message : "Unknown",
        },
      };
    }
  } catch (error) {
    console.error("❌ Error testing schema validation:", error);
    return {
      testName: "GraphQL Schema Validation",
      success: false,
      message: "Exception occurred during schema test",
      discountType: "Schema Test",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test debug session dettagliata
 */
export async function testDebugDiscountUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shop: string,
): Promise<MutationTestResult> {
  try {
    console.log("🧪 Testing debug discount update...");

    const discounts = await getDiscountCodes(admin);
    const testDiscount = discounts.find(
      (d) =>
        d.type === "DiscountCodeBasic" || d.type === "DiscountAutomaticBasic",
    );

    if (!testDiscount) {
      return {
        testName: "Debug Discount Update",
        success: false,
        message: "No suitable discount found for debug testing",
        discountType: "Debug Test",
        error: "Test discount not available",
      };
    }

    console.log("🎯 Testing debug on:", testDiscount.title);

    // Type assertions for the parameters
    const discountGid = String(
      testDiscount.gid || `gid://shopify/DiscountNode/${testDiscount.id}`,
    );
    const discountType = String(testDiscount.type);
    const discountId = String(testDiscount.id);

    // Run detailed debug session
    const debugResult = await debugDiscountCollectionUpdate(
      admin,
      discountGid,
      discountType,
    );

    return {
      testName: "Debug Discount Update",
      success: debugResult.success,
      message: debugResult.success
        ? "Debug session completed successfully"
        : "Debug session encountered issues",
      discountType: discountType,
      discountId: discountId,
      details: debugResult.details,
    };
  } catch (error) {
    console.error("❌ Error in debug test:", error);
    return {
      testName: "Debug Discount Update",
      success: false,
      message: "Exception occurred during debug test",
      discountType: "Debug Test",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test performance con multiple mutations
 */
export async function testBulkMutationPerformance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  shop: string,
): Promise<MutationTestResult> {
  try {
    console.log("🧪 Testing bulk mutation performance...");

    const discounts = await getDiscountCodes(admin);
    const supportedDiscounts = discounts.filter(
      (d) =>
        d.type === "DiscountCodeBasic" || d.type === "DiscountAutomaticBasic",
    );

    if (supportedDiscounts.length === 0) {
      return {
        testName: "Bulk Mutation Performance",
        success: false,
        message: "No supported discounts found for bulk testing",
        discountType: "Performance Test",
        error: "Test discounts not available",
      };
    }

    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    // Test up to 3 discounts to avoid rate limiting
    const testSet = supportedDiscounts.slice(0, 3);

    for (const discount of testSet) {
      try {
        const discountId = String(discount.id);
        const result = await applyRuleToPriceRule(admin, shop, discountId);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        failureCount++;
        console.warn(`Failed on discount ${discount.id}:`, error);
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const avgTime = duration / testSet.length;

    return {
      testName: "Bulk Mutation Performance",
      success: successCount > 0,
      message: `Processed ${testSet.length} discounts in ${duration}ms (avg: ${avgTime.toFixed(0)}ms/discount)`,
      discountType: "Performance Test",
      details: {
        totalDiscounts: testSet.length,
        successful: successCount,
        failed: failureCount,
        totalTimeMs: duration,
        averageTimeMs: avgTime,
      },
    };
  } catch (error) {
    console.error("❌ Error in performance test:", error);
    return {
      testName: "Bulk Mutation Performance",
      success: false,
      message: "Exception occurred during performance test",
      discountType: "Performance Test",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Esegue tutti i test di mutation GraphQL
 */
export async function runAllMutationTests(
  request: Request,
): Promise<MutationTestResult[]> {
  try {
    console.log("🚀 Starting comprehensive GraphQL mutation tests...");

    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;

    console.log("🔗 Connected to shop:", shop);
    console.log("👤 Session authenticated successfully");

    const results: MutationTestResult[] = [];

    // Basic connectivity test first
    try {
      console.log("🔍 Testing basic GraphQL connectivity...");
      const testQuery = `#graphql
        query {
          shop {
            id
            name
          }
        }`;
      
      const response = await admin.graphql(testQuery);
      const data = await response.json();
      
      if (data.data?.shop) {
        results.push({
          testName: "GraphQL Connectivity Test",
          success: true,
          message: `Successfully connected to shop: ${data.data.shop.name}`,
          discountType: "Connectivity Test",
          details: { shopId: data.data.shop.id, shopName: data.data.shop.name }
        });
      } else {
        results.push({
          testName: "GraphQL Connectivity Test",
          success: false,
          message: "Failed to query shop information",
          discountType: "Connectivity Test",
          error: "No shop data returned"
        });
      }
    } catch (connectError) {
      console.error("❌ GraphQL connectivity test failed:", connectError);
      results.push({
        testName: "GraphQL Connectivity Test",
        success: false,
        message: "GraphQL connection failed",
        discountType: "Connectivity Test",
        error: connectError instanceof Error ? connectError.message : "Unknown connectivity error"
      });
    }

    // 1. Test DiscountCodeBasic
    try {
      console.log("1️⃣ Testing DiscountCodeBasic...");
      const codeBasicResult = await testDiscountCodeBasicMutation(admin, shop);
      results.push(codeBasicResult);
    } catch (error) {
      console.error("❌ DiscountCodeBasic test failed:", error);
      results.push({
        testName: "DiscountCodeBasic Mutation",
        success: false,
        message: "Test execution failed",
        discountType: "DiscountCodeBasic",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    // 2. Test DiscountAutomaticBasic
    try {
      console.log("2️⃣ Testing DiscountAutomaticBasic...");
      const autoBasicResult = await testDiscountAutomaticBasicMutation(admin, shop);
      results.push(autoBasicResult);
    } catch (error) {
      console.error("❌ DiscountAutomaticBasic test failed:", error);
      results.push({
        testName: "DiscountAutomaticBasic Mutation",
        success: false,
        message: "Test execution failed",
        discountType: "DiscountAutomaticBasic",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    // 3. Test unsupported types
    try {
      console.log("3️⃣ Testing unsupported discount types...");
      const unsupportedResults = await testUnsupportedDiscountTypes(admin, shop);
      results.push(...unsupportedResults);
    } catch (error) {
      console.error("❌ Unsupported types test failed:", error);
      results.push({
        testName: "Unsupported Types Test",
        success: false,
        message: "Test execution failed",
        discountType: "Various",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    // 4. Test GraphQL schema validation
    try {
      console.log("4️⃣ Testing GraphQL schema validation...");
      const schemaResult = await testGraphQLSchemaValidation(admin);
      results.push(schemaResult);
    } catch (error) {
      console.error("❌ Schema validation test failed:", error);
      results.push({
        testName: "GraphQL Schema Validation",
        success: false,
        message: "Test execution failed",
        discountType: "Schema Test",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    // 5. Test debug functionality
    try {
      console.log("5️⃣ Testing debug functionality...");
      const debugResult = await testDebugDiscountUpdate(admin, shop);
      results.push(debugResult);
    } catch (error) {
      console.error("❌ Debug test failed:", error);
      results.push({
        testName: "Debug Discount Update",
        success: false,
        message: "Test execution failed",
        discountType: "Debug Test",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    // 6. Test bulk performance
    try {
      console.log("6️⃣ Testing bulk mutation performance...");
      const performanceResult = await testBulkMutationPerformance(admin, shop);
      results.push(performanceResult);
    } catch (error) {
      console.error("❌ Performance test failed:", error);
      results.push({
        testName: "Bulk Mutation Performance",
        success: false,
        message: "Test execution failed",
        discountType: "Performance Test",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    console.log("✅ All mutation tests completed!");
    console.log(
      `📊 Results: ${results.filter((r) => r.success).length}/${results.length} passed`,
    );

    return results;
  } catch (error) {
    console.error("❌ Error running mutation tests:", error);
    return [
      {
        testName: "Mutation Tests Suite",
        success: false,
        message: "Failed to run test suite",
        discountType: "Test Suite",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    ];
  }
}
