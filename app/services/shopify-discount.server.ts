/**
 * Shopify Discount Integration Service
 * Gestisce la creazione e applicazione di discount tramite Shopify API
 */

// import { authenticate } from "../shopify.server";
// import { type EvaluationResult } from "./rule-evaluation.server";

interface ShopifyDiscountInput {
  title: string;
  code: string;
  discountType: "percentage" | "fixed_amount";
  value: number;
  usageLimit?: number;
  startsAt?: string;
  endsAt?: string;
}

interface ConditionalRuleDiscount {
  ruleId: string;
  ruleName: string;
  discountType: "percentage" | "fixed_amount";
  value: number;
  conditions: Array<Record<string, unknown>>;
  maxUsagePerCustomer?: number;
  maxTotalUsage?: number;
}

export class ShopifyDiscountService {
  /**
   * Crea un discount code automatico per una conditional rule
   */
  static async createAutomaticDiscount(
    admin: any,
    shop: string,
    rule: ConditionalRuleDiscount,
  ) {
    const discountInput = {
      automaticBasicDiscount: {
        title: `Auto ${rule.ruleName}`,
        startsAt: new Date().toISOString(),
        customerSelection: {
          all: false,
          customerSegments: {
            add: [], // Verrà popolato dinamicamente
          },
        },
        ...(rule.discountType === "percentage"
          ? {
              customerGets: {
                value: {
                  percentage: rule.value / 100,
                },
                items: {
                  all: true,
                },
              },
            }
          : {
              customerGets: {
                value: {
                  discountAmount: {
                    amount: rule.value.toString(),
                    currencyCode: "EUR",
                  },
                },
                items: {
                  all: true,
                },
              },
            }),
      },
    };

    const mutation = `
      mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
          automaticDiscountNode {
            id
            automaticDiscount {
              ... on DiscountAutomaticBasic {
                title
                status
                summary
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    try {
      const response = await admin.graphql(mutation, {
        variables: {
          automaticBasicDiscount: discountInput.automaticBasicDiscount,
        },
      });

      const result = await response.json();

      if (result.data?.discountAutomaticBasicCreate?.userErrors?.length > 0) {
        console.error(
          "Shopify discount creation errors:",
          result.data.discountAutomaticBasicCreate.userErrors,
        );
        throw new Error(
          `Failed to create discount: ${result.data.discountAutomaticBasicCreate.userErrors[0].message}`,
        );
      }

      return result.data?.discountAutomaticBasicCreate?.automaticDiscountNode;
    } catch (error) {
      console.error("Error creating Shopify discount:", error);
      throw error;
    }
  }

  /**
   * Crea un discount code per clienti specifici
   */
  static async createCodeDiscount(
    admin: Record<string, unknown>,
    shop: string,
    discountInput: ShopifyDiscountInput,
  ) {
    console.log(`🛍️ createCodeDiscount called with:`, {
      title: discountInput.title,
      code: discountInput.code,
      discountType: discountInput.discountType,
      value: discountInput.value,
    });

    const mutation = `
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
                status
                summary
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const basicCodeDiscount = {
      title: discountInput.title,
      code: discountInput.code,
      startsAt: discountInput.startsAt || new Date().toISOString(),
      endsAt: discountInput.endsAt,
      customerSelection: { all: true }, // Per ora permettiamo a tutti, restrizioni gestite via condizioni
      customerGets: {
        value:
          discountInput.discountType === "percentage"
            ? { percentage: discountInput.value / 100 }
            : {
                discountAmount: {
                  amount: discountInput.value.toString(),
                  currencyCode: "EUR",
                },
              },
        items: { all: true },
      },
      usageLimit: discountInput.usageLimit,
    };

    try {
      console.log(`🚀 Calling Shopify GraphQL mutation...`);
      console.log(`📊 Mutation variables:`, { basicCodeDiscount });

      const response = await admin.graphql(mutation, {
        variables: { basicCodeDiscount },
      });

      const result = await response.json();
      console.log(`📥 Shopify API response:`, result);

      if (result.data?.discountCodeBasicCreate?.userErrors?.length > 0) {
        console.error(
          "Shopify discount code creation errors:",
          result.data.discountCodeBasicCreate.userErrors,
        );
        throw new Error(
          `Failed to create discount code: ${result.data.discountCodeBasicCreate.userErrors[0].message}`,
        );
      }

      console.log(
        `✅ Discount created successfully:`,
        result.data?.discountCodeBasicCreate?.codeDiscountNode,
      );
      return result.data?.discountCodeBasicCreate?.codeDiscountNode;
    } catch (error) {
      console.error("Error creating Shopify discount code:", error);
      throw error;
    }
  }

  /**
   * Ottiene informazioni su un customer per la valutazione VIP
   */
  static async getCustomerInfo(
    admin: Record<string, unknown>,
    customerId: string,
  ) {
    const query = `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          tags
          numberOfOrders
          createdAt
          updatedAt
          defaultAddress {
            country
            province
            city
          }
          orders(first: 50) {
            nodes {
              id
              createdAt
              totalPrice
              lineItems(first: 5) {
                nodes {
                  title
                  quantity
                  variant {
                    product {
                      productType
                      vendor
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await admin.graphql(query, {
        variables: { id: customerId },
      });

      const result = await response.json();
      const customer = result.data?.customer;

      if (customer) {
        // Calcola totalSpent dai orders
        const totalSpent =
          customer.orders?.nodes?.reduce((sum: number, order: any) => {
            return sum + parseFloat(order.totalPrice || 0);
          }, 0) || 0;

        return {
          ...customer,
          totalSpent: totalSpent.toString(),
        };
      }

      return customer;
    } catch (error) {
      console.error("Error fetching customer info:", error);
      throw error;
    }
  }

  /**
   * Trova customers per email
   */
  static async findCustomerByEmail(
    admin: Record<string, unknown>,
    email: string,
  ) {
    const query = `
      query findCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          nodes {
            id
            email
            firstName
            lastName
            tags
            numberOfOrders
            createdAt
            defaultAddress {
              country
              province
              city
              zip
            }
            orders(first: 50) {
              nodes {
                totalPrice
              }
            }
          }
        }
      }
    `;

    try {
      const response = await admin.graphql(query, {
        variables: { query: `email:${email}` },
      });

      const result = await response.json();
      const customer = result.data?.customers?.nodes?.[0];

      if (customer) {
        // Calcola totalSpent dai orders
        const totalSpent =
          customer.orders?.nodes?.reduce((sum: number, order: any) => {
            return sum + parseFloat(order.totalPrice || 0);
          }, 0) || 0;

        return {
          ...customer,
          totalSpent: totalSpent.toString(),
        };
      }

      return customer;
    } catch (error) {
      console.error("Error finding customer by email:", error);
      throw error;
    }
  }

  /**
   * Applica un discount per una regola specifica
   */
  static async applyConditionalDiscount(
    admin: Record<string, unknown>,
    shop: string,
    customerId: string,
    rule: ConditionalRuleDiscount,
  ) {
    console.log(`🎯 applyConditionalDiscount called:`, {
      shop,
      customerId,
      ruleName: rule.ruleName,
      discountType: rule.discountType,
      value: rule.value,
    });

    // Genera un codice univoco per questa regola + customer
    const customerIdSuffix =
      customerId.length >= 4 ? customerId.slice(-4) : customerId;
    const discountCode =
      `VIP-${rule.ruleId.slice(0, 8)}-${customerIdSuffix}`.toUpperCase();

    console.log(`🔑 Generated discount code: ${discountCode}`);

    const discountInput: ShopifyDiscountInput = {
      title: `${rule.ruleName} - ${discountCode}`,
      code: discountCode,
      discountType: rule.discountType,
      value: rule.value,
      usageLimit: rule.maxUsagePerCustomer || 1,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 ore
    };

    console.log(`📋 Discount input prepared:`, discountInput);

    return await this.createCodeDiscount(admin, shop, discountInput);
  }
}
