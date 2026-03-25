import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const NEW_USER_INSIGHT = "Welcome to Cinis. This is day one — your first win starts here. Add your first task and let's start building."

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

// Strip markdown headers/formatting and truncate to first sentence
function sanitizeInsight(text) {
  if (!text) return null
  // Remove lines starting with # (e.g. "# The Drill Sergeant")
  const lines = text.split('\n').filter(line => !line.trim().startsWith('#'))
  let cleaned = lines.join(' ').trim()
  // Strip bold, italic, inline code
  cleaned = cleaned
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  // Truncate to first sentence
  const firstSentence = cleaned.match(/^(.+?[.!?])\s+[A-Z]/)
  if (firstSentence) cleaned = firstSentence[1]
  return cleaned || null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // userId is read from query params — confirmed correct
  // TERMINAL 1 NOTE: all progress fetch calls must include userId:
  //   fetch(`/api/progress?type=daily&userId=${user.id}&timezone=${tz}`)
  //   fetch(`/api/progress?type=weekly&userId=${user.id}`)
  //   fetch(`/api/progress?type=monthly&userId=${user.id}`)
  const { userId, type = 'weekly', timezone = 'UTC' } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const supabaseAdmin = getAdminClient()

  // ── daily ─────────────────────────────────────────────────────────────────
  if (type === 'daily') {
    // Compute today's boundaries in the user's local timezone
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
    const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: timezone })
    const todayStart = new Date(`${todayStr}T00:00:00`)
    const todayEnd = new Date(`${tomorrowStr}T00:00:00`)

    const [{ data: tasks, error: tasksErr }, { data: profile }, { count: journalCount }] = await Promise.all([
      supabaseAdmin
        .from('tasks')
        .select('title, completed_at')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('completed_at', todayStart.toISOString())
        .lt('completed_at', todayEnd.toISOString()),
      supabaseAdmin.from('profiles').select('persona_blend').eq('id', userId).single(),
      // journal_entries filtered by user_id + created_at in user's timezone window
      supabaseAdmin
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', todayEnd.toISOString())
    ])

    if (tasksErr) return res.status(500).json({ error: 'Failed to fetch tasks' })

    const persona = profile?.persona_blend?.join(', ') || 'coach'
    const titles = tasks?.length ? tasks.map(t => `"${t.title}"`).join(', ') : 'none yet'

    const prompt = `Respond with a SINGLE sentence only. No headers, no bullet points, no markdown, no line breaks. One sentence maximum. Do not label by persona. In one persona-voiced sentence, give an encouraging observation about their day so far. Persona: ${persona}. Tasks done today: ${titles}. Be specific.`
    const raw = await callHaiku(prompt)
    const insight = sanitizeInsight(raw) ?? "You're making moves — keep going."

    return res.status(200).json({
      type: 'daily',
      insight,
      tasksCompleted: tasks?.length ?? 0,
      journalCount: journalCount ?? 0
    })
  }

  // ── monthly ───────────────────────────────────────────────────────────────
  if (type === 'monthly') {
    // Calendar month-to-date (1st of current month through today)
    const now = new Date()
    const currentMonth = now.toLocaleString('en-US', { month: 'long' }) // e.g. "March"
    const currentYear = now.getFullYear()
    const monthStart = new Date(currentYear, now.getMonth(), 1).toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]

    // Days remaining in the month (including today)
    const lastDayOfMonth = new Date(currentYear, now.getMonth() + 1, 0).getDate()
    const daysRemaining = lastDayOfMonth - now.getDate()

    const [{ data: snapshots, error: snapErr }, { data: profile }, { count: allTimeCount }] = await Promise.all([
      supabaseAdmin
        .from('progress_snapshots')
        .select('snapshot_date, tasks_completed, focus_minutes, journal_entries')
        .eq('user_id', userId)
        .gte('snapshot_date', monthStart)
        .lte('snapshot_date', todayStr),
      supabaseAdmin.from('profiles').select('persona_blend').eq('id', userId).single(),
      supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', true)
    ])

    if (snapErr) return res.status(500).json({ error: 'Failed to fetch snapshots' })

    if ((allTimeCount ?? 0) === 0) {
      return res.status(200).json({ type: 'monthly', insight: NEW_USER_INSIGHT, totalTasks: 0, totalFocusMinutes: 0, bestDay: null, daysRemaining })
    }

    const totalTasks = (snapshots || []).reduce((sum, s) => sum + (s.tasks_completed || 0), 0)
    const totalFocusMinutes = (snapshots || []).reduce((sum, s) => sum + (s.focus_minutes || 0), 0)
    const totalJournalEntries = (snapshots || []).reduce((sum, s) => sum + (s.journal_entries || 0), 0)
    const best = (snapshots || []).slice().sort((a, b) => b.tasks_completed - a.tasks_completed)[0]
    const bestDay = best && best.tasks_completed > 0 ? { date: best.snapshot_date, count: best.tasks_completed } : null

    const persona = profile?.persona_blend?.join(', ') || 'coach'
    const bestDayStr = bestDay
      ? `${bestDay.date} (${bestDay.count} tasks)`
      : 'no standout day yet'
    const focusStr = totalFocusMinutes > 0 ? `${totalFocusMinutes} focus minutes logged` : 'no focus sessions yet'

    // Monthly prompt is explicitly scoped to calendar month, distinct from weekly
    const prompt = `Respond with a SINGLE sentence only. No headers, no bullet points, no markdown, no line breaks. One sentence maximum. Do not label by persona. In one persona-voiced sentence, give a forward-looking monthly summary for ${currentMonth} ${currentYear}. This is a MONTHLY summary — do NOT say "this week". Persona: ${persona}. Tasks completed in ${currentMonth}: ${totalTasks}. Best day: ${bestDayStr}. Focus: ${focusStr}. Journal entries: ${totalJournalEntries}. Days remaining in ${currentMonth}: ${daysRemaining}. Reference the month name and days remaining. Be specific.`
    const raw = await callHaiku(prompt)
    const insight = sanitizeInsight(raw) ?? `${totalTasks} tasks done in ${currentMonth} — ${daysRemaining} days left to build on it.`

    return res.status(200).json({ type: 'monthly', insight, totalTasks, totalFocusMinutes, bestDay, daysRemaining })
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

  // T2-C: compute count from fresh query data before building prompt
  const completedThisWeekCount = completedThisWeek.length

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

  const totalCompleted = (tasks || []).filter(t => t.completed).length

  if (totalCompleted === 0) {
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

  // T2-C: pass explicit count into prompt so AI cannot contradict the visible wins list
  const weeklyPrompt = `Respond with a SINGLE sentence only. No headers, no bullet points, no markdown, no line breaks. One sentence maximum. Do not label by persona. In one persona-voiced sentence, give an encouraging weekly summary about the last 7 days. The user completed exactly ${completedThisWeekCount} task${completedThisWeekCount !== 1 ? 's' : ''} this week. Persona: ${persona}. Tasks completed: ${completedTitles}. Streak: ${streak} days. Do not say "zero completions" — the count is ${completedThisWeekCount}. Be specific.`
  const raw = await callHaiku(weeklyPrompt)
  const insight = sanitizeInsight(raw) ?? `You completed ${completedThisWeekCount} task${completedThisWeekCount !== 1 ? 's' : ''} this week.`

  return res.status(200).json({
    type: 'weekly',
    insight,
    completedThisWeek,
    streak,
    bestDay,
    totalCompleted,
  })
}
