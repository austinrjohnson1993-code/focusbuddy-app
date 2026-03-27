import { createClient } from '@supabase/supabase-js'
import { stripe } from '../../lib/stripe'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k.trim(), v.join('=')]
    }).filter(([k]) => k)
  )
}

function extractTokenFromCookies(cookieHeader) {
  if (!cookieHeader) return null
  const cookies = parseCookies(cookieHeader)
  const sessionKey = Object.keys(cookies).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  if (!sessionKey) return null
  try {
    const decoded = decodeURIComponent(cookies[sessionKey])
    const parsed = JSON.parse(decoded)
    const session = Array.isArray(parsed) ? parsed[0] : parsed
    return session?.access_token ?? null
  } catch {
    return null
  }
}

const USER_TABLES = [
  'tasks',
  'bills',
  'journal_entries',
  'checkins',
  'alarms',
  'chores',
  'income',
  'progress_snapshots',
]

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  let token = req.headers.authorization?.replace('Bearer ', '').trim() || null
  if (!token) token = extractTokenFromCookies(req.headers.cookie)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseAdmin = getAdminClient()
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const userId = user.id

  // Fetch profile to check for active Stripe subscription
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id, subscription_status')
    .eq('id', userId)
    .single()

  // Cancel Stripe subscription if user is pro
  if (profile?.stripe_customer_id && profile?.subscription_status === 'pro') {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 10,
      })

      for (const sub of subscriptions.data) {
        await stripe.subscriptions.cancel(sub.id)
      }

      await stripe.customers.del(profile.stripe_customer_id)
    } catch (stripeErr) {
      console.error(`[delete-account] Stripe cancellation failed for user ${userId}:`, stripeErr.message)
      // Do not block deletion — proceed regardless
    }
  }

  // Delete user data from all tables
  for (const table of USER_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().eq('user_id', userId)
    if (error) {
      console.error(`[delete-account] Failed to delete from ${table} for user ${userId}:`, error.message)
    }
  }

  // Delete profile row
  await supabaseAdmin.from('profiles').delete().eq('id', userId)

  // Delete auth user
  const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (deleteAuthError) {
    console.error(`[delete-account] Failed to delete auth user ${userId}:`, deleteAuthError.message)
    return res.status(500).json({ error: 'Failed to delete account' })
  }

  return res.status(200).json({ success: true })
}
