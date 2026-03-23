import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function calculateXp(task) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Base XP — starred replaces base
  let xp = task.starred ? 20 : 10

  // Overdue bonus: scheduled_for before today
  if (task.scheduled_for) {
    const scheduledDate = new Date(task.scheduled_for)
    scheduledDate.setHours(0, 0, 0, 0)
    if (scheduledDate < today) {
      xp += 15
    }
  }

  // Early bird bonus: completed before due_time (time-of-day comparison)
  if (task.due_time && task.completed_at) {
    const completedAt = new Date(task.completed_at)
    const dueTime = new Date(task.due_time)
    if (completedAt < dueTime) {
      xp += 5
    }
  }

  return xp
}

async function handler(req, res, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { taskId } = req.body
  if (!taskId) return res.status(400).json({ error: 'taskId is required' })

  const supabaseAdmin = getAdminClient()

  try {
    // Fetch the task — verify it belongs to this user
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, starred, scheduled_for, due_time, completed_at, user_id')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single()

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const xpAwarded = calculateXp(task)

    // Fetch current total_xp
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('total_xp')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return res.status(500).json({ error: 'Failed to fetch profile' })
    }

    const newTotalXp = (profile.total_xp || 0) + xpAwarded

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ total_xp: newTotalXp })
      .eq('id', userId)

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update XP' })
    }

    return res.status(200).json({ xpAwarded, totalXp: newTotalXp })
  } catch (err) {
    console.error('[tasks/xp] Error:', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)
