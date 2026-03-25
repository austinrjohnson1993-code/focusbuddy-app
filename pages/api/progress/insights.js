import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const FALLBACK_CARDS = [
  { type: 'pattern', title: 'Keep building your history', body: 'More data means sharper insights. Check back tomorrow.' },
  { type: 'alert', title: 'Check in with your coach', body: 'A quick check-in can reset the day.' },
  { type: 'win', title: 'You showed up', body: 'Opening the app is the hardest part. You did it.' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoStr(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

async function cacheInsights(supabaseAdmin, userId, cards) {
  const today = todayStr()
  const summary = JSON.stringify(cards)

  // Check if today's snapshot row exists
  const { data: existing } = await supabaseAdmin
    .from('progress_snapshots')
    .select('id')
    .eq('user_id', userId)
    .eq('snapshot_date', today)
    .single()

  if (existing) {
    await supabaseAdmin
      .from('progress_snapshots')
      .update({ ai_summary: summary })
      .eq('user_id', userId)
      .eq('snapshot_date', today)
  } else {
    await supabaseAdmin
      .from('progress_snapshots')
      .insert({ user_id: userId, snapshot_date: today, ai_summary: summary })
  }
}

async function handler(req, res, userId) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseAdmin = getAdminClient()

  try {
    // ── Fetch all data in parallel ────────────────────────────────────────────
    const [
      { data: snapshots },
      { data: recentTasks },
      { data: stuckTasks },
      { data: profile },
    ] = await Promise.all([
      supabaseAdmin
        .from('progress_snapshots')
        .select('snapshot_date, tasks_completed, focus_minutes, journal_entries')
        .eq('user_id', userId)
        .gte('snapshot_date', daysAgoStr(14))
        .order('snapshot_date', { ascending: true }),

      supabaseAdmin
        .from('tasks')
        .select('completed_at')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      supabaseAdmin
        .from('tasks')
        .select('id')
        .eq('user_id', userId)
        .gte('rollover_count', 3)
        .eq('completed', false)
        .eq('archived', false),

      supabaseAdmin
        .from('profiles')
        .select('current_streak, longest_streak, total_xp, subscription_status')
        .eq('id', userId)
        .single(),
    ])

    // ── Compute derived values ────────────────────────────────────────────────
    const snapshotList = snapshots || []
    const recent = recentTasks || []
    const today = todayStr()
    const sevenDaysAgo = daysAgoStr(7)

    const completionsPerDay = snapshotList.map(s => s.tasks_completed || 0)

    const last7Snapshots = snapshotList.filter(s => s.snapshot_date >= sevenDaysAgo)
    const totalFocusMinutes = last7Snapshots.reduce((sum, s) => sum + (s.focus_minutes || 0), 0)
    const totalJournalEntries = last7Snapshots.reduce((sum, s) => sum + (s.journal_entries || 0), 0)

    // Best completion day from real completed_at timestamps
    const dayGroups = {}
    for (const task of recent) {
      if (!task.completed_at) continue
      const dayName = new Date(task.completed_at).toLocaleDateString('en-US', { weekday: 'long' })
      dayGroups[dayName] = (dayGroups[dayName] || 0) + 1
    }
    const sortedDays = Object.entries(dayGroups).sort((a, b) => b[1] - a[1])
    const bestDayStr = sortedDays.length > 0
      ? `${sortedDays[0][0]} (${sortedDays[0][1]} tasks)`
      : 'N/A'

    const currentStreak = profile?.current_streak || 0
    const stuckCount = (stuckTasks || []).length
    const focusHours = (totalFocusMinutes / 60).toFixed(1)

    // ── Build prompt ─────────────────────────────────────────────────────────
    const systemPrompt = `You are a behavioral pattern analyst for a productivity coaching app. Users have ADHD and executive function challenges. Generate exactly 3 insight cards as JSON. Be specific, data-driven, and brief. Reference actual numbers from the data. Never use motivational poster language.`

    const userPrompt = `Analyze this user data and return 3 insight cards as a JSON array. Each card has: type ('pattern'|'alert'|'win'), title (max 8 words), body (max 20 words, reference specific numbers).

Data:
- Last 14 days tasks completed per day: [${completionsPerDay.join(', ') || '0'}]
- Focus minutes last 7 days: ${totalFocusMinutes} (${focusHours} hours)
- Journal entries last 7 days: ${totalJournalEntries}
- Current streak: ${currentStreak} days
- Tasks stuck (rolled 3+ times): ${stuckCount}
- Best completion day this week: ${bestDayStr}

Return ONLY a JSON array, no other text. Example format:
[
  {"type": "pattern", "title": "You work best before noon", "body": "73% of your completions happen in the morning."},
  {"type": "alert", "title": "Streak at risk", "body": "No tasks completed yet today. You're at 4 days."},
  {"type": "win", "title": "Best focus week in a month", "body": "You logged 2.5 hours of focus this week."}
]`

    // ── Call Haiku ────────────────────────────────────────────────────────────
    let cards = FALLBACK_CARDS

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const rawText = response.content.find(b => b.type === 'text')?.text?.trim() ?? ''

      // Strip markdown code fences if present
      const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(jsonText)

      if (Array.isArray(parsed) && parsed.length === 3) {
        cards = parsed
      } else {
        console.warn('[insights] AI returned unexpected shape, using fallback')
      }
    } catch (aiErr) {
      console.error('[insights] AI call or parse failed:', aiErr.message)
      // cards stays as FALLBACK_CARDS
    }

    // ── Cache to today's snapshot row ─────────────────────────────────────────
    try {
      await cacheInsights(supabaseAdmin, userId, cards)
    } catch (cacheErr) {
      console.error('[insights] cache write failed:', cacheErr.message)
      // non-fatal — still return cards
    }

    return res.status(200).json({ insights: cards })
  } catch (err) {
    console.error('[insights] fatal error:', err.message)
    return res.status(200).json({ insights: FALLBACK_CARDS })
  }
}

export default withAuth(handler)
