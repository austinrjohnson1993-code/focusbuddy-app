import { createClient } from '@supabase/supabase-js'

// Uses service role key so this can update rows across all users (bypasses RLS)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function runRollover() {
  const supabaseAdmin = getAdminClient()

  // "Overdue" = scheduled_for is set, not null, and is before today's midnight UTC
  // This avoids touching tasks scheduled for today
  const todayMidnight = new Date()
  todayMidnight.setUTCHours(0, 0, 0, 0)

  const { data: overdueTasks, error } = await supabaseAdmin
    .from('tasks')
    .select('id, title, rollover_count')
    .eq('completed', false)
    .eq('archived', false)
    .lt('scheduled_for', todayMidnight.toISOString())
    .not('scheduled_for', 'is', null)

  if (error) throw new Error(error.message)
  if (!overdueTasks || overdueTasks.length === 0) return { rolled: 0, tasks: [] }

  // Tomorrow at 9:00 AM UTC
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setUTCHours(9, 0, 0, 0)
  const tomorrowISO = tomorrow.toISOString()

  await Promise.all(
    overdueTasks.map(task =>
      supabaseAdmin.from('tasks').update({
        rollover_count: (task.rollover_count || 0) + 1,
        scheduled_for: tomorrowISO
        // due_time intentionally not changed — preserve original deadline
      }).eq('id', task.id)
    )
  )

  return { rolled: overdueTasks.length, tasks: overdueTasks.map(t => t.title) }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const result = await runRollover()
    return res.status(200).json(result)
  } catch (err) {
    console.error('[rollover-tasks] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
