import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildPersonaPrompt } from '../../lib/persona'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Rate limiting ─────────────────────────────────────────────────────────────
// In-memory — resets on cold start. Good enough for abuse prevention.
const rateLimitMap = new Map() // userId -> { count, resetAt }
const RATE_LIMIT = 50
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRateLimit(userId) {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  console.log('[checkin] admin client key prefix:', key?.slice(0, 20))
  console.log('[checkin:client] url present:', !!url, '| service key present:', !!key)
  return createClient(url, key)
}

// ── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'reschedule_task',
    description: 'Reschedule a task to a specific date and time. Use this when confirming a task moves to tomorrow or a specific time.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'The task ID to reschedule' },
        scheduled_for: { type: 'string', description: 'ISO datetime string for when to schedule' },
        due_time: { type: 'string', description: 'ISO datetime string for the due time, if specified' }
      },
      required: ['task_id', 'scheduled_for']
    }
  },
  {
    name: 'update_task_time',
    description: 'Update a task due time based on user input during check-in',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        due_time: { type: 'string', description: 'ISO datetime string' }
      },
      required: ['task_id', 'due_time']
    }
  },
  {
    name: 'schedule_morning_checkin',
    description: "Schedule the morning check-in notification. Call this when telling the user you'll check in at a specific time.",
    input_schema: {
      type: 'object',
      properties: {
        checkin_time: { type: 'string', description: 'ISO datetime string for the morning check-in' }
      },
      required: ['checkin_time']
    }
  },
  {
    name: 'complete_task',
    description: 'Mark a task as complete when the user confirms they finished it during check-in',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' }
      },
      required: ['task_id']
    }
  },
  {
    name: 'archive_task',
    description: "Archive/remove a task when the user says to remove it, delete it, or says they don't need it anymore",
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' }
      },
      required: ['task_id']
    }
  },
  {
    name: 'create_alarm',
    description: "Create an alarm or reminder. Use when you tell the user you'll check back in at a specific time, or when they mention wanting a reminder.",
    input_schema: {
      type: 'object',
      properties: {
        alarm_time: { type: 'string', description: 'ISO datetime string' },
        title: { type: 'string', description: 'Alarm label' },
        task_id: { type: 'string', description: 'Optional linked task UUID' }
      },
      required: ['alarm_time', 'title']
    }
  }
]

// ── Claude call ──────────────────────────────────────────────────────────────

async function callClaude(messages, systemPrompt, useTools = true) {
  const config = {
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages
  }
  if (useTools) config.tools = TOOLS
  const response = await anthropic.messages.create(config)
  const text = response.content.find(b => b.type === 'text')?.text ?? ''
  const toolUses = useTools ? response.content.filter(b => b.type === 'tool_use') : []
  return { text, toolUses }
}

// ── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(toolName, input, supabaseAdmin, userId) {
  console.log('[checkin:executeTool] called with:', JSON.stringify({ toolName, input }))

  if (toolName === 'reschedule_task') {
    const { task_id, scheduled_for, due_time } = input

    let task = null
    try {
      const { data, error: fetchErr } = await supabaseAdmin
        .from('tasks').select('rollover_count, title').eq('id', task_id).single()
      if (fetchErr) console.error('[checkin:tool] reschedule_task fetch error:', JSON.stringify(fetchErr), 'task_id:', task_id)
      else task = data
    } catch (e) {
      console.error('[checkin:tool] reschedule_task fetch threw:', e)
    }

    const updates = {
      scheduled_for,
      rollover_count: (task?.rollover_count || 0) + 1,
      ...(due_time ? { due_time } : {})
    }
    console.log(`[checkin:tool] reschedule_task updating "${task?.title}" (${task_id})`, updates)

    let updated = null
    let updateErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('tasks').update(updates).eq('id', task_id).select().single()
      updateErr = error
      updated = data
      console.log('[checkin:executeTool] result:', JSON.stringify({ error, data }))
    } catch (e) {
      console.error('[checkin:tool] reschedule_task update threw:', e)
      return { tool: 'reschedule_task', taskId: task_id, result: 'error', updatedTask: null }
    }

    if (updateErr) console.error('[checkin:tool] reschedule_task update error:', JSON.stringify(updateErr))
    else {
      console.log(`[checkin:tool] reschedule_task done — scheduled_for:`, updated?.scheduled_for)
      console.log(`[checkin:tool:success] reschedule_task executed for task ${task_id}`)
    }

    return { tool: 'reschedule_task', taskId: task_id, result: updateErr ? 'error' : 'rescheduled', updatedTask: updated || null }
  }

  if (toolName === 'update_task_time') {
    const { task_id, due_time } = input
    console.log(`[checkin:tool] update_task_time — task_id: ${task_id}, due_time: ${due_time}`)

    let updated = null
    let updateErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('tasks').update({ due_time }).eq('id', task_id).select().single()
      updateErr = error
      updated = data
      console.log('[checkin:executeTool] result:', JSON.stringify({ error, data }))
    } catch (e) {
      console.error('[checkin:tool] update_task_time threw:', e)
      return { tool: 'update_task_time', taskId: task_id, result: 'error', updatedTask: null }
    }

    if (updateErr) console.error('[checkin:tool] update_task_time error:', JSON.stringify(updateErr), 'task_id:', task_id)
    else {
      console.log(`[checkin:tool] update_task_time done — new due_time:`, updated?.due_time)
      console.log(`[checkin:tool:success] update_task_time executed for task ${task_id}`)
    }

    return { tool: 'update_task_time', taskId: task_id, result: updateErr ? 'error' : 'updated', updatedTask: updated || null }
  }

  if (toolName === 'schedule_morning_checkin') {
    const { checkin_time } = input
    console.log(`[checkin:tool] schedule_morning_checkin — checkin_time: ${checkin_time}`)
    // Only update the profile — do NOT create a task
    let profileErr = null
    try {
      const { error } = await supabaseAdmin
        .from('profiles').update({ next_checkin_at: checkin_time }).eq('id', userId)
      profileErr = error
      console.log('[checkin:executeTool] result:', JSON.stringify({ error }))
    } catch (e) {
      console.error('[checkin:tool] schedule_morning_checkin threw:', e)
      return { tool: 'schedule_morning_checkin', taskId: null, result: 'error' }
    }

    if (profileErr) console.error('[checkin:tool] schedule_morning_checkin profile error:', JSON.stringify(profileErr))
    else {
      console.log(`[checkin:tool] schedule_morning_checkin done — next_checkin_at set`)
      console.log(`[checkin:tool:success] schedule_morning_checkin executed for user ${userId}`)
    }

    return { tool: 'schedule_morning_checkin', taskId: null, result: profileErr ? 'error' : 'scheduled' }
  }

  if (toolName === 'complete_task') {
    const { task_id } = input
    const completedAt = new Date().toISOString()
    console.log(`[checkin:tool] complete_task — task_id: ${task_id}`)

    let updated = null
    let updateErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('tasks').update({ completed: true, completed_at: completedAt })
        .eq('id', task_id).select().single()
      updateErr = error
      updated = data
      console.log('[checkin:executeTool] result:', JSON.stringify({ error, data }))
    } catch (e) {
      console.error('[checkin:tool] complete_task threw:', e)
      return { tool: 'complete_task', taskId: task_id, result: 'error', updatedTask: null }
    }

    if (updateErr) console.error('[checkin:tool] complete_task error:', JSON.stringify(updateErr), 'task_id:', task_id)
    else {
      console.log(`[checkin:tool] complete_task done — "${updated?.title}"`)
      console.log(`[checkin:tool:success] complete_task executed for task ${task_id}`)
    }

    return { tool: 'complete_task', taskId: task_id, result: updateErr ? 'error' : 'completed', updatedTask: updated || null }
  }

  if (toolName === 'archive_task') {
    const { task_id } = input
    console.log(`[checkin:tool] archive_task — task_id: ${task_id}`)

    let updated = null
    let updateErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('tasks').update({ archived: true })
        .eq('id', task_id).select().single()
      updateErr = error
      updated = data
      console.log('[checkin:executeTool] result:', JSON.stringify({ error, data }))
    } catch (e) {
      console.error('[checkin:tool] archive_task threw:', e)
      return { tool: 'archive_task', taskId: task_id, result: 'error', updatedTask: null }
    }

    if (updateErr) console.error('[checkin:tool] archive_task error:', JSON.stringify(updateErr), 'task_id:', task_id)
    else {
      console.log(`[checkin:tool] archive_task done — "${updated?.title}"`)
      console.log(`[checkin:tool:success] archive_task executed for task ${task_id}`)
    }

    return { tool: 'archive_task', taskId: task_id, result: updateErr ? 'error' : 'archived', updatedTask: updated || null }
  }

  if (toolName === 'create_alarm') {
    const { alarm_time, title, task_id } = input
    console.log(`[checkin:tool] create_alarm — alarm_time: ${alarm_time}, title: "${title}"`)

    let inserted = null
    let insertErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('alarms')
        .insert({
          user_id: userId,
          alarm_time,
          title,
          task_id: task_id || null,
          active: true,
          triggered: false,
        })
        .select()
        .single()
      insertErr = error
      inserted = data
      console.log('[checkin:executeTool] result:', JSON.stringify({ error, data }))
    } catch (e) {
      console.error('[checkin:tool] create_alarm threw:', e)
      return { tool: 'create_alarm', result: 'error', alarm: null }
    }

    if (insertErr) console.error('[checkin:tool] create_alarm error:', JSON.stringify(insertErr))
    else {
      console.log(`[checkin:tool] create_alarm done — id: ${inserted?.id}`)
      console.log(`[checkin:tool:success] create_alarm executed for user ${userId}`)
    }

    return { tool: 'create_alarm', result: insertErr ? 'error' : 'created', alarm: inserted || null }
  }

  console.warn('[checkin:tool] unknown tool:', toolName)
  return null
}

// ── Context prompt builders ───────────────────────────────────────────────────

function formatLocalTime(isoString, tz) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz || 'America/Chicago'
  })
}

function topTask(pending) {
  if (!pending.length) return null
  return pending.find(t => t.consequence_level === 'external' || t.due_time)
    || pending.find(t => (t.rollover_count || 0) > 0)
    || pending[0]
}

function fmtTaskLine(t, tz) {
  const due = t.due_time ? formatLocalTime(t.due_time, tz) : 'none'
  return `- "${t.title}" | id:${t.id} | due:${due} | external:${t.consequence_level === 'external'} | rolled:${t.rollover_count || 0}x`
}

function buildContextPrompt(checkInType, profile, pending, completed, isFirstCheckin, extra) {
  const rawName = profile.full_name || ''
  const name = rawName.includes('@') ? 'there' : (rawName.split(' ')[0] || 'there')
  const { focusTask, focusDuration, timezone } = extra || {}
  const tz = timezone || 'America/Chicago'

  if (checkInType === 'focus') {
    return `Focus mode. User: ${name}.
They spent ${focusDuration || 25} minutes on "${focusTask || 'their task'}" and got stuck.
Write 2 sentences. Ask one specific question to help them identify what's in the way. Be direct, no fluff.`
  }

  if (checkInType === 'weekly_summary') {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const weekCompleted = completed.filter(t => t.completed_at && new Date(t.completed_at) > sevenDaysAgo)
    const weekWins = weekCompleted.length ? weekCompleted.map(t => `"${t.title}"`).join(', ') : 'nothing completed'
    const pendingLines = pending.length ? pending.map(t => fmtTaskLine(t, tz)).join('\n') : '- none'
    return `Weekly review. User: ${name}.
Completed this week: ${weekWins}.
Still pending: ${pendingLines}.
Write 3 sentences. Name one specific win, one pattern you noticed, one thing to focus on next week. Use real task names. Be specific and direct.`
  }

  const top = topTask(pending)
  const firstFlag = isFirstCheckin
    ? '\nThis is their very first check-in. Use the "Alright, first time working together." opener.'
    : ''
  const pendingLines = pending.length ? pending.map(t => fmtTaskLine(t, tz)).join('\n') : '- none'
  const completedTitles = completed.length
    ? completed.map(t => `"${t.title}"`).join(', ')
    : 'nothing'

  if (checkInType === 'morning') {
    return `It's morning. User: ${name}.
Top priority: ${top ? `"${top.title}" | id:${top.id}${top.due_time ? ` | due ${formatLocalTime(top.due_time, tz)}` : ''}${top.consequence_level === 'external' ? ' | external' : ''}` : 'none'}.
All pending tasks:
${pendingLines}${firstFlag}
Write the opening morning check-in. 2-3 sentences max. Name the top task specifically. If you commit to checking in at a specific time, call schedule_morning_checkin.`
  }

  if (checkInType === 'midday') {
    return `It's midday. User: ${name}.
Completed so far: ${completedTitles}.
Pending tasks:
${pendingLines}${firstFlag}
Write the midday check-in. 2 sentences. Acknowledge what's done by name, name what's next. If the user confirmed completing something, call complete_task. If they want to move something, call reschedule_task or update_task_time.`
  }

  // evening — pending tasks are being auto-rescheduled before this message; tell the user
  return `It's evening. User: ${name}.
Completed today: ${completedTitles}.
These tasks are being moved to tomorrow morning (already done — just tell them):
${pendingLines}${firstFlag}
Write the evening check-in. 2-3 sentences. One specific win or honest acknowledgment, confirm what moves to tomorrow by name, one closing line.`
}

// ── Handler ──────────────────────────────────────────────────────────────────

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, checkInType, messages, timezone } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  if (checkRateLimit(userId)) {
    console.warn(`[checkin] rate limit hit for ${userId}`)
    return res.status(429).json({ error: 'Rate limit exceeded', message: "You've been busy! Give it a moment." })
  }

  const supabaseAdmin = getAdminClient()

  // One-time cleanup: remove any stale "Morning check-in" tasks created by old tool code
  supabaseAdmin.from('tasks')
    .delete()
    .eq('user_id', userId)
    .eq('title', 'Morning check-in with FocusBuddy')

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles').select('*').eq('id', userId).single()
  if (profileErr || !profile) {
    console.error('[checkin] profile fetch error:', JSON.stringify(profileErr))
    return res.status(404).json({ error: 'Profile not found' })
  }

  const systemPrompt = buildPersonaPrompt(profile)

  // ── Continuing conversation ────────────────────────────────────────────────
  if (messages && messages.length > 0) {
    try {
      const { text, toolUses } = await callClaude(messages, systemPrompt)
      if (toolUses.length > 0) console.log('[checkin] continuation tools:', toolUses.map(t => `${t.name}(${JSON.stringify(t.input)})`).join(', '))
      const actions = await Promise.all(
        toolUses.map(tu => executeTool(tu.name, tu.input, supabaseAdmin, userId))
      )
      return res.status(200).json({
        message: text,
        actionsExecuted: actions.filter(Boolean)
      })
    } catch (err) {
      console.error('[checkin] continuation error:', err.message)
      return res.status(500).json({ error: 'Failed to get response' })
    }
  }

  // ── Opening message ────────────────────────────────────────────────────────
  const { data: tasks = [] } = await supabaseAdmin
    .from('tasks').select('*').eq('user_id', userId).eq('archived', false)

  const pending = (tasks || []).filter(t => !t.completed)
  const completed = (tasks || []).filter(t => t.completed)
  const type = checkInType || 'morning'
  const isFirstCheckin = !profile.last_checkin_at
  const actionsExecuted = []

  // Evening: auto-reschedule all pending tasks to tomorrow 9am UTC
  if (type === 'evening' && pending.length > 0) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setUTCHours(9, 0, 0, 0)
    const tomorrowISO = tomorrow.toISOString()

    await Promise.all(pending.map(async task => {
      try {
        const { data: fresh } = await supabaseAdmin
          .from('tasks').select('rollover_count').eq('id', task.id).single()
        const { error: rollErr } = await supabaseAdmin.from('tasks').update({
          scheduled_for: tomorrowISO,
          rollover_count: (fresh?.rollover_count || 0) + 1
        }).eq('id', task.id)
        if (rollErr) console.error('[checkin] evening rollover error:', JSON.stringify(rollErr), 'task_id:', task.id)
        else console.log(`[checkin:tool:success] evening rollover executed for task ${task.id}`)
      } catch (e) {
        console.error('[checkin] evening rollover threw:', e)
      }
      actionsExecuted.push({ tool: 'reschedule_task', taskId: task.id, result: 'rescheduled to tomorrow' })
    }))
  }

  if (isFirstCheckin) {
    // Awaited — must persist before response so "first time" opener never repeats
    await supabaseAdmin.from('profiles')
      .update({ last_checkin_at: new Date().toISOString() })
      .eq('id', profile.id)
  }

  const extra = { focusTask: req.body.focusTask, focusDuration: req.body.focusDuration, timezone }
  const contextPrompt = buildContextPrompt(type, profile, pending, completed, isFirstCheckin, extra)
  console.log('[checkin] context prompt:\n', contextPrompt)

  const noTools = type === 'focus' || type === 'weekly_summary'

  try {
    const { text, toolUses } = await callClaude(
      [{ role: 'user', content: contextPrompt }],
      systemPrompt,
      !noTools
    )
    if (toolUses.length > 0) console.log('[checkin] tools called by AI:', toolUses.map(t => `${t.name}(${JSON.stringify(t.input)})`).join(', '))
    const toolActions = await Promise.all(
      toolUses.map(tu => executeTool(tu.name, tu.input, supabaseAdmin, userId))
    )
    console.log(`[checkin] ${type} for ${userId}: ${toolActions.length + actionsExecuted.length} actions executed`)
    return res.status(200).json({
      message: text,
      actionsExecuted: [...actionsExecuted, ...toolActions.filter(Boolean)]
    })
  } catch (err) {
    console.error('[checkin] opening error:', err.message)
    return res.status(500).json({ error: 'Failed to generate check-in' })
  }
}
