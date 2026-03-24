import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'
import { sanitizeTitle } from '../../../lib/sanitize'
import crypto from 'crypto'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, crew_type } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })

  const cleanName = sanitizeTitle(name)
  if (!cleanName) return res.status(400).json({ error: 'Invalid name' })

  const invite_code = crypto.randomBytes(5).toString('hex').toUpperCase()

  const supabaseAdmin = getAdminClient()

  const { data: crew, error: crewErr } = await supabaseAdmin
    .from('crews')
    .insert({
      name: cleanName,
      crew_type: crew_type || 'general',
      owner_id: userId,
      invite_code,
    })
    .select()
    .single()

  if (crewErr) {
    console.error('[crews/create] insert crew error:', JSON.stringify(crewErr))
    return res.status(500).json({ error: 'Failed to create crew' })
  }

  const { error: memberErr } = await supabaseAdmin
    .from('crew_members')
    .insert({
      crew_id: crew.id,
      user_id: userId,
      role: 'owner',
    })

  if (memberErr) {
    console.error('[crews/create] insert member error:', JSON.stringify(memberErr))
    // Crew was created — still return it even if member insert fails
  }

  return res.status(200).json({ crew })
}

export default withAuth(handler)
