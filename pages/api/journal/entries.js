import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, limit } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const safeLimit = Math.min(parseInt(limit) || 30, 100)

  const since = new Date()
  since.setDate(since.getDate() - 30)
  since.setHours(0, 0, 0, 0)

  const supabaseAdmin = getAdminClient()

  const { data: entries, error } = await supabaseAdmin
    .from('journal_entries')
    .select('id, created_at, mood, content')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) {
    console.error('[journal/entries:GET] error:', JSON.stringify(error))
    return res.status(500).json({ error: 'Failed to fetch journal entries' })
  }

  return res.status(200).json({ entries: entries || [] })
}
