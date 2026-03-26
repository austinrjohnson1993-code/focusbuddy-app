import { createClient } from '@supabase/supabase-js'
import { runProgressSnapshot } from '../progress-snapshot'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Called daily at midnight by Vercel cron (see vercel.json)
export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseAdmin = getAdminClient()

  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from('profiles')
    .select('id')

  if (profilesErr) {
    console.error('[cron/progress-snapshot] Failed to fetch profiles:', profilesErr.message)
    return res.status(500).json({ error: profilesErr.message })
  }

  if (!profiles || profiles.length === 0) {
    return res.status(200).json({ success: true, snapshots: 0 })
  }

  let succeeded = 0
  let failed = 0

  await Promise.allSettled(profiles.map(async (profile) => {
    try {
      await runProgressSnapshot(profile.id)
      succeeded++
    } catch (err) {
      failed++
      console.error(`[cron/progress-snapshot] Failed for ${profile.id}:`, err.message)
    }
  }))

  return res.status(200).json({ success: true, snapshots: succeeded, failed })
}
