import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  const supabaseAdmin = getAdminClient()

  // ── GET — last 7 body_metrics entries, newest first ───────────────────────
  if (req.method === 'GET') {
    const { data: entries, error } = await supabaseAdmin
      .from('body_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(7)

    if (error) {
      console.error('[nutrition/body:GET] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to fetch body metrics' })
    }

    return res.status(200).json({ entries: entries || [] })
  }

  // ── POST — log body metrics ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { weight_lbs, body_fat_pct, logged_at } = req.body

    if (weight_lbs === undefined && body_fat_pct === undefined) {
      return res.status(400).json({ error: 'weight_lbs or body_fat_pct required' })
    }

    const parsedWeight  = weight_lbs   !== undefined ? parseFloat(weight_lbs)   : null
    const parsedBodyFat = body_fat_pct !== undefined ? parseFloat(body_fat_pct) : null

    if (parsedWeight  !== null && (isNaN(parsedWeight)  || parsedWeight  <= 0)) {
      return res.status(400).json({ error: 'weight_lbs must be a positive number' })
    }
    if (parsedBodyFat !== null && (isNaN(parsedBodyFat) || parsedBodyFat < 0 || parsedBodyFat > 100)) {
      return res.status(400).json({ error: 'body_fat_pct must be between 0 and 100' })
    }

    const { data: entry, error } = await supabaseAdmin
      .from('body_metrics')
      .insert({
        user_id:      userId,
        weight_lbs:   parsedWeight,
        body_fat_pct: parsedBodyFat,
        logged_at:    logged_at || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[nutrition/body:POST] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to log body metrics' })
    }

    return res.status(200).json({ entry })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
