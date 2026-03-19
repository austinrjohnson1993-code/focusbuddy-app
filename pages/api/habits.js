import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export default async function handler(req, res) {
  const supabaseAdmin = getAdminClient()

  // GET ?userId=xxx — fetch habits + today's completions + streaks
  if (req.method === 'GET') {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const [{ data: habits, error: habitsErr }, { data: completions, error: compErr }, { data: allCompletions, error: allErr }] = await Promise.all([
      supabaseAdmin.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabaseAdmin
        .from('habit_completions')
        .select('habit_id, id')
        .eq('user_id', userId)
        .gte('completed_at', todayStart.toISOString())
        .lte('completed_at', todayEnd.toISOString()),
      supabaseAdmin
        .from('habit_completions')
        .select('habit_id, completed_at')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false }),
    ])

    if (habitsErr) return res.status(500).json({ error: 'Failed to fetch habits' })
    if (compErr) return res.status(500).json({ error: 'Failed to fetch completions' })
    if (allErr) return res.status(500).json({ error: 'Failed to fetch all completions' })

    const completedTodayIds = new Set((completions || []).map(c => c.habit_id))

    // Calculate streaks for each habit
    const streakMap = {}
    ;(allCompletions || []).forEach(comp => {
      if (!streakMap[comp.habit_id]) {
        streakMap[comp.habit_id] = []
      }
      streakMap[comp.habit_id].push(new Date(comp.completed_at))
    })

    const calculateStreak = (habitId) => {
      const dates = streakMap[habitId] || []
      if (dates.length === 0) return 0

      const uniqueDays = new Set()
      dates.forEach(d => {
        const dayStr = new Date(d).toDateString()
        uniqueDays.add(dayStr)
      })

      const sortedDays = Array.from(uniqueDays)
        .map(d => new Date(d))
        .sort((a, b) => b - a)

      let streak = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      for (let i = 0; i < sortedDays.length; i++) {
        const expectedDay = new Date(today)
        expectedDay.setDate(today.getDate() - i)

        const dayDiff = Math.floor((sortedDays[i] - expectedDay) / (1000 * 60 * 60 * 24))
        if (dayDiff === 0) {
          streak++
        } else {
          break
        }
      }

      return streak
    }

    const habitsWithStatus = (habits || []).map(h => ({
      ...h,
      completedToday: completedTodayIds.has(h.id),
      streak: calculateStreak(h.id),
    }))

    return res.status(200).json({ habits: habitsWithStatus })
  }

  // POST { userId, name, frequency, color, description, habit_type } — create habit
  if (req.method === 'POST') {
    const { userId, name, frequency, color, description, habit_type } = req.body
    if (!userId || !name) return res.status(400).json({ error: 'userId and name required' })

    const { data, error } = await supabaseAdmin
      .from('habits')
      .insert({
        user_id: userId,
        name: name.trim(),
        frequency: frequency || 'daily',
        color: color || '#FF6644',
        description: description || null,
        habit_type: habit_type || 'build',
      })
      .select()
      .single()

    if (error) {
      console.error('[habits:POST] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to create habit' })
    }

    return res.status(200).json({ habit: { ...data, completedToday: false, streak: 0 } })
  }

  // PATCH { userId, habitId, action: 'toggle' } — toggle today's completion
  if (req.method === 'PATCH') {
    const { userId, habitId } = req.body
    if (!userId || !habitId) return res.status(400).json({ error: 'userId and habitId required' })

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const { data: existing } = await supabaseAdmin
      .from('habit_completions')
      .select('id')
      .eq('habit_id', habitId)
      .eq('user_id', userId)
      .gte('completed_at', todayStart.toISOString())
      .lte('completed_at', todayEnd.toISOString())
      .single()

    if (existing) {
      // Already completed today — remove it
      await supabaseAdmin.from('habit_completions').delete().eq('id', existing.id)
      return res.status(200).json({ completedToday: false })
    } else {
      // Mark complete
      await supabaseAdmin.from('habit_completions').insert({
        habit_id: habitId,
        user_id: userId,
        completed_at: new Date().toISOString(),
      })
      return res.status(200).json({ completedToday: true })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
