import { createClient } from '@supabase/supabase-js'
import { stripe } from '../../../lib/stripe'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  console.log('[stripe] user:', user?.id, user?.email)

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { priceId } = req.body || {}
    const finalPriceId = priceId || process.env.STRIPE_PRO_PRICE_ID
    console.log('[stripe] priceId received:', priceId)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: finalPriceId, quantity: 1 }],
      success_url: 'https://cinis.app/dashboard?upgraded=true',
      cancel_url: 'https://cinis.app/dashboard',
      metadata: { userId: user.id },
      customer_email: user.email,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
