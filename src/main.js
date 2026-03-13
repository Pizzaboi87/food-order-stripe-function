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

  // Webhook hivasnal nincs x-appwrite-key header, ezert fallback env API key kell.
  const appwrite = new AppwriteService(
    context.req.headers['x-appwrite-key'] ?? process.env.APPWRITE_FUNCTION_API_KEY
  );
  const stripe = new StripeService();

  switch (req.path) {
    case '/checkout': {
      const fallbackUrl = req.scheme + '://' + req.headers['host'] + '/';

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

      context.log('Session:');
      context.log(session);

      log(`Created Stripe checkout session for user ${userId}.`);
      return res.redirect(session.url, 303);
    }

    case '/webhook': {
      const event = stripe.validateWebhook(context, req);
      if (!event) {
        return res.json({ success: false }, 401);
      }

      context.log('Event:');
      context.log(event);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const orderId = session.id;

        if (!userId) {
          error('Missing userId in Stripe session metadata.');
          return res.json({ success: false }, 400);
        }

        await appwrite.createOrder(databaseId, collectionId, userId, orderId);
        log(
          `Created order document for user ${userId} with Stripe order ID ${orderId}`
        );
        return res.json({ success: true });
      }

      return res.json({ success: true });
    }

    default:
      return res.text('Not Found', 404);
  }
};
