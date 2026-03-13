import StripeService from './stripe.js';
import AppwriteService from './appwrite.js';
import { getStaticFile, interpolate, throwIfMissing } from './utils.js';

export default async (context) => {
  const { req, res, log, error } = context;

  throwIfMissing(process.env, [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ]);

  const databaseId = process.env.APPWRITE_DATABASE_ID ?? 'orders';
  const collectionId = process.env.APPWRITE_COLLECTION_ID ?? 'orders';

  if (req.method === 'GET') {
    const html = interpolate(getStaticFile('index.html'), {
      APPWRITE_FUNCTION_API_ENDPOINT: process.env.APPWRITE_FUNCTION_API_ENDPOINT,
      APPWRITE_FUNCTION_PROJECT_ID: process.env.APPWRITE_FUNCTION_PROJECT_ID,
      APPWRITE_FUNCTION_ID: process.env.APPWRITE_FUNCTION_ID,
      APPWRITE_DATABASE_ID: databaseId,
      APPWRITE_COLLECTION_ID: collectionId,
    });

    return res.text(html, 200, { 'Content-Type': 'text/html; charset=utf-8' });
  }

  const apiKeyFromHeader = context.req.headers['x-appwrite-key'];
  const apiKeyFromEnv = process.env.APPWRITE_FUNCTION_API_KEY;

  const appwrite = new AppwriteService(apiKeyFromHeader ?? apiKeyFromEnv);
  const stripe = new StripeService();

  switch (req.path) {
    case '/checkout': {
      const fallbackUrl = `${req.scheme}://${req.headers['host']}/`;

      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : (req.body ?? {});

      const successUrl = body.successUrl ?? fallbackUrl;
      const failureUrl = body.failureUrl ?? fallbackUrl;
      const amountHuf = body.amountHuf;

      const userId = req.headers['x-appwrite-user-id'];
      if (!userId) {
        error('User ID not found in request.');
        return res.redirect(failureUrl, 303);
      }

      const session = await stripe.checkoutPayment(
        context,
        userId,
        successUrl,
        failureUrl,
        amountHuf
      );

      if (!session) {
        error('Failed to create Stripe checkout session.');
        return res.redirect(failureUrl, 303);
      }

      log(`Created Stripe checkout session for user ${userId}.`);
      return res.redirect(session.url, 303);
    }

    case '/webhook': {
      const event = stripe.validateWebhook(context, req);
      if (!event) {
        return res.json({ success: false }, 401);
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata?.userId || session.client_reference_id;
        const orderId = session.id;

        if (!userId) {
          error('Missing userId in Stripe session metadata/client_reference_id.');
          return res.json({ success: false }, 400);
        }

        try {
          await appwrite.createOrder(databaseId, collectionId, userId, orderId);
          log(`Created order for user ${userId} with Stripe order ID ${orderId}`);
          return res.json({ success: true });
        } catch (err) {
          error(`Failed to write order: ${err?.message ?? err}`);
          return res.json({ success: false, error: 'Failed to write order.' }, 500);
        }
      }

      return res.json({ success: true });
    }

    default:
      return res.text('Not Found', 404);
  }
};
