import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const supabaseAdmin = getAdminClient()

  const { data: tasks, error } = await supabaseAdmin
    .from('tasks')
    .select('id, title, completed, completed_at, created_at')
    .eq('user_id', userId)
    .eq('archived', false)

  if (error) return res.status(500).json({ error: 'Failed to fetch tasks' })

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const completedThisWeek = (tasks || []).filter(
    t => t.completed && t.completed_at && new Date(t.completed_at) > sevenDaysAgo
  )

  let streak = 0
  for (let i = 0; i < 30; i++) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    const ds = day.toDateString()
    if ((tasks || []).some(t => t.completed && t.completed_at && new Date(t.completed_at).toDateString() === ds)) {
      streak++
    } else if (i > 0) break
  }

  const dayCounts = {}
  ;(tasks || []).filter(t => t.completed && t.completed_at).forEach(t => {
    const day = new Date(t.completed_at).toLocaleDateString('en-US', { weekday: 'short' })
    dayCounts[day] = (dayCounts[day] || 0) + 1
  })
  const bestDay = Object.keys(dayCounts).length
    ? Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0][0]
    : 'N/A'

  return res.status(200).json({
    completedThisWeek,
    streak,
    bestDay,
    totalCompleted: (tasks || []).filter(t => t.completed).length,
  })
}
