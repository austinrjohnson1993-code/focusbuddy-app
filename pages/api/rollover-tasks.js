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
  const todayDateStr = todayMidnight.toISOString().split('T')[0] // e.g. "2026-03-18"

  const { data: overdueTasks, error } = await supabaseAdmin
    .from('tasks')
    .select('id, title, rollover_count, user_id')
    .eq('completed', false)
    .eq('archived', false)
    .lt('scheduled_for', todayMidnight.toISOString())
    .not('scheduled_for', 'is', null)

  if (error) throw new Error(error.message)
  if (!overdueTasks || overdueTasks.length === 0) return { rolled: 0, skipped: 0, tasks: [] }

  // ── Per-user idempotency guard ─────────────────────────────────────────────
  // If rollover already ran today for a user, skip their tasks entirely.
  const userIds = [...new Set(overdueTasks.map(t => t.user_id).filter(Boolean))]

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, last_rollover_date')
    .in('id', userIds)

  const alreadyRolledToday = new Set(
    (profiles || [])
      .filter(p => p.last_rollover_date === todayDateStr)
      .map(p => p.id)
  )

  const tasksToRoll = overdueTasks.filter(t => !alreadyRolledToday.has(t.user_id))

  if (tasksToRoll.length === 0) {
    console.log(`[rollover-tasks] All ${userIds.length} user(s) already rolled today — skipping`)
    return { rolled: 0, skipped: overdueTasks.length, tasks: [] }
  }

  // Tomorrow at 9:00 AM UTC
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setUTCHours(9, 0, 0, 0)
  const tomorrowISO = tomorrow.toISOString()

  // ── Optimistic concurrency lock ────────────────────────────────────────────
  // Include .lt('scheduled_for', todayMidnight) in the UPDATE WHERE clause so
  // that if two concurrent runs both read the same task, the second UPDATE is
  // a no-op (task was already moved to tomorrow by the first run).
  await Promise.all(
    tasksToRoll.map(task =>
      supabaseAdmin
        .from('tasks')
        .update({
          rollover_count: (task.rollover_count || 0) + 1,
          scheduled_for: tomorrowISO
          // due_time intentionally not changed — preserve original deadline
        })
        .eq('id', task.id)
        .lt('scheduled_for', todayMidnight.toISOString()) // only update if still overdue
    )
  )

  // ── Mark rollover done today for each affected user ────────────────────────
  const rolledUserIds = [...new Set(tasksToRoll.map(t => t.user_id).filter(Boolean))]
  await Promise.all(
    rolledUserIds.map(uid =>
      supabaseAdmin
        .from('profiles')
        .update({ last_rollover_date: todayDateStr })
        .eq('id', uid)
    )
  )

  return { rolled: tasksToRoll.length, skipped: overdueTasks.length - tasksToRoll.length, tasks: tasksToRoll.map(t => t.title) }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const result = await runRollover()
    console.log(`[rollover-tasks] Rolled ${result.rolled}, skipped ${result.skipped}:`, result.tasks)
    return res.status(200).json(result)
  } catch (err) {
    console.error('[rollover-tasks] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
