// TODO: Replace with real Stripe checkout session creation
// import Stripe from 'stripe'
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, plan } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })
  if (!['monthly', 'yearly'].includes(plan)) {
    return res.status(400).json({ error: 'plan must be "monthly" or "yearly"' })
  }

  // TODO: Replace with real Stripe checkout session creation
  // const session = await stripe.checkout.sessions.create({ ... })
  // return res.status(200).json({ url: session.url })

  console.log(`[stripe-checkout] Stub called — userId: ${userId}, plan: ${plan}`)
  return res.status(200).json({ url: 'https://buy.stripe.com/placeholder' })
}
