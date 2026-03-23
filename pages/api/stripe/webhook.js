import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false, // Required — Stripe signature verification needs raw body
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      console.error('[stripe-webhook] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  console.log('[stripe-webhook] Received event:', event.type, event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!userId) {
          console.error('[stripe-webhook] checkout.session.completed missing metadata.userId');
          return res.status(400).json({ error: 'Missing userId in session metadata' });
        }

        // Store stripe_customer_id on the profile for future lookups
        const updateData = {
          subscription_status: 'pro',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        };

        // Fetch subscription to get current_period_end for expiry
        if (subscriptionId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            updateData.subscription_expires_at = new Date(
              subscription.current_period_end * 1000
            ).toISOString();
          } catch (subErr) {
            console.error('[stripe-webhook] Failed to retrieve subscription:', subErr.message);
          }
        }

        const { error } = await supabaseAdmin
          .from('profiles')
          .update(updateData)
          .eq('id', userId);

        if (error) {
          console.error('[stripe-webhook] Supabase update failed:', error);
          return res.status(500).json({ error: 'Database update failed' });
        }

        console.log(`[stripe-webhook] User ${userId} upgraded to pro`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const status = subscription.status;
        const customerId = subscription.customer;

        const mappedStatus = status === 'active' ? 'pro' : status === 'canceled' ? 'free' : status;

        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_status: mappedStatus,
            subscription_expires_at: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('[stripe-webhook] subscription.updated DB error:', error);
        } else {
          console.log(`[stripe-webhook] Customer ${customerId} status → ${mappedStatus}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ subscription_status: 'free' })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('[stripe-webhook] subscription.deleted DB error:', error);
        } else {
          console.log(`[stripe-webhook] Customer ${customerId} downgraded to free`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.error(`[stripe-webhook] Payment failed for customer ${invoice.customer}, invoice ${invoice.id}`);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('[stripe-webhook] Event processing error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  return res.status(200).json({ received: true });
}
