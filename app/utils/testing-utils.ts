/**
 * Network failure simulation for testing
 * Use this to test error handling scenarios
 */

export async function simulateNetworkFailure(
  // eslint-disable-next-line @typescript-eslint/ban-types
  originalFunction: Function,
  failureRate: number = 0.5,
  delayMs: number = 2000,
) {
  // Simulate random network failures
  if (Math.random() < failureRate) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    throw new Error("Simulated network failure");
  }

  return originalFunction();
}

export async function simulateSlowNetwork<T>(
  promise: Promise<T>,
  delayMs: number = 3000,
): Promise<T> {
  // Add artificial delay to simulate slow network
  const [result] = await Promise.all([
    promise,
    new Promise((resolve) => setTimeout(resolve, delayMs)),
  ]);

  return result;
}

export class TestingUtils {
  static isTestingMode(): boolean {
    return (
      process.env.NODE_ENV === "development" &&
      typeof window !== "undefined" &&
      window.location.search.includes("test=true")
    );
  }

  static async simulateRandomError(successRate: number = 0.8) {
    if (!this.isTestingMode()) return;

    if (Math.random() > successRate) {
      const errors = [
        "Network connection timeout",
        "GraphQL rate limit exceeded",
        "Invalid authentication token",
        "Shopify API temporarily unavailable",
        "Database connection failed",
      ];

      throw new Error(errors[Math.floor(Math.random() * errors.length)]);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static log(message: string, data?: any) {
    if (this.isTestingMode()) {
      console.log(`🧪 [TEST] ${message}`, data);
    }
  }
}

// Add this to URL: ?test=true to enable testing mode
export const enableTestingMode = () => {
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    url.searchParams.set("test", "true");
    window.history.replaceState({}, "", url);
  }
};
