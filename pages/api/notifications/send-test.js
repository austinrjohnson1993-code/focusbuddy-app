import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'
const { sendPushNotification } = require('../../../lib/push')

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('push_subscription, push_notifications_enabled, full_name')
    .eq('id', userId)
    .single()

  if (!profile?.push_notifications_enabled || !profile?.push_subscription) {
    return res.status(400).json({ error: 'Push notifications not enabled' })
  }

  const firstName = (profile.full_name || 'there').split(' ')[0]
  const result = await sendPushNotification(profile.push_subscription, {
    title: 'Cinis',
    body: `Notifications are working, ${firstName}. You'll hear from us.`,
    tag: 'cinis-test',
    url: '/dashboard'
  })

  if (!result.success) return res.status(500).json({ error: result.reason })
  return res.status(200).json({ success: true })
}

export default withAuth(handler)
