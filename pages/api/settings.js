import { createClient } from '@supabase/supabase-js'

const ALLOWED_FIELDS = ['full_name', 'accent_color', 'persona_blend', 'persona_voice', 'checkin_times']

export default async function handler(req, res) {
  if (!['POST', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })

  console.log('[settings] PATCH received:', JSON.stringify(req.body))

  // Authenticate via the user's JWT from the Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No auth token provided' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error('[settings] Auth error:', JSON.stringify(authError))
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Build update object from only the fields present in req.body
  const updateObject = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in req.body) updateObject[key] = req.body[key]
  }

  if (Object.keys(updateObject).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  // Use service role client to bypass RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updateObject)
    .eq('id', user.id)

  if (error) {
    console.error('[settings] Update failed:', JSON.stringify(error))
    return res.status(500).json({ error: 'Failed to update profile' })
  }

  console.log('[settings] Updated profile for', user.id, '— fields:', Object.keys(updateObject).join(', '))
  return res.status(200).json({ success: true, updated: updateObject })
}
