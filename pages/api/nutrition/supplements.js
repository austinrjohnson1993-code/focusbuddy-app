import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'
import { sanitizeTitle, sanitizeNotes } from '../../../lib/sanitize'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const VALID_TIMINGS = ['morning', 'pre-workout', 'evening']
const TIMING_ORDER = { morning: 0, 'pre-workout': 1, evening: 2 }

async function handler(req, res, userId) {
  const supabaseAdmin = getAdminClient()

  // ── GET — all active supplements, ordered by timing ───────────────────────
  if (req.method === 'GET') {
    const { data: supplements, error } = await supabaseAdmin
      .from('supplement_stack')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)

    if (error) {
      console.error('[nutrition/supplements:GET] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to fetch supplements' })
    }

    const sorted = (supplements || []).sort((a, b) => {
      const aOrder = TIMING_ORDER[a.timing] ?? 99
      const bOrder = TIMING_ORDER[b.timing] ?? 99
      return aOrder - bOrder
    })

    return res.status(200).json({ supplements: sorted })
  }

  // ── POST — add new supplement ──────────────────────────────────────────────
  if (req.method === 'POST') {
    const { name, dose, timing, notes } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })

    const cleanName = sanitizeTitle(name)
    if (!cleanName) return res.status(400).json({ error: 'Invalid name' })

    if (timing && !VALID_TIMINGS.includes(timing)) {
      return res.status(400).json({ error: `timing must be one of: ${VALID_TIMINGS.join(', ')}` })
    }

    const { data: supplement, error } = await supabaseAdmin
      .from('supplement_stack')
      .insert({
        user_id: userId,
        name:    cleanName,
        dose:    dose    ? sanitizeTitle(dose)  : null,
        timing:  timing  || null,
        notes:   notes   ? sanitizeNotes(notes) : null,
        active:  true,
      })
      .select()
      .single()

    if (error) {
      console.error('[nutrition/supplements:POST] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to add supplement' })
    }

    console.log(`[nutrition/supplements:POST] added "${cleanName}" for ${userId}`)
    return res.status(200).json({ supplement })
  }

  // ── DELETE ?id=[supplement_id] — verify ownership ─────────────────────────
  if (req.method === 'DELETE') {
    const id = req.query.id || req.body?.id
    if (!id) return res.status(400).json({ error: 'id required' })

    // Fetch to verify ownership before delete
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('supplement_stack')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchErr || !existing) return res.status(404).json({ error: 'Supplement not found' })

    const { error } = await supabaseAdmin
      .from('supplement_stack')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('[nutrition/supplements:DELETE] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to delete supplement' })
    }

    console.log(`[nutrition/supplements:DELETE] deleted ${id} for ${userId}`)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
