import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const CLEARABLE_TABLES = ['tasks', 'bills', 'journal_entries', 'progress_snapshots', 'alarms']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Authenticate via Bearer token
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No auth token provided' })

  const supabaseAdmin = getAdminClient()
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const userId = user.id

  for (const table of CLEARABLE_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().eq('user_id', userId)
    if (error) {
      console.error(`[reset-test-data] error clearing ${table}:`, JSON.stringify(error))
      return res.status(500).json({ error: `Failed to clear ${table}`, detail: error.message })
    }
  }

  return res.status(200).json({ success: true, cleared: CLEARABLE_TABLES })
}
