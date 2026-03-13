/// <reference types="stripe-event-types" />

import stripe from 'stripe';

class StripeService {
  constructor() {
    // Note: stripe cjs API types are faulty
    /** @type {import('stripe').Stripe} */
    // @ts-ignore
    this.client = stripe(process.env.STRIPE_SECRET_KEY);
  }

  /**
   * @param {any} context
   * @param {string} userId
   * @param {string} successUrl
   * @param {string} failureUrl
   * @param {number|string} amountHuf
   */
  async checkoutPayment(context, userId, successUrl, failureUrl, amountHuf) {
    const amount = Math.max(1, Math.round(Number(amountHuf || 0)));

    /** @type {import('stripe').Stripe.Checkout.SessionCreateParams.LineItem} */
    const lineItem = {
      price_data: {
        unit_amount: amount * 100,
        currency: 'huf',
        product_data: {
          name: 'Rendeles',
        },
      },
      quantity: 1,
    };

    try {
      return await this.client.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [lineItem],
        success_url: successUrl,
        cancel_url: failureUrl,
        client_reference_id: userId,
        metadata: {
          userId,
          amountHuf: String(amount),
        },
        mode: 'payment',
      });
    } catch (err) {
      context.error(err);
      return null;
    }
  }

  /**
   * @returns {import("stripe").Stripe.DiscriminatedEvent | null}
   */
  validateWebhook(context, req) {
    try {
      const event = this.client.webhooks.constructEvent(
        req.bodyBinary,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return /** @type {import("stripe").Stripe.DiscriminatedEvent} */ (event);
    } catch (err) {
      context.error(err);
      return null;
    }
  }
}

export default StripeService;
