import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'
import { sanitizeContent } from '../../../lib/sanitize'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { crew_id, emoji, text } = req.body
  if (!crew_id) return res.status(400).json({ error: 'crew_id required' })

  const supabaseAdmin = getAdminClient()

  // Verify the user is a member of this crew
  const { data: membership } = await supabaseAdmin
    .from('crew_members')
    .select('id')
    .eq('crew_id', crew_id)
    .eq('user_id', userId)
    .single()

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this crew' })
  }

  const cleanText = text ? sanitizeContent(text) : null
  const cleanEmoji = emoji ? String(emoji).slice(0, 10) : null

  const { error: nudgeErr } = await supabaseAdmin
    .from('crew_nudges')
    .insert({
      crew_id,
      user_id: userId,
      emoji: cleanEmoji,
      text: cleanText,
    })

  if (nudgeErr) {
    console.error('[crews/nudge] insert nudge error:', JSON.stringify(nudgeErr))
    return res.status(500).json({ error: 'Failed to send nudge' })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  const displayName = profile?.full_name || 'Someone'
  const emojiPart = cleanEmoji ? ` ${cleanEmoji}` : ''

  await supabaseAdmin.from('crew_activity').insert({
    crew_id,
    user_id: userId,
    text: `${displayName} nudged the crew${emojiPart}`,
  })

  return res.status(200).json({ success: true })
}

export default withAuth(handler)
