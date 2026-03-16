import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const NEW_USER_INSIGHT = "Welcome to FocusBuddy. This is day one — your first win starts here. Add your first task and let's start building."

async function callHaiku(prompt) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    return data?.content?.[0]?.text?.trim() ?? null
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, type = 'weekly' } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const supabaseAdmin = getAdminClient()

  // ── daily ─────────────────────────────────────────────────────────────────
  if (type === 'daily') {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const [{ data: tasks, error: tasksErr }, { data: profile }, { count: journalCount }] = await Promise.all([
      supabaseAdmin
        .from('tasks')
        .select('title, completed_at')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('completed_at', todayStart.toISOString()),
      supabaseAdmin.from('profiles').select('persona_blend').eq('id', userId).single(),
      supabaseAdmin
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())
    ])

    if (tasksErr) return res.status(500).json({ error: 'Failed to fetch tasks' })

    const persona = profile?.persona_blend?.join(', ') || 'coach'
    const titles = tasks?.length ? tasks.map(t => `"${t.title}"`).join(', ') : 'none yet'

    const prompt = `In one sentence, persona-voiced, give an encouraging observation about their day so far. Persona: ${persona}. Tasks done today: ${titles}. Be specific.`
    const insight = (await callHaiku(prompt)) ?? "You're making moves — keep going."

    return res.status(200).json({ type: 'daily', insight, tasksCompleted: tasks?.length ?? 0, journalCount: journalCount ?? 0 })
  }

  // ── monthly ───────────────────────────────────────────────────────────────
  if (type === 'monthly') {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0]
    const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

    const [{ data: snapshots, error: snapErr }, { data: profile }, { count: allTimeCount }] = await Promise.all([
      supabaseAdmin
        .from('progress_snapshots')
        .select('snapshot_date, tasks_completed')
        .eq('user_id', userId)
        .gte('snapshot_date', monthStart),
      supabaseAdmin.from('profiles').select('persona_blend').eq('id', userId).single(),
      supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', true)
    ])

    if (snapErr) return res.status(500).json({ error: 'Failed to fetch snapshots' })

    if ((allTimeCount ?? 0) === 0) {
      return res.status(200).json({ type: 'monthly', insight: NEW_USER_INSIGHT, totalTasks: 0, bestDay: null })
    }

    const totalTasks = (snapshots || []).reduce((sum, s) => sum + (s.tasks_completed || 0), 0)
    const best = (snapshots || []).slice().sort((a, b) => b.tasks_completed - a.tasks_completed)[0]
    const bestDay = best ? { date: best.snapshot_date, count: best.tasks_completed } : null

    const persona = profile?.persona_blend?.join(', ') || 'coach'
    const prompt = `Give a 2-sentence monthly summary for ${monthName}. Total tasks completed this month: ${totalTasks}. Best day: ${bestDay?.date ?? 'none'} with ${bestDay?.count ?? 0} tasks. Persona: ${persona}. Do NOT reference 'this week' — this is a monthly summary.`
    const insight = (await callHaiku(prompt)) ?? `You completed ${totalTasks} tasks this month.`

    return res.status(200).json({ type: 'monthly', insight, totalTasks, bestDay })
  }

  // ── weekly (default) ──────────────────────────────────────────────────────
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

  if ((tasks || []).filter(t => t.completed).length === 0) {
    return res.status(200).json({
      type: 'weekly',
      insight: NEW_USER_INSIGHT,
      completedThisWeek: [],
      streak: 0,
      bestDay: 'N/A',
      totalCompleted: 0,
    })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('persona_blend').eq('id', userId).single()
  const persona = profile?.persona_blend?.join(', ') || 'coach'
  const completedTitles = completedThisWeek.length
    ? completedThisWeek.map(t => `"${t.title}"`).join(', ')
    : 'none this week'
  const weeklyPrompt = `In one sentence, persona-voiced, give an encouraging weekly summary. Persona: ${persona}. Completed this week: ${completedTitles}. Streak: ${streak} days. Be specific.`
  const insight = (await callHaiku(weeklyPrompt)) ?? `You completed ${completedThisWeek.length} tasks this week.`

  return res.status(200).json({
    type: 'weekly',
    insight,
    completedThisWeek,
    streak,
    bestDay,
    totalCompleted: (tasks || []).filter(t => t.completed).length,
  })
}
