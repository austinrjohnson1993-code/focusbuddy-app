import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Returns 'YYYY-MM-DD' in local date from an ISO string
function toDateString(isoString) {
  const d = new Date(isoString)
  return d.toISOString().slice(0, 10)
}

function calcStreak(completedDates) {
  if (completedDates.length === 0) return 0

  // Build a Set of unique date strings with at least 1 completion
  const dateSet = new Set(completedDates)

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10)
    if (dateSet.has(dateStr)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

async function handler(req, res, userId) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseAdmin = getAdminClient()

  try {
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('completed', true)
      .not('completed_at', 'is', null)

    if (tasksError) {
      return res.status(500).json({ error: 'Failed to fetch tasks' })
    }

    const completedDates = (tasks || []).map(t => toDateString(t.completed_at))
    const currentStreak = calcStreak(completedDates)

    // Fetch current longest_streak to compare
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('longest_streak')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return res.status(500).json({ error: 'Failed to fetch profile' })
    }

    const longestStreak = Math.max(profile.longest_streak || 0, currentStreak)

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ current_streak: currentStreak, longest_streak: longestStreak })
      .eq('id', userId)

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update streak' })
    }

    return res.status(200).json({ currentStreak, longestStreak })
  } catch (err) {
    console.error('[tasks/streak] Error:', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)
