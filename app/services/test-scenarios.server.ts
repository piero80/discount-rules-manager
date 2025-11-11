/**
 * Test scenarios for edge cases and invalid states
 * Use these functions to simulate various error conditions
 */

export interface TestScenario {
  name: string;
  description: string;
  execute: () => Promise<TestResult>;
}

export interface TestResult {
  success: boolean;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
}

/**
 * Test scenario 1: Empty collections array
 */
export async function testEmptyCollections(): Promise<TestResult> {
  try {
    const { getEntitledCollections } = await import("./discount.server");

    // Simulate empty collections from Shopify
    const emptyCollections: Array<{ id: string; title: string }> = [];
    const result = await getEntitledCollections("test-shop", emptyCollections);

    return {
      success: true,
      message: "Empty collections handled correctly",
      data: { entitledCollections: result },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to handle empty collections",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test scenario 2: Invalid collection IDs
 */
export async function testInvalidCollectionIds(): Promise<TestResult> {
  try {
    const { getEntitledCollections } = await import("./discount.server");

    // Simulate collections with invalid/malformed IDs
    const invalidCollections = [
      { id: "", title: "Empty ID Collection" },
      { id: "invalid-id", title: "Malformed ID Collection" },
      {
        id: "gid://shopify/Collection/999999999",
        title: "Non-existent Collection",
      },
    ];

    const result = await getEntitledCollections(
      "test-shop",
      invalidCollections,
    );

    return {
      success: true,
      message: "Invalid collection IDs handled correctly",
      data: { entitledCollections: result },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to handle invalid collection IDs",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test scenario 3: No active rule
 */
export async function testNoActiveRule(): Promise<TestResult> {
  try {
    const { getEntitledCollections } = await import("./discount.server");

    const normalCollections = [
      { id: "gid://shopify/Collection/1", title: "Collection 1" },
      { id: "gid://shopify/Collection/2", title: "Collection 2" },
    ];

    // This should return all collections when no rule exists
    const result = await getEntitledCollections(
      "test-shop-no-rule",
      normalCollections,
    );

    const shouldIncludeAll = result.length === normalCollections.length;

    return {
      success: shouldIncludeAll,
      message: shouldIncludeAll
        ? "No active rule correctly includes all collections"
        : "No active rule should include all collections",
      data: {
        expected: normalCollections.length,
        actual: result.length,
        entitledCollections: result,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to handle no active rule scenario",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test scenario 4: Collections with special characters
 */
export async function testSpecialCharacterCollections(): Promise<TestResult> {
  try {
    const { getEntitledCollections } = await import("./discount.server");

    const specialCollections = [
      {
        id: "gid://shopify/Collection/1",
        title: "Collection with émojis 🎉🛍️",
      },
      { id: "gid://shopify/Collection/2", title: "Cóllection with àccénts" },
      {
        id: "gid://shopify/Collection/3",
        title: 'Collection with "quotes" & symbols!',
      },
      { id: "gid://shopify/Collection/4", title: "" }, // Empty title
    ];

    const result = await getEntitledCollections(
      "test-shop",
      specialCollections,
    );

    return {
      success: true,
      message: "Special character collections handled correctly",
      data: { entitledCollections: result },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to handle special character collections",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test scenario 5: Large number of collections
 */
export async function testLargeCollectionSet(): Promise<TestResult> {
  try {
    const { getEntitledCollections } = await import("./discount.server");

    // Generate 100 test collections
    const largeCollections = Array.from({ length: 100 }, (_, i) => ({
      id: `gid://shopify/Collection/${i + 1}`,
      title: `Test Collection ${i + 1}`.repeat(Math.floor(i / 10) + 1), // Some with long names
    }));

    const start = Date.now();
    const result = await getEntitledCollections("test-shop", largeCollections);
    const duration = Date.now() - start;

    return {
      success: duration < 1000, // Should complete within 1 second
      message: `Large collection set processed in ${duration}ms`,
      data: {
        collectionCount: largeCollections.length,
        resultCount: result.length,
        duration,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to handle large collection set",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Run all test scenarios
 */
export async function runAllTestScenarios(): Promise<TestResult[]> {
  const scenarios = [
    testEmptyCollections,
    testInvalidCollectionIds,
    testNoActiveRule,
    testSpecialCharacterCollections,
    testLargeCollectionSet,
  ];

  const results: TestResult[] = [];

  for (const scenario of scenarios) {
    try {
      const result = await scenario();
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        message: `Test scenario failed to execute: ${scenario.name}`,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Validate UI empty states
 */
export interface UIStateTest {
  component: string;
  scenario: string;
  expectedBehavior: string;
}

export const UI_EMPTY_STATE_TESTS: UIStateTest[] = [
  {
    component: "RulesPage",
    scenario: "No collections from Shopify",
    expectedBehavior:
      "Should show empty state with message about creating collections in Shopify admin",
  },
  {
    component: "RulesPage",
    scenario: "No collections selected for exclusion",
    expectedBehavior:
      "Should show 'No collections excluded yet' message with proper styling",
  },
  {
    component: "DiscountsPage",
    scenario: "No active rules created",
    expectedBehavior:
      "Should show EmptyState with 'Create Rules' action button",
  },
  {
    component: "DiscountsPage",
    scenario: "No discount codes found",
    expectedBehavior:
      "Should show EmptyState with guidance about creating discounts in Shopify",
  },
  {
    component: "Dashboard",
    scenario: "Fresh installation with no data",
    expectedBehavior: "Should show welcome message with clear next steps",
  },
];

/**
 * Validate error handling scenarios
 */
export const ERROR_HANDLING_TESTS = [
  {
    scenario: "GraphQL query fails",
    trigger: "Network error or invalid query",
    expectedBehavior: "Should show user-friendly error message, not crash",
  },
  {
    scenario: "Database connection fails",
    trigger: "DB unavailable during rule save",
    expectedBehavior: "Should show error message and allow retry",
  },
  {
    scenario: "Invalid Shopify session",
    trigger: "Expired or invalid session token",
    expectedBehavior: "Should redirect to re-authentication flow",
  },
  {
    scenario: "Malformed discount ID",
    trigger: "Pass invalid ID to apply rules",
    expectedBehavior: "Should validate and show specific error message",
  },
];
