import { createClient } from '@supabase/supabase-js'
import { coachingMessage } from '../../lib/anthropic'
import { buildPersonaPrompt } from '../../lib/persona'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function fmtTask(t) {
  let s = `"${t.title}"`
  if (t.due_time) {
    s += ` (due ${new Date(t.due_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})`
  }
  if ((t.rollover_count || 0) > 0) s += ` [rolled over ${t.rollover_count}×]`
  return s
}

function fmtList(tasks) {
  if (!tasks.length) return 'none'
  return tasks.map(fmtTask).join(', ')
}

// Pick the highest-priority pending task to name specifically
function topTask(pending) {
  if (!pending.length) return null
  // prefer external or has due_time, then rollover, then first
  return pending.find(t => t.consequence_level === 'external' || t.due_time)
    || pending.find(t => (t.rollover_count || 0) > 0)
    || pending[0]
}

function buildContextPrompt(checkInType, profile, pending, completed) {
  const name = profile.full_name?.split(' ')[0] || 'there'
  const top = topTask(pending)
  const topCompleted = completed[0] || null

  if (checkInType === 'morning') {
    const taskLine = top
      ? `Their most important task right now: ${fmtTask(top)}.`
      : `They have no tasks on their list yet today.`
    return `Morning check-in for ${name}. ${taskLine}

Write exactly 2-3 sentences. Sentence 1: greet ${name} by name, acknowledge the morning. Sentence 2: name that specific task and why it matters (due time if it has one, or that it's external). Sentence 3 (optional): one short question — "What's in the way?" or "Ready?" or similar. Do not summarize their whole list. Do not ask how they're feeling. Reference the task by name. End with a question OR a statement, not both.`
  }

  if (checkInType === 'midday') {
    const doneLine = topCompleted
      ? `They completed "${topCompleted.title}" ${completed.length > 1 ? `and ${completed.length - 1} other${completed.length - 1 !== 1 ? 's' : ''}` : ''}.`
      : `They haven't completed anything yet.`
    const nextLine = top
      ? `Most important thing still open: ${fmtTask(top)}.`
      : `Nothing pending.`
    return `Midday check-in for ${name}. ${doneLine} ${nextLine}

Write exactly 2-3 sentences. If something got done: sentence 1 acknowledges it by name specifically. If nothing got done: sentence 1 acknowledges that honestly, no shame. Sentence 2: name the most important open task specifically and what doing it in the afternoon looks like. No lists. No summaries. Reference tasks by name. End with a question OR a statement, not both.`
  }

  // evening
  const winLine = topCompleted
    ? `They completed "${topCompleted.title}" today${completed.length > 1 ? ` (plus ${completed.length - 1} more)` : ''}.`
    : `They didn't complete any tasks today.`
  const rollLine = pending.length > 0
    ? `Rolling to tomorrow: ${fmtTask(pending[0])}${pending.length > 1 ? ` and ${pending.length - 1} other${pending.length - 1 !== 1 ? 's' : ''}` : ''}.`
    : `Nothing rolls to tomorrow.`
  return `Evening check-in for ${name}. ${winLine} ${rollLine}

Write exactly 2-3 sentences. Sentence 1: name one specific win (or acknowledge the day honestly if nothing done — no toxic positivity). Sentence 2: name what rolls to tomorrow specifically. Sentence 3: one closing line that makes them feel good about showing up tomorrow — specific, not generic. No motivational poster language. End with a statement, not a question.`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, checkInType, messages } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const supabaseAdmin = getAdminClient()

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles').select('*').eq('id', userId).single()
  if (profileErr || !profile) return res.status(404).json({ error: 'Profile not found' })

  const systemPrompt = buildPersonaPrompt(profile)

  // Continuing conversation — just pass through with persona
  if (messages && messages.length > 0) {
    try {
      const reply = await coachingMessage(messages, systemPrompt)
      return res.status(200).json({ message: reply })
    } catch (err) {
      console.error('[checkin] continuation error:', err.message)
      return res.status(500).json({ error: 'Failed to get response' })
    }
  }

  // Opening message — fetch tasks and build context
  const { data: tasks = [] } = await supabaseAdmin
    .from('tasks').select('*').eq('user_id', userId).eq('archived', false)

  const pending = (tasks || []).filter(t => !t.completed)
  const completed = (tasks || []).filter(t => t.completed)
  const type = checkInType || 'morning'

  const contextPrompt = buildContextPrompt(type, profile, pending, completed)

  try {
    const reply = await coachingMessage(
      [{ role: 'user', content: contextPrompt }],
      systemPrompt
    )
    return res.status(200).json({ message: reply })
  } catch (err) {
    console.error('[checkin] opening error:', err.message)
    return res.status(500).json({ error: 'Failed to generate check-in' })
  }
}
