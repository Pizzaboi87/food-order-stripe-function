/// <reference types="stripe-event-types" />

import stripe from "stripe";

class StripeService {
  constructor() {
    /** @type {import('stripe').Stripe} */
    // @ts-ignore
    this.client = stripe(process.env.STRIPE_SECRET_KEY);
  }

  async checkoutPayment(context, userId, successUrl, failureUrl, amountHuf, appwriteOrderId) {
    const amount = Math.round(Number(amountHuf || 0));

    if (!Number.isFinite(amount) || amount <= 0) {
      context.error(`Invalid amountHuf: ${amountHuf}`);
      return null;
    }

    const lineItem = {
      price_data: {
        unit_amount: amount * 100,
        currency: "huf",
        product_data: { name: "Rendeles" },
      },
      quantity: 1,
    };

    try {
      return await this.client.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [lineItem],
        success_url: successUrl,
        cancel_url: failureUrl,
        client_reference_id: userId,
        metadata: {
          userId,
          amountHuf: String(amount),
          appwriteOrderId: appwriteOrderId ?? "",
        },
        mode: "payment",
      });
    } catch (err) {
      context.error(err);
      return null;
    }
  }

  validateWebhook(context, req) {
    try {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        context.error("Missing stripe-signature header.");
        return null;
      }

      const event = this.client.webhooks.constructEvent(
        req.bodyBinary,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      return event;
    } catch (err) {
      context.error(err);
      return null;
    }
  }
}

export default StripeService;
