import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, plan } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  if (!['monthly', 'yearly'].includes(plan)) {
    return res.status(400).json({ error: 'plan must be "monthly" or "yearly"' });
  }

  const priceId = plan === 'monthly'
    ? process.env.STRIPE_PRICE_MONTHLY
    : process.env.STRIPE_PRICE_YEARLY;

  if (!priceId) {
    console.error(`[checkout-session] Missing STRIPE_PRICE_${plan.toUpperCase()} env var`);
    return res.status(500).json({ error: 'Stripe price not configured' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId.trim(), quantity: 1 }],
      metadata: { userId },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://cinis.app'}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://cinis.app'}/dashboard`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[checkout-session] Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
