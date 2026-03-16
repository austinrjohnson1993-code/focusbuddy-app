import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Stub — full implementation coming in Stripe session
  return res.status(200).json({
    message: 'Stripe checkout stub — not yet implemented'
  });
}
