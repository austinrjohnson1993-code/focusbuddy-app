import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'
import { sanitizeTitle, sanitizeNotes } from '../../../lib/sanitize'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  const supabaseAdmin = getAdminClient()

  // ── GET — today's spend entries + total ────────────────────────────────────
  if (req.method === 'GET') {
    const timezone = req.query.timezone || 'America/Chicago'
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
    const todayStart = new Date(`${todayStr}T00:00:00`)
    const todayEnd = new Date(`${todayStr}T23:59:59`)

    const { data: entries, error } = await supabaseAdmin
      .from('spend_log')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[finance/spend:GET] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to fetch spend log' })
    }

    const today_total = (entries || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

    return res.status(200).json({ entries: entries || [], today_total })
  }

  // ── POST — log a spend entry ───────────────────────────────────────────────
  if (req.method === 'POST') {
    const { amount, category, description, impulse } = req.body

    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: 'amount required' })
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ error: 'amount must be a non-negative number' })
    }

    const { data: entry, error } = await supabaseAdmin
      .from('spend_log')
      .insert({
        user_id: userId,
        amount: parsedAmount,
        category: category ? sanitizeTitle(category) : null,
        description: description ? sanitizeNotes(description) : null,
        impulse: impulse === true || impulse === 'true',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[finance/spend:POST] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to log spend' })
    }

    console.log(`[finance/spend:POST] logged $${parsedAmount} for ${userId}`)
    return res.status(200).json({ entry })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
