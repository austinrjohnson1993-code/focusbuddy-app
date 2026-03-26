// Stripe webhook handler
// Receives events from Stripe and logs them.
//
// TODO: wire up subscription status updates to profiles table
//   When event.type === 'customer.subscription.updated' or 'customer.subscription.deleted':
//     - Look up user by stripe_customer_id in profiles
//     - Update subscription_status ('pro' | 'cancelled' | 'free')
//     - Update subscription_expires_at (current_period_end from subscription object)
//
// Required Stripe env vars (add to Vercel):
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET  (from `stripe listen` or Stripe Dashboard → Webhooks)
//
// Supabase columns needed (add via SQL editor — migration already handled):
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'free';
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

export const config = {
  api: {
    bodyParser: false, // Stripe requires raw body for signature verification
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Collect raw body for future signature verification
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const rawBody = Buffer.concat(chunks).toString('utf8')

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }


  // TODO: verify Stripe signature before trusting event
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  // event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)

  // TODO: handle subscription lifecycle events
  // switch (event.type) {
  //   case 'customer.subscription.created':
  //   case 'customer.subscription.updated':
  //     // set subscription_status = 'pro', subscription_expires_at = event.data.object.current_period_end
  //     break
  //   case 'customer.subscription.deleted':
  //     // set subscription_status = 'cancelled'
  //     break
  //   case 'invoice.payment_failed':
  //     // notify user, optionally downgrade
  //     break
  // }

  return res.status(200).json({ received: true })
}
