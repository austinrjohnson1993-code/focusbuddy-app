import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function runProgressSnapshot(userId) {
  const supabaseAdmin = getAdminClient()

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()
  const snapshotDate = todayStart.toISOString().split('T')[0]

  // Tasks completed today
  const { count: tasksCompleted } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('completed_at', todayISO)

  // Tasks added today
  const { count: tasksAdded } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayISO)

  // Tasks rolled today (scheduled_for updated to today)
  const { count: tasksRolled } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', false)
    .gt('rollover_count', 0)
    .gte('updated_at', todayISO)

  // Focus minutes — graceful fallback if table doesn't exist yet
  let focusMinutes = 0
  try {
    const { data: sessions } = await supabaseAdmin
      .from('focus_sessions')
      .select('duration_minutes')
      .eq('user_id', userId)
      .gte('started_at', todayISO)
    focusMinutes = (sessions || []).reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
  } catch {
    // focus_sessions table not yet created — skip
  }

  // Journal entries today
  const { count: journalEntries } = await supabaseAdmin
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayISO)

  // Generate AI summary via Haiku
  const parts = []
  if (tasksCompleted) parts.push(`${tasksCompleted} task${tasksCompleted !== 1 ? 's' : ''} completed`)
  if (tasksRolled) parts.push(`${tasksRolled} rolled`)
  if (focusMinutes) parts.push(`${focusMinutes} minutes focused`)
  if (!parts.length) parts.push('no tasks completed')

  const prompt = `One sentence about today: ${parts.join(', ')}. Be specific and direct. No filler.`

  let aiSummary = ''
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
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    if (response.ok) {
      const data = await response.json()
      aiSummary = data?.content?.[0]?.text?.trim() ?? ''
    }
  } catch (err) {
    console.error('[progress-snapshot] AI summary failed:', err.message)
  }

  // Upsert into progress_snapshots (unique on user_id + snapshot_date)
  const { data: snapshot, error: upsertErr } = await supabaseAdmin
    .from('progress_snapshots')
    .upsert({
      user_id: userId,
      snapshot_date: snapshotDate,
      tasks_completed: tasksCompleted || 0,
      tasks_added: tasksAdded || 0,
      tasks_rolled: tasksRolled || 0,
      focus_minutes: focusMinutes,
      journal_entries: journalEntries || 0,
      ai_summary: aiSummary,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,snapshot_date' })
    .select()
    .single()

  if (upsertErr) throw new Error(upsertErr.message)

  return snapshot
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const snapshot = await runProgressSnapshot(userId)
    return res.status(200).json({ snapshot })
  } catch (err) {
    console.error('[progress-snapshot] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
