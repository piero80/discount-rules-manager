import { authenticate } from "../shopify.server";
import prisma from "./db.server";
import { PLAN_CONFIGS, type PlanName } from "../config/plans";

/**
 * Get the correct app URL for billing callbacks
 * In development, use the request origin (cloudflare tunnel)
 * In production, use the configured URL
 */
function getAppUrl(request: Request): string {
  // First try the environment variable (production)
  if (process.env.SHOPIFY_APP_URL) {
    return process.env.SHOPIFY_APP_URL;
  }

  // In development, extract from request origin
  const url = new URL(request.url);
  const origin = url.origin;

  // If it's a cloudflare tunnel or localhost, use it
  if (origin.includes("trycloudflare.com") || origin.includes("localhost")) {
    return origin;
  }

  // Fallback to production URL
  return "https://discount-rules-manager-production.up.railway.app";
}

export interface BillingResult {
  success: boolean;
  confirmationUrl?: string;
  error?: string;
  chargeId?: string;
}

// GraphQL Response Types
interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
}

interface UserError {
  field: string[];
  message: string;
}

interface AppSubscription {
  id: string;
  name: string;
  status: string;
  createdAt?: string;
  currentPeriodEnd?: string;
  trialDays?: number;
  lineItems?: Array<{
    plan: {
      pricingDetails: {
        price: {
          amount: string;
          currencyCode: string;
        };
      };
    };
  }>;
}

interface AppSubscriptionCreateResponse {
  data?: {
    appSubscriptionCreate: {
      appSubscription?: AppSubscription;
      confirmationUrl?: string;
      userErrors: UserError[];
    };
  };
  errors?: GraphQLError[];
}

interface AppSubscriptionQueryResponse {
  data?: {
    node?: AppSubscription;
  };
  errors?: GraphQLError[];
}

interface AppSubscriptionCancelResponse {
  data?: {
    appSubscriptionCancel: {
      appSubscription?: {
        id: string;
        status: string;
      };
      userErrors: UserError[];
    };
  };
  errors?: GraphQLError[];
}

export class ShopifyBillingService {
  /**
   * Create a recurring application charge for a plan
   */
  static async createRecurringCharge(
    request: Request,
    planName: Exclude<PlanName, "free">,
  ): Promise<BillingResult> {
    try {
      console.log(`🔄 Starting billing process for plan: ${planName}`);

      const { admin, session } = await authenticate.admin(request);
      console.log(`✅ Authentication successful for shop: ${session.shop}`);

      const planConfig = PLAN_CONFIGS[planName];
      console.log(`📋 Plan config:`, planConfig);

      // Get the correct app URL - use request origin in development
      const appUrl = getAppUrl(request);

      console.log(`🔄 Creating recurring charge for plan: ${planName}`);
      console.log(`📍 Using app URL: ${appUrl}`);
      console.log(`🔧 Admin object type:`, typeof admin);

      const mutation = `
        mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $test: Boolean, $trialDays: Int, $price: Decimal!) {
          appSubscriptionCreate(
            name: $name
            returnUrl: $returnUrl
            test: $test
            trialDays: $trialDays
            lineItems: [{
              plan: {
                appRecurringPricingDetails: {
                  price: { amount: $price, currencyCode: USD }
                  interval: EVERY_30_DAYS
                }
              }
            }]
          ) {
            appSubscription {
              id
              name
              status
            }
            confirmationUrl
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        name: `${planConfig.name} Plan - ${planConfig.features.length} Features`,
        price: planConfig.price.toString(),
        returnUrl: `${appUrl}/app/billing/callback?plan=${planName}`,
        test: process.env.NODE_ENV !== "production",
        trialDays: 7,
      };

      console.log(`📦 Mutation variables:`, variables);

      const response = await admin.graphql(mutation, { variables });
      const data = (await response.json()) as AppSubscriptionCreateResponse;

      console.log(`📊 GraphQL response:`, data);

      if (data.errors) {
        console.error("❌ GraphQL errors:", data.errors);
        return {
          success: false,
          error: `GraphQL error: ${data.errors.map((e) => e.message).join(", ")}`,
        };
      }

      const appSubscriptionCreate = data.data?.appSubscriptionCreate;
      if (!appSubscriptionCreate) {
        return {
          success: false,
          error: "Invalid response from Shopify API",
        };
      }

      if (appSubscriptionCreate.userErrors?.length > 0) {
        console.error("❌ User errors:", appSubscriptionCreate.userErrors);
        return {
          success: false,
          error: `Subscription error: ${appSubscriptionCreate.userErrors.map((e) => e.message).join(", ")}`,
        };
      }

      console.log(
        `✅ App subscription created:`,
        appSubscriptionCreate.appSubscription?.id,
      );

      return {
        success: true,
        confirmationUrl: appSubscriptionCreate.confirmationUrl,
        chargeId: appSubscriptionCreate.appSubscription?.id,
      };
    } catch (error) {
      console.error("❌ Error creating recurring charge:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to create billing plan: ${errorMessage}`,
      };
    }
  }

  /**
   * Activate a recurring charge after user confirmation
   */
  static async activateCharge(
    request: Request,
    chargeId: string,
    planName: Exclude<PlanName, "free">,
  ): Promise<BillingResult> {
    try {
      const { admin, session } = await authenticate.admin(request);

      console.log(`🔄 Activating subscription: ${chargeId}`);

      // Get the subscription status first
      const statusQuery = `
        query GetAppSubscription($id: ID!) {
          node(id: $id) {
            ... on AppSubscription {
              id
              name
              status
              createdAt
              currentPeriodEnd
            }
          }
        }
      `;

      const statusResponse = await admin.graphql(statusQuery, {
        variables: { id: chargeId },
      });
      const statusData =
        (await statusResponse.json()) as AppSubscriptionQueryResponse;

      console.log(`📊 Subscription status:`, statusData);

      if (statusData.errors) {
        return {
          success: false,
          error: `Failed to get subscription status: ${statusData.errors.map((e) => e.message).join(", ")}`,
        };
      }

      const subscription = statusData.data?.node;
      if (!subscription) {
        return {
          success: false,
          error: "Subscription not found",
        };
      }

      console.log(`📋 Current subscription status: ${subscription.status}`);

      // App subscriptions are auto-activated when confirmed, no manual activation needed
      if (
        subscription.status === "ACTIVE" ||
        subscription.status === "PENDING"
      ) {
        // Update subscription in database
        const planConfig = PLAN_CONFIGS[planName];
        await prisma.subscription.upsert({
          where: { shop: session.shop },
          update: {
            planName: planName,
            status: "ACTIVE",
            maxRules: planConfig.maxRules,
            shopifyChargeId: chargeId,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 giorni
            updatedAt: new Date(),
          },
          create: {
            shop: session.shop,
            planName: planName,
            status: "ACTIVE",
            maxRules: planConfig.maxRules,
            shopifyChargeId: chargeId,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        console.log(`✅ Subscription activated and database updated`);

        return {
          success: true,
          chargeId: chargeId,
        };
      } else {
        return {
          success: false,
          error: `Subscription not ready for activation. Status: ${subscription.status}`,
        };
      }
    } catch (error) {
      console.error("❌ Error activating charge:", error);
      return {
        success: false,
        error: "Failed to activate billing plan",
      };
    }
  }

  /**
   * Cancel a recurring charge
   */
  static async cancelCharge(request: Request): Promise<BillingResult> {
    try {
      const { admin, session } = await authenticate.admin(request);

      // Get current subscription
      const subscription = await prisma.subscription.findUnique({
        where: { shop: session.shop },
      });

      if (!subscription?.shopifyChargeId) {
        return { success: true }; // Nothing to cancel
      }

      console.log(
        `🔄 Cancelling subscription: ${subscription.shopifyChargeId}`,
      );

      // Cancel the subscription in Shopify using GraphQL
      const cancelMutation = `
        mutation AppSubscriptionCancel($id: ID!) {
          appSubscriptionCancel(id: $id) {
            appSubscription {
              id
              status
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const cancelResponse = await admin.graphql(cancelMutation, {
        variables: { id: subscription.shopifyChargeId },
      });
      const cancelData =
        (await cancelResponse.json()) as AppSubscriptionCancelResponse;

      console.log(`📊 Cancel response:`, cancelData);

      if (cancelData.errors) {
        console.error("❌ GraphQL errors:", cancelData.errors);
        // Continue with database update even if Shopify cancellation fails
      }

      // Update subscription to free plan
      await prisma.subscription.update({
        where: { shop: session.shop },
        data: {
          planName: "free",
          status: "ACTIVE",
          maxRules: PLAN_CONFIGS.free.maxRules,
          shopifyChargeId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Subscription cancelled and user downgraded to free plan`);

      return { success: true };
    } catch (error) {
      console.error("❌ Error canceling charge:", error);
      return {
        success: false,
        error: "Failed to cancel billing plan",
      };
    }
  }

  /**
   * Check if user has an active paid plan
   */
  static async hasActivePlan(request: Request): Promise<boolean> {
    try {
      const { session } = await authenticate.admin(request);
      const subscription = await prisma.subscription.findUnique({
        where: { shop: session.shop },
      });

      if (!subscription?.shopifyChargeId) {
        return false;
      }

      const { admin } = await authenticate.admin(request);

      const query = `
        query GetAppSubscription($id: ID!) {
          node(id: $id) {
            ... on AppSubscription {
              id
              status
            }
          }
        }
      `;

      const response = await admin.graphql(query, {
        variables: { id: subscription.shopifyChargeId },
      });
      const data = (await response.json()) as AppSubscriptionQueryResponse;

      if (data.errors || !data.data?.node) {
        return false;
      }

      return data.data.node.status === "ACTIVE";
    } catch (error) {
      console.error("❌ Error checking active plan:", error);
      return false;
    }
  }

  /**
   * Get current billing information
   */
  static async getBillingInfo(request: Request) {
    try {
      const { session } = await authenticate.admin(request);
      const subscription = await prisma.subscription.findUnique({
        where: { shop: session.shop },
      });

      if (!subscription?.shopifyChargeId) {
        return null;
      }

      const { admin } = await authenticate.admin(request);

      const query = `
        query GetAppSubscription($id: ID!) {
          node(id: $id) {
            ... on AppSubscription {
              id
              name
              status
              createdAt
              currentPeriodEnd
              trialDays
              lineItems {
                plan {
                  pricingDetails {
                    ... on AppRecurringPricing {
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await admin.graphql(query, {
        variables: { id: subscription.shopifyChargeId },
      });
      const data = (await response.json()) as AppSubscriptionQueryResponse;

      if (data.errors || !data.data?.node) {
        return null;
      }

      const appSubscription = data.data.node;
      const price =
        appSubscription.lineItems?.[0]?.plan?.pricingDetails?.price?.amount ||
        "0";

      return {
        id: appSubscription.id,
        name: appSubscription.name,
        price: parseFloat(price),
        status: appSubscription.status.toLowerCase(),
        created_at: appSubscription.createdAt,
        updated_at: appSubscription.createdAt, // GraphQL doesn't have updatedAt
        trial_ends_on: appSubscription.trialDays
          ? new Date(
              Date.now() + appSubscription.trialDays * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null,
      };
    } catch (error) {
      console.error("❌ Error getting billing info:", error);
      return null;
    }
  }
}
