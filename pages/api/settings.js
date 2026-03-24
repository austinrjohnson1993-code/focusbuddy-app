import { createClient } from '@supabase/supabase-js'
import withAuth from '../../lib/authGuard'

const ALLOWED_FIELDS = [
  'full_name', 'accent_color', 'persona_blend', 'persona_voice',
  'checkin_times', 'morning_time', 'midday_time', 'evening_time',
  'push_notifications_enabled', 'push_subscription', 'theme_id',
]

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  if (!['POST', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })

  console.log('[settings] received:', req.method, JSON.stringify(req.body))

  const source = req.body.updates && typeof req.body.updates === 'object' ? req.body.updates : req.body
  const updateObject = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in source) updateObject[key] = source[key]
  }

  if (Object.keys(updateObject).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const supabaseAdmin = getAdminClient()
  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updateObject)
    .eq('id', userId)

  if (error) {
    console.error('[settings] update failed:', JSON.stringify(error))
    return res.status(500).json({ error: 'Failed to update profile' })
  }

  console.log('[settings] updated profile for', userId, '— fields:', Object.keys(updateObject).join(', '))
  return res.status(200).json({ success: true, updated: updateObject })
}

export default withAuth(handler)
