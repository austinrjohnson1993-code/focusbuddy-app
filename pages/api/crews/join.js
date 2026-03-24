import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { invite_code } = req.body
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' })

  const supabaseAdmin = getAdminClient()

  const { data: crew, error: crewErr } = await supabaseAdmin
    .from('crews')
    .select('*')
    .eq('invite_code', invite_code.trim().toUpperCase())
    .single()

  if (crewErr || !crew) {
    return res.status(404).json({ error: 'Crew not found' })
  }

  // Check if already a member
  const { data: existing } = await supabaseAdmin
    .from('crew_members')
    .select('id')
    .eq('crew_id', crew.id)
    .eq('user_id', userId)
    .single()

  if (existing) {
    return res.status(200).json({ crew, already_member: true })
  }

  const { error: memberErr } = await supabaseAdmin
    .from('crew_members')
    .insert({
      crew_id: crew.id,
      user_id: userId,
      role: 'member',
    })

  if (memberErr) {
    console.error('[crews/join] insert member error:', JSON.stringify(memberErr))
    return res.status(500).json({ error: 'Failed to join crew' })
  }

  // Look up the joining user's name for the activity entry
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  const displayName = profile?.full_name || 'Someone'

  await supabaseAdmin.from('crew_activity').insert({
    crew_id: crew.id,
    user_id: userId,
    text: `${displayName} joined the crew`,
  })

  return res.status(200).json({ crew })
}

export default withAuth(handler)
