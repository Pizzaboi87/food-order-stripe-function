/// <reference types="stripe-event-types" />

import stripe from 'stripe';

class StripeService {
  constructor() {
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
    const amount = Math.round(Number(amountHuf || 0));

    if (!Number.isFinite(amount) || amount <= 0) {
      context.error(`Invalid amountHuf: ${amountHuf}`);
      return null;
    }

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
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        context.error('Missing stripe-signature header.');
        return null;
      }

      const event = this.client.webhooks.constructEvent(
        req.bodyBinary,
        signature,
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
