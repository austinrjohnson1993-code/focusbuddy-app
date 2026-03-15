import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildPersonaPrompt } from '../../lib/persona'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
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
  }
]

// ── Claude call ──────────────────────────────────────────────────────────────

async function callClaude(messages, systemPrompt) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    tools: TOOLS,
    messages
  })
  const text = response.content.find(b => b.type === 'text')?.text ?? ''
  const toolUses = response.content.filter(b => b.type === 'tool_use')
  return { text, toolUses }
}

// ── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(toolName, input, supabaseAdmin, userId) {
  if (toolName === 'reschedule_task') {
    const { task_id, scheduled_for, due_time } = input
    const { data: task } = await supabaseAdmin
      .from('tasks').select('rollover_count').eq('id', task_id).single()
    await supabaseAdmin.from('tasks').update({
      scheduled_for,
      rollover_count: (task?.rollover_count || 0) + 1,
      ...(due_time ? { due_time } : {})
    }).eq('id', task_id)
    return { tool: 'reschedule_task', taskId: task_id, result: 'rescheduled' }
  }

  if (toolName === 'update_task_time') {
    const { task_id, due_time } = input
    await supabaseAdmin.from('tasks').update({ due_time }).eq('id', task_id)
    return { tool: 'update_task_time', taskId: task_id, result: 'updated' }
  }

  if (toolName === 'schedule_morning_checkin') {
    const { checkin_time } = input
    await supabaseAdmin.from('profiles')
      .update({ next_checkin_at: checkin_time }).eq('id', userId)
    await supabaseAdmin.from('tasks').insert({
      user_id: userId,
      title: 'Morning check-in with FocusBuddy',
      due_time: checkin_time,
      completed: false,
      archived: false,
      recurrence: 'none',
      consequence_level: 'self',
      rollover_count: 0,
      priority_score: 0,
      created_at: new Date().toISOString(),
      scheduled_for: checkin_time
    })
    return { tool: 'schedule_morning_checkin', taskId: null, result: 'scheduled' }
  }

  if (toolName === 'complete_task') {
    const { task_id } = input
    await supabaseAdmin.from('tasks').update({
      completed: true,
      completed_at: new Date().toISOString()
    }).eq('id', task_id)
    return { tool: 'complete_task', taskId: task_id, result: 'completed' }
  }

  return null
}

// ── Context prompt builders ───────────────────────────────────────────────────

function topTask(pending) {
  if (!pending.length) return null
  return pending.find(t => t.consequence_level === 'external' || t.due_time)
    || pending.find(t => (t.rollover_count || 0) > 0)
    || pending[0]
}

function fmtTaskLine(t) {
  const due = t.due_time
    ? new Date(t.due_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'none'
  return `- "${t.title}" | id:${t.id} | due:${due} | external:${t.consequence_level === 'external'} | rolled:${t.rollover_count || 0}x`
}

function buildContextPrompt(checkInType, profile, pending, completed, isFirstCheckin) {
  const rawName = profile.full_name || ''
  const name = rawName.includes('@') ? 'there' : (rawName.split(' ')[0] || 'there')
  const top = topTask(pending)
  const firstFlag = isFirstCheckin
    ? '\nThis is their very first check-in. Use the "Alright, first time working together." opener.'
    : ''
  const pendingLines = pending.length ? pending.map(fmtTaskLine).join('\n') : '- none'
  const completedTitles = completed.length
    ? completed.map(t => `"${t.title}"`).join(', ')
    : 'nothing'

  if (checkInType === 'morning') {
    return `It's morning. User: ${name}.
Top priority: ${top ? `"${top.title}" | id:${top.id}${top.due_time ? ` | due ${new Date(top.due_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}${top.consequence_level === 'external' ? ' | external' : ''}` : 'none'}.
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, checkInType, messages } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const supabaseAdmin = getAdminClient()

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles').select('*').eq('id', userId).single()
  if (profileErr || !profile) return res.status(404).json({ error: 'Profile not found' })

  const systemPrompt = buildPersonaPrompt(profile)

  // ── Continuing conversation ────────────────────────────────────────────────
  if (messages && messages.length > 0) {
    try {
      const { text, toolUses } = await callClaude(messages, systemPrompt)
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
      const { data: fresh } = await supabaseAdmin
        .from('tasks').select('rollover_count').eq('id', task.id).single()
      await supabaseAdmin.from('tasks').update({
        scheduled_for: tomorrowISO,
        rollover_count: (fresh?.rollover_count || 0) + 1
      }).eq('id', task.id)
      actionsExecuted.push({ tool: 'reschedule_task', taskId: task.id, result: 'rescheduled to tomorrow' })
    }))
  }

  if (isFirstCheckin) {
    // fire-and-forget — don't block the response
    supabaseAdmin.from('profiles')
      .update({ last_checkin_at: new Date().toISOString() })
      .eq('id', profile.id)
  }

  const contextPrompt = buildContextPrompt(type, profile, pending, completed, isFirstCheckin)

  try {
    const { text, toolUses } = await callClaude(
      [{ role: 'user', content: contextPrompt }],
      systemPrompt
    )
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
