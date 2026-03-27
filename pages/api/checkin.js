import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildPersonaPrompt } from '../../lib/persona'
import { compressAndSaveMemory } from '../../lib/memoryCompression'
import { checkDailyRateLimit, rateLimitErrorResponse } from '../../lib/rateLimit'
import withAuth from '../../lib/authGuard'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(url, key)
}

// ── Tool definitions ─────────────────────────────────────────────────────────

const PERSONA_VOICE_INSTRUCTION = `PERSONA VOICE — CRITICAL. You must write in the exact voice of the user's persona blend. Examples of how each persona actually sounds:

DRILL_SERGEANT: "Dentist done. Insurance call, project email, walk — all overdue. Pick one. Go." Short sentences. No praise. Imperative. No questions.
COACH: "Good momentum on the dentist call. You've got three things stacking up — insurance, project email, walk. Which one moves the needle most right now?"
HYPE_PERSON: "YES! Dentist call knocked out! Now we're cooking. Three more on the list — insurance, project email, walk. Which one are we CRUSHING next?!"
THINKING_PARTNER: "You got the dentist call done — what made that one easier to start? You've got insurance, project email, and your walk still open. What's actually in the way of the next one?"
STRATEGIST: "Dentist: complete. Three open: insurance call, project email, 30min walk. Highest consequence item is insurance. Recommend starting there. Confirm?"
EMPATH: "Really glad you got the dentist call done — that one takes courage. Three things still open. How are you feeling about tackling the next one?"

If the user's primary persona is drill_sergeant, write like the DRILL_SERGEANT example. Do not soften. Do not add warmth unless coach is in the blend. Commit fully to the voice.`

const TOOL_USE_RULES = `TOOL USE RULES — CRITICAL:
When the user confirms a time, date, or scheduling decision during conversation, you MUST immediately call the appropriate tool — do not just acknowledge it conversationally. Examples:
- User says "let's do 6pm" → call reschedule_task with due_time = 6pm today
- User says "add that to my list" → call create_task immediately
- User says "mark that done" → call complete_task immediately
- User says "push it to tomorrow" → call reschedule_task with tomorrow's date
Never say "I'll add that" or "I've scheduled that" without actually calling the tool. Talk is not action. Use the tool.

TIME CONVERSION — MANDATORY:
All datetime values in tool calls must be in UTC (ISO 8601). The user's local time and UTC offset are in the context above.
Convert before calling: user says "6pm" → look up their UTC offset → compute UTC time → use that in the tool call.
WRONG: due_time: "2026-03-24T18:00:00.000Z" when user is UTC-5 and says "6pm" (that would show as 1pm local)
RIGHT: due_time: "2026-03-24T23:00:00.000Z" (18:00 local + 5 hours = 23:00 UTC)

FINANCE RULES — MANDATORY:
When the user asks about their finances, bills, spending, or daily budget — always call get_bills, get_daily_number, or log_spend before responding. Never estimate or guess financial figures. Always get live data. Examples:
- User says "how much have I spent today?" → call get_daily_number first
- User says "what bills are coming up?" → call get_bills first
- User says "I just spent $50 on coffee" → call log_spend immediately
- User says "can I afford this?" → call get_daily_number to check remaining budget`

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
  },
  {
    name: 'create_task',
    description: "Create a new task for the user. Use when the user mentions something they need to do that isn't already on their list.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The task title' },
        due_time: { type: 'string', description: 'ISO datetime string for the due time (e.g. 2026-03-24T18:00:00.000Z). Combine scheduled_for date with the time the user specified.' },
        scheduled_for: { type: 'string', description: 'ISO date string for when to schedule it, defaults to today' }
      },
      required: ['title']
    }
  },
  {
    name: 'add_crew_task',
    description: 'Add a task to a crew member\'s task list. Use when the user wants to delegate a task to a family or work crew member.',
    input_schema: {
      type: 'object',
      properties: {
        crew_id: { type: 'string', description: 'The crew ID to add the task to' },
        assignee_id: { type: 'string', description: 'The UUID of the crew member to assign the task to' },
        title: { type: 'string', description: 'The task title' },
        due_date: { type: 'string', description: 'Optional ISO date string for the due date' }
      },
      required: ['crew_id', 'assignee_id', 'title']
    }
  },
  {
    name: 'get_crew_status',
    description: 'Get the current task status for a crew. Returns count of open, claimed, and done tasks per member.',
    input_schema: {
      type: 'object',
      properties: {
        crew_id: { type: 'string', description: 'The crew ID to get status for' }
      },
      required: ['crew_id']
    }
  },
  {
    name: 'update_bill',
    description: 'Update a bill\'s details like due day, amount, or autopay status.',
    input_schema: {
      type: 'object',
      properties: {
        bill_id: { type: 'string', description: 'The bill ID to update' },
        due_day: { type: 'integer', description: 'Day of month bill is due (1-31)' },
        amount: { type: 'number', description: 'Bill amount in dollars' },
        autopay: { type: 'boolean', description: 'Whether bill autopays' }
      },
      required: ['bill_id']
    }
  },
  {
    name: 'get_bills',
    description: 'Get all bills for the user. Returns array of bills with their details.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'add_bill',
    description: 'Create a new recurring bill. Use when user wants to add a new monthly/recurring expense.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Bill name (e.g., "Netflix", "Rent")' },
        amount: { type: 'number', description: 'Amount in dollars' },
        due_day: { type: 'integer', description: 'Day of month due (1-31)' },
        frequency: { type: 'string', description: 'Frequency (monthly, weekly, annual, etc.)' },
        category: { type: 'string', description: 'Category (entertainment, housing, utilities, etc.)' },
        autopay: { type: 'boolean', description: 'Whether bill autopays', default: false }
      },
      required: ['name', 'amount', 'due_day', 'frequency']
    }
  },
  {
    name: 'log_spend',
    description: 'Log a spending transaction. Use when user mentions spending money or making a purchase.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount spent in dollars' },
        category: { type: 'string', description: 'Spending category (food, transport, shopping, etc.)' },
        description: { type: 'string', description: 'Brief description of what was spent on' },
        impulse: { type: 'boolean', description: 'Whether this was an impulse purchase', default: false }
      },
      required: ['amount']
    }
  },
  {
    name: 'get_daily_number',
    description: 'Get calculated daily budget. Returns (monthly_income - monthly_bills) / 30 minus today\'s spending.',
    input_schema: {
      type: 'object',
      properties: {}
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
  return { text, toolUses, rawContent: response.content }
}

// ── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(toolName, input, supabaseAdmin, userId, profile = null) {

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
      // rollover_count intentionally NOT incremented here — only the nightly cron owns that counter
      ...(due_time ? { due_time } : {})
    }

    let updated = null
    let updateErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('tasks').update(updates).eq('id', task_id).select().single()
      updateErr = error
      updated = data
    } catch (e) {
      console.error('[checkin:tool] reschedule_task update threw:', e)
      return { tool: 'reschedule_task', taskId: task_id, result: 'error', updatedTask: null }
    }

    if (updateErr) console.error('[checkin:tool] reschedule_task update error:', JSON.stringify(updateErr))
    else {
    }

    return { tool: 'reschedule_task', taskId: task_id, result: updateErr ? 'error' : 'rescheduled', updatedTask: updated || null }
  }

  if (toolName === 'update_task_time') {
    const { task_id, due_time } = input

    let updated = null
    let updateErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('tasks').update({ due_time }).eq('id', task_id).select().single()
      updateErr = error
      updated = data
    } catch (e) {
      console.error('[checkin:tool] update_task_time threw:', e)
      return { tool: 'update_task_time', taskId: task_id, result: 'error', updatedTask: null }
    }

    if (updateErr) console.error('[checkin:tool] update_task_time error:', JSON.stringify(updateErr), 'task_id:', task_id)
    else {
    }

    return { tool: 'update_task_time', taskId: task_id, result: updateErr ? 'error' : 'updated', updatedTask: updated || null }
  }

  if (toolName === 'schedule_morning_checkin') {
    const { checkin_time } = input
    // Only update the profile — do NOT create a task
    let profileErr = null
    try {
      const { error } = await supabaseAdmin
        .from('profiles').update({ next_checkin_at: checkin_time }).eq('id', userId)
      profileErr = error
    } catch (e) {
      console.error('[checkin:tool] schedule_morning_checkin threw:', e)
      return { tool: 'schedule_morning_checkin', taskId: null, result: 'error' }
    }

    if (profileErr) console.error('[checkin:tool] schedule_morning_checkin profile error:', JSON.stringify(profileErr))
    else {
    }

    return { tool: 'schedule_morning_checkin', taskId: null, result: profileErr ? 'error' : 'scheduled' }
  }

  if (toolName === 'complete_task') {
    const { task_id } = input
    const completedAt = new Date().toISOString()

    let updated = null
    let updateErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('tasks').update({ completed: true, completed_at: completedAt })
        .eq('id', task_id).select().single()
      updateErr = error
      updated = data
    } catch (e) {
      console.error('[checkin:tool] complete_task threw:', e)
      return { tool: 'complete_task', taskId: task_id, result: 'error', updatedTask: null }
    }

    if (updateErr) console.error('[checkin:tool] complete_task error:', JSON.stringify(updateErr), 'task_id:', task_id)
    else {
    }

    return { tool: 'complete_task', taskId: task_id, result: updateErr ? 'error' : 'completed', updatedTask: updated || null }
  }

  if (toolName === 'archive_task') {
    const { task_id } = input

    let updated = null
    let updateErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('tasks').update({ archived: true })
        .eq('id', task_id).select().single()
      updateErr = error
      updated = data
    } catch (e) {
      console.error('[checkin:tool] archive_task threw:', e)
      return { tool: 'archive_task', taskId: task_id, result: 'error', updatedTask: null }
    }

    if (updateErr) console.error('[checkin:tool] archive_task error:', JSON.stringify(updateErr), 'task_id:', task_id)
    else {
    }

    return { tool: 'archive_task', taskId: task_id, result: updateErr ? 'error' : 'archived', updatedTask: updated || null }
  }

  if (toolName === 'create_alarm') {
    const { alarm_time, title, task_id } = input

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
    } catch (e) {
      console.error('[checkin:tool] create_alarm threw:', e)
      return { tool: 'create_alarm', result: 'error', alarm: null }
    }

    if (insertErr) console.error('[checkin:tool] create_alarm error:', JSON.stringify(insertErr))
    else {
    }

    return { tool: 'create_alarm', result: insertErr ? 'error' : 'created', alarm: inserted || null }
  }

  if (toolName === 'create_task') {
    const rawDate = input.scheduled_for ? new Date(input.scheduled_for) : new Date()
    const normalized = new Date(rawDate)
    normalized.setHours(12, 0, 0, 0)
    const scheduledFor = normalized.toISOString()

    // Normalize due_time: must be a valid ISO datetime for the DB timestamptz column.
    // If AI sends a human-readable time like "6:00 PM", convert it using scheduled_for
    // as the date base. If it still can't be parsed, fall back to null.
    let dueTimeISO = null
    if (input.due_time) {
      const parsed = new Date(input.due_time)
      if (!isNaN(parsed.getTime())) {
        dueTimeISO = parsed.toISOString()
      } else {
        // Looks like a bare time string — combine with scheduled_for date
        try {
          const dateBase = scheduledFor.slice(0, 10) // YYYY-MM-DD
          const combined = new Date(`${dateBase} ${input.due_time}`)
          if (!isNaN(combined.getTime())) dueTimeISO = combined.toISOString()
        } catch {}
      }
    }

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        user_id: userId,
        title: input.title,
        due_time: dueTimeISO,
        scheduled_for: scheduledFor,
        completed: false,
        archived: false
      })
      .select()
      .single()
    if (error) {
      console.error('[checkin:executeTool] create_task error:', JSON.stringify(error))
      return { result: 'error', error: error.message }
    }
    return { result: 'created', task_id: data.id, title: data.title }
  }

  if (toolName === 'add_crew_task') {
    const { crew_id, assignee_id, title, due_date } = input

    // INSERT into crew_tasks
    const { data: crewTask, error: crewError } = await supabaseAdmin
      .from('crew_tasks')
      .insert({
        crew_id,
        added_by: userId,
        assigned_to: assignee_id,
        title,
        due_date,
        status: 'open'
      })
      .select()
      .single()

    if (crewError) {
      console.error('[checkin:tool] add_crew_task crew_tasks insert error:', JSON.stringify(crewError))
      return { result: 'error', error: crewError.message }
    }

    // Also INSERT into tasks for the assignee so it appears in their Tasks tab
    const assigneeTask = await supabaseAdmin
      .from('tasks')
      .insert({
        user_id: assignee_id,
        title: `${title} (Added by ${userId})`,
        scheduled_for: new Date().toISOString().slice(0, 10),
        completed: false,
        archived: false
      })
      .select()
      .single()
      .catch(err => {
        console.error('[checkin:tool] add_crew_task tasks insert failed:', JSON.stringify(err))
        return { data: null, error: err }
      })

    return { result: 'added', crew_task_id: crewTask.id, assignee_task_id: assigneeTask?.data?.id }
  }

  if (toolName === 'get_crew_status') {
    const { crew_id } = input

    // Query crew_tasks grouped by assigned_to and status
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('crew_tasks')
      .select('assigned_to, status')
      .eq('crew_id', crew_id)

    if (tasksError) {
      console.error('[checkin:tool] get_crew_status query error:', JSON.stringify(tasksError))
      return { result: 'error', error: tasksError.message }
    }

    // Count by assigned_to and status
    const statusMap = {}
    tasks.forEach(task => {
      if (!statusMap[task.assigned_to]) {
        statusMap[task.assigned_to] = { open: 0, claimed: 0, done: 0 }
      }
      statusMap[task.assigned_to][task.status]++
    })

    // Get crew member names for context
    const { data: members, error: membersError } = await supabaseAdmin
      .from('crew_members')
      .select('user_id, profiles(full_name)')
      .eq('crew_id', crew_id)

    if (membersError) {
      console.error('[checkin:tool] get_crew_status members query error:', JSON.stringify(membersError))
      return { result: 'error', error: membersError.message }
    }

    // Format response with member names
    const status = members.map(m => ({
      member_id: m.user_id,
      member_name: m.profiles?.full_name || 'Unknown',
      tasks: statusMap[m.user_id] || { open: 0, claimed: 0, done: 0 }
    }))

    return { result: 'retrieved', crew_id, status }
  }

  if (toolName === 'update_bill') {
    const { bill_id, due_day, amount, autopay } = input

    const updates = {}
    if (due_day !== undefined) updates.due_day = due_day
    if (amount !== undefined) updates.amount = amount
    if (autopay !== undefined) updates.autopay = autopay

    if (Object.keys(updates).length === 0) {
      return { result: 'error', error: 'No fields to update' }
    }

    let updated = null
    let updateErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('bills').update(updates).eq('id', bill_id).eq('user_id', userId).select().single()
      updateErr = error
      updated = data
    } catch (e) {
      console.error('[checkin:tool] update_bill threw:', e)
      return { result: 'error', error: e.message }
    }

    if (updateErr) {
      console.error('[checkin:tool] update_bill error:', JSON.stringify(updateErr))
      return { result: 'error', error: updateErr.message }
    }

    return { result: 'updated', bill_id, updatedBill: updated }
  }

  if (toolName === 'get_bills') {

    let bills = null
    let billsErr = null
    try {
      const { data, error } = await supabaseAdmin
        .from('bills').select('*').eq('user_id', userId)
      billsErr = error
      bills = data
    } catch (e) {
      console.error('[checkin:tool] get_bills threw:', e)
      return { result: 'error', error: e.message }
    }

    if (billsErr) {
      console.error('[checkin:tool] get_bills error:', JSON.stringify(billsErr))
      return { result: 'error', error: billsErr.message }
    }

    return { result: 'retrieved', bills: bills || [] }
  }

  if (toolName === 'add_bill') {
    const { name, amount, due_day, frequency, category, autopay } = input

    const { data, error } = await supabaseAdmin
      .from('bills')
      .insert({
        user_id: userId,
        name,
        amount,
        due_day,
        frequency,
        category,
        autopay: autopay || false
      })
      .select()
      .single()

    if (error) {
      console.error('[checkin:tool] add_bill error:', JSON.stringify(error))
      return { result: 'error', error: error.message }
    }

    return { result: 'created', bill_id: data.id, bill: data }
  }

  if (toolName === 'log_spend') {
    const { amount, category, description, impulse } = input

    const { data, error } = await supabaseAdmin
      .from('spend_log')
      .insert({
        user_id: userId,
        amount,
        category,
        description,
        impulse: impulse || false
      })
      .select()
      .single()

    if (error) {
      console.error('[checkin:tool] log_spend error:', JSON.stringify(error))
      return { result: 'error', error: error.message }
    }

    return { result: 'logged', spend_id: data.id, amount }
  }

  if (toolName === 'get_daily_number') {

    // Fetch all bills and today's spending
    const { data: allBills, error: billsErr } = await supabaseAdmin
      .from('bills').select('amount').eq('user_id', userId)

    const todayStr = new Date().toLocaleDateString('en-CA')
    const { data: todaySpending, error: spendErr } = await supabaseAdmin
      .from('spend_log')
      .select('amount')
      .eq('user_id', userId)
      .gte('created_at', `${todayStr}T00:00:00`)
      .lt('created_at', `${todayStr}T23:59:59`)

    if (billsErr || spendErr) {
      console.error('[checkin:tool] get_daily_number errors:', billsErr, spendErr)
      return { result: 'error', error: 'Failed to calculate daily number' }
    }

    const monthlyIncome = profile?.monthly_income || 0
    const monthlyBills = (allBills || []).reduce((sum, b) => sum + (b.amount || 0), 0)
    const todaySpent = (todaySpending || []).reduce((sum, s) => sum + (s.amount || 0), 0)
    const baseDaily = ((monthlyIncome - monthlyBills) / 30).toFixed(2)
    const remaining = (baseDaily - todaySpent).toFixed(2)

    return {
      result: 'calculated',
      monthly_income: monthlyIncome,
      monthly_bills: monthlyBills.toFixed(2),
      base_daily: baseDaily,
      today_spent: todaySpent.toFixed(2),
      remaining: remaining
    }
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
  const { focusTask, focusDuration, timezone, todayStr, tomorrowStr } = extra || {}
  const tz = timezone || 'America/Chicago'
  const today = todayStr || new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const tomorrow = tomorrowStr || new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: tz })
  const dateContext = `\nToday's date is: ${today}. When creating tasks, use today's date for tasks the user says are happening today, and tomorrow's date (${tomorrow}) for tasks they say are happening tomorrow. Always use local date not UTC.`

  if (checkInType === 'focus') {
    return `Focus mode. User: ${name}.
They spent ${focusDuration || 25} minutes on "${focusTask || 'their task'}" and got stuck.
Write 2 sentences. Ask one specific question to help them identify what's in the way. Be direct, no fluff.${dateContext}`
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
Write 3 sentences. Name one specific win, one pattern you noticed, one thing to focus on next week. Use real task names. Be specific and direct.${dateContext}`
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
Write the opening morning check-in. 2-3 sentences max. Name the top task specifically. If you commit to checking in at a specific time, call schedule_morning_checkin.${dateContext}`
  }

  if (checkInType === 'midday') {
    return `It's midday. User: ${name}.
Completed so far: ${completedTitles}.
Pending tasks:
${pendingLines}${firstFlag}
Write the midday check-in. 2 sentences. Acknowledge what's done by name, name what's next. If the user confirmed completing something, call complete_task. If they want to move something, call reschedule_task or update_task_time.${dateContext}`
  }

  // evening — pending tasks are being auto-rescheduled before this message; tell the user
  return `It's evening. User: ${name}.
Completed today: ${completedTitles}.
These tasks are being moved to tomorrow morning (already done — just tell them):
${pendingLines}${firstFlag}
Write the evening check-in. 2-3 sentences. One specific win or honest acknowledgment, confirm what moves to tomorrow by name, one closing line.${dateContext}`
}

// ── Logging helper ───────────────────────────────────────────────────────────

async function logCheckinMessage(supabaseAdmin, userId, role, content, personaBlend) {
  try {
    const { error } = await supabaseAdmin.from('checkin_logs').insert({
      user_id: userId,
      role,
      content,
      persona_blend: role === 'assistant' ? personaBlend : null
    })
    if (error) {
      console.error('[checkin:logging] insert error:', JSON.stringify(error))
    } else {
    }
  } catch (err) {
    console.error('[checkin:logging] exception:', err.message)
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export const config = { maxDuration: 30 }

async function handler(req, res, userId) {

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { checkInType, messages, timezone, tasks: clientTasks } = req.body

  // ── Next Move fast path ────────────────────────────────────────────────────
  if (checkInType === 'next_move') {
    try {
      const supabaseAdmin = getAdminClient()
      const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single()
      const baselineContext = profile?.baseline_profile ? `USER COACHING PROFILE:\n${profile.baseline_profile}\n\n` : ''
      const personaBlend = profile?.persona_blend || ['coach']
      const personaBlendLabel = personaBlend
        .map(p => p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
        .join(', ')
      const nmStreak = profile?.current_streak || 0
      const nmLiveContext = `\n\nCurrent context:\n- Streak: ${nmStreak} day${nmStreak !== 1 ? 's' : ''}\n- Coaching persona: ${personaBlendLabel}`
      const isDrillSergeant = personaBlend[0] === 'drill_sergeant'
      const personaPriority = isDrillSergeant
        ? `PRIMARY PERSONA: DRILL SERGEANT. HARD RULES — NO EXCEPTIONS:\n- NEVER open with praise, "nice work", "good job", or any positive affirmation\n- NEVER end with a question — give a command instead\n- Use SHORT sentences. Maximum 8 words per sentence.\n- ALWAYS start with the task status or next action, not acknowledgment\n- WRONG: "Nice work on the dentist call. What's next?"\n- RIGHT: "Dentist done. Insurance call is overdue. Make it now."\n\n`
        : `The user's PRIMARY persona is ${personaBlend[0]} — this voice must dominate. Secondary personas add subtle flavor only.\n\n`
      const systemPrompt = baselineContext + nmLiveContext + personaPriority + PERSONA_VOICE_INSTRUCTION + '\n\n' + buildPersonaPrompt(profile || {})
      const pending = (clientTasks || []).filter(t => !t.completed && !t.archived)
      const taskLines = pending.length
        ? pending.slice(0, 10).map(t => {
            const due = t.due_time ? ` | due ${new Date(t.due_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''
            const rolled = t.rollover_count > 0 ? ` | rolled ${t.rollover_count}x` : ''
            const ext = t.consequence_level === 'external' ? ' | external' : ''
            return `- "${t.title}"${due}${rolled}${ext}`
          }).join('\n')
        : '- no pending tasks'
      const prompt = `The user has tapped "What's my next move?" on their task list. Here are their pending tasks:\n${taskLines}\n\nRespond with exactly ONE directive. Name the single best task to start right now in **bold**. Add one sentence explaining why (due time, external commitment, or momentum). Total response: under 30 words. No greeting, no filler.`
      const { text } = await callClaude(
        [{ role: 'user', content: prompt }],
        systemPrompt,
        false
      )
      return res.status(200).json({ message: text })
    } catch (err) {
      console.error('[checkin] next_move error:', err.message)
      return res.status(500).json({ error: 'Failed to get next move' })
    }
  }

  const userMessage = req.body.content || req.body.message || ''
  if (userMessage.length > 2000) {
    return res.status(400).json({ error: 'Message too long. Please keep messages under 2000 characters.' })
  }

  const rateCheck = await checkDailyRateLimit(userId)
  if (!rateCheck.allowed) {
    return res.status(429).json(rateLimitErrorResponse(rateCheck))
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone || 'America/Chicago' })
  const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: timezone || 'America/Chicago' })

  try {
  const supabaseAdmin = getAdminClient()

  // One-time cleanup: remove any stale "Morning check-in" tasks created by old tool code
  supabaseAdmin.from('tasks')
    .delete()
    .eq('user_id', userId)
    .eq('title', 'Morning check-in with Cinis')

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles').select('*').eq('id', userId).single()
  if (profileErr || !profile) {
    console.error('[checkin] profile fetch error:', JSON.stringify(profileErr))
    return res.status(404).json({ error: 'Profile not found' })
  }

  // ── Fetch tasks and crews early so live context can be injected into system prompt ────
  const { data: allTasks = [] } = await supabaseAdmin
    .from('tasks').select('*').eq('user_id', userId).eq('archived', false)

  // Fetch bills for injection with IDs so AI can call update_bill
  const { data: allBills = [] } = await supabaseAdmin
    .from('bills').select('*').eq('user_id', userId)

  // Fetch user's crews (where they're owner or member)
  const { data: userCrews = [] } = await supabaseAdmin
    .from('crews')
    .select('id, name, type, owner_id')
    .or(`owner_id.eq.${userId},crew_members(crew_id,user_id).eq.user_id,${userId}`)

  // Fetch crew members for each crew
  let crewContextStr = ''
  if (userCrews && userCrews.length > 0) {
    const crewsList = []
    for (const crew of userCrews) {
      const { data: members = [] } = await supabaseAdmin
        .from('crew_members')
        .select('user_id, profiles(id, full_name)')
        .eq('crew_id', crew.id)

      crewsList.push({
        id: crew.id,
        name: crew.name,
        type: crew.type,
        members: members.map(m => ({ id: m.user_id, name: m.profiles?.full_name || 'Unknown' }))
      })
    }
    if (crewsList.length > 0) {
      crewContextStr = `\n- Your crews: ${JSON.stringify(crewsList)}`
    }
  }

  const allPending = (allTasks || []).filter(t => !t.completed)
  const allCompleted = (allTasks || []).filter(t => t.completed)
  const overdueCount = allPending.filter(t => t.scheduled_for && t.scheduled_for.slice(0, 10) < todayStr).length
  const currentStreak = profile.current_streak || 0
  const taskLines = allPending.slice(0, 12).map(t => {
    let label = `- "${t.title}" | id:${t.id} | sched:${(t.scheduled_for || '').slice(0, 10)}`
    if ((t.rollover_count || 0) > 0) label += ` | rolled:${t.rollover_count}×`
    return label
  })
  const taskSummary = taskLines.length > 0 ? '\n' + taskLines.join('\n') : 'none'

  // Format bills with IDs for AI tool calls
  const billLines = allBills.slice(0, 8).map(b => {
    return `- "${b.name}" | id:${b.id} | amount:$${(b.amount || 0).toFixed(2)} | due_day:${b.due_day} | frequency:${b.frequency || 'monthly'} | autopay:${b.autopay ? 'yes' : 'no'}`
  })
  const billSummary = billLines.length > 0 ? '\n' + billLines.join('\n') : 'none'

  // Calculate full finance context
  const monthlyTotal = (allBills || []).reduce((sum, b) => sum + (b.amount || 0), 0)
  const monthlyIncome = profile?.monthly_income || null
  const dailyNumber = monthlyIncome ? ((monthlyIncome - monthlyTotal) / 30).toFixed(2) : null

  // Fetch today's spending
  const todayLocalStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone || 'America/Chicago' })
  const { data: todaySpends = [] } = await supabaseAdmin
    .from('spend_log')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', `${todayLocalStr}T00:00:00`)
    .lt('created_at', `${todayLocalStr}T23:59:59`)

  const totalTodaySpent = (todaySpends || []).reduce((sum, s) => sum + (s.amount || 0), 0)
  const remainingToday = dailyNumber ? (dailyNumber - totalTodaySpent).toFixed(2) : null

  // Format today's spending
  let todaySpendStr = ''
  if (todaySpends.length > 0) {
    const spendLines = todaySpends.map(s => `- $${(s.amount || 0).toFixed(2)} on ${s.category || 'uncategorized'}${s.description ? ': ' + s.description : ''}${s.impulse ? ' (impulse)' : ''}`)
    todaySpendStr = `\n- Today's spending ($${totalTodaySpent.toFixed(2)}):${spendLines.length > 0 ? '\n  ' + spendLines.join('\n  ') : ' none yet'}`
  }

  // Find bills due within next 7 days with exact dates
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const today = now.getDate()
  const nextWeekDay = (today + 7) % 31 || 31

  const upcomingBills = (allBills || [])
    .filter(b => {
      const dueDay = b.due_day || 1
      // Bill is upcoming if due_day is between today and today+7
      if (today <= 24) {
        // Simple case: today + 7 doesn't wrap month
        return dueDay > today && dueDay <= today + 7
      } else {
        // Wrap case: bills due in next 7 days includes next month start
        return dueDay > today || dueDay <= nextWeekDay
      }
    })
    .map(b => {
      let dueDate = new Date(currentYear, currentMonth, b.due_day || 1)
      // Handle month wrap
      if (dueDate < now) dueDate = new Date(currentYear, currentMonth + 1, b.due_day || 1)
      const dueDateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `${b.name} due ${dueDateStr} ($${(b.amount || 0).toFixed(2)})`
    })

  let financeContextStr = ''
  if (monthlyTotal > 0 || monthlyIncome) {
    financeContextStr = `\n\nFinancial context:\n- Monthly bills total: $${monthlyTotal.toFixed(2)}\n- Daily budget: $${dailyNumber || 'not set'}${remainingToday ? ` (remaining today: $${remainingToday})` : ''}${todaySpendStr}`
    if (upcomingBills.length > 0) {
      financeContextStr += `\n- Upcoming bills (next 7 days): ${upcomingBills.join(', ')}`
    }
    financeContextStr += `\n- Bills (full list with IDs for tool calls):${billSummary}`
  }

  // Resolve persona blend before liveContext so the label can be included
  const personaBlend = profile?.persona_blend || ['coach']
  const personaBlendLabel = personaBlend
    .map(p => p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .join(', ')

  // Compute user's local time and UTC offset for timezone-aware scheduling
  const tz = timezone || 'America/Chicago'
  const nowDate = new Date()
  const localTimeStr = nowDate.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
  const tzAbbrStr = nowDate.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').slice(-1)[0]
  const utcMs = new Date(nowDate.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
  const localMs = new Date(nowDate.toLocaleString('en-US', { timeZone: tz })).getTime()
  const utcOffsetHours = Math.round((localMs - utcMs) / 3600000)
  const utcOffsetStr = utcOffsetHours >= 0 ? `UTC+${utcOffsetHours}` : `UTC${utcOffsetHours}`

  const liveContext = `\n\nCurrent context:\n- Tasks today (use id field when calling tools):${taskSummary}\n- Overdue: ${overdueCount} task${overdueCount !== 1 ? 's' : ''}\n- Streak: ${currentStreak} day${currentStreak !== 1 ? 's' : ''}\n- Coaching persona: ${personaBlendLabel}\n- User's local time: ${localTimeStr} ${tzAbbrStr} (${utcOffsetStr})\n- TIMEZONE RULE: All tool calls use UTC. Convert user's stated time before calling. Example: 6pm ${tzAbbrStr} = ${(18 - utcOffsetHours) % 24}:00 UTC. Never store user-stated times as-is.${financeContextStr}${crewContextStr}`

  const baselineContext = profile?.baseline_profile ? `USER COACHING PROFILE:\n${profile.baseline_profile}\n\n` : ''
  const isPro = profile.subscription_status === 'pro' ||
                profile.subscription_status === 'pro_sms' ||
                profile.subscription_status === 'unlimited'
  const memoryContext = (isPro && profile.rolling_memory_summary)
    ? `\n\nROLLING MEMORY (previous sessions):\n${profile.rolling_memory_summary}`
    : ''
  const isDrillSergeant = personaBlend[0] === 'drill_sergeant'
  const personaPriority = isDrillSergeant
    ? `PRIMARY PERSONA: DRILL SERGEANT. HARD RULES — NO EXCEPTIONS:\n- NEVER open with praise, "nice work", "good job", or any positive affirmation\n- NEVER end with a question — give a command instead\n- Use SHORT sentences. Maximum 8 words per sentence.\n- ALWAYS start with the task status or next action, not acknowledgment\n- WRONG: "Nice work on the dentist call. What's next?"\n- RIGHT: "Dentist done. Insurance call is overdue. Make it now."\n\n`
    : `The user's PRIMARY persona is ${personaBlend[0]} — this voice must dominate. Secondary personas add subtle flavor only.\n\n`
  const systemPrompt = baselineContext + liveContext + memoryContext + personaPriority + PERSONA_VOICE_INSTRUCTION + '\n\n' + TOOL_USE_RULES + '\n\n' + buildPersonaPrompt(profile)


  // ── Continuing conversation ────────────────────────────────────────────────
  if (messages && messages.length > 0) {
    try {
      let { text, toolUses, rawContent } = await callClaude(messages, systemPrompt)
      const actions = await Promise.all(
        toolUses.map(tu => executeTool(tu.name, tu.input, supabaseAdmin, userId, profile))
      )
      // Two-step tool_use: get confirmation text after tool execution
      if (toolUses.length > 0) {
        const followUpMessages = [
          ...messages,
          { role: 'assistant', content: rawContent },
          {
            role: 'user',
            content: toolUses.map((tu, i) => ({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(actions[i] || { result: 'ok' })
            }))
          }
        ]
        const { text: confirmText } = await callClaude(followUpMessages, systemPrompt, false)
        if (confirmText) text = confirmText
      }
      // Log user message if it exists
      if (userMessage) {
        logCheckinMessage(supabaseAdmin, userId, 'user', userMessage, null).catch(() => {})
      }
      // Log AI response
      logCheckinMessage(supabaseAdmin, userId, 'assistant', text, personaBlend).catch(() => {})
      // Fire-and-forget memory compression after 3+ message exchanges (6+ total messages)
      if (isPro && messages && messages.length >= 6) {
        compressAndSaveMemory(userId, messages, profile.rolling_memory_summary).catch(err => console.error('Memory compression failed:', err))
      }
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
  // Tasks already fetched above for live context injection — reuse here
  const pending = allPending
  const completed = allCompleted
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
        // Only update scheduled_for — rollover_count is owned by the nightly cron, not user-triggered rescheduling
        const { error: rollErr } = await supabaseAdmin.from('tasks').update({
          scheduled_for: tomorrowISO,
        }).eq('id', task.id)
        if (rollErr) console.error('[checkin] evening rollover error:', JSON.stringify(rollErr), 'task_id:', task.id)
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

  const extra = { focusTask: req.body.focusTask, focusDuration: req.body.focusDuration, timezone, todayStr, tomorrowStr }
  const contextPrompt = buildContextPrompt(type, profile, pending, completed, isFirstCheckin, extra)

  const noTools = type === 'focus' || type === 'weekly_summary'

  try {
    const openingMessages = [{ role: 'user', content: contextPrompt }]
    let { text, toolUses, rawContent } = await callClaude(openingMessages, systemPrompt, !noTools)
    const toolActions = await Promise.all(
      toolUses.map(tu => executeTool(tu.name, tu.input, supabaseAdmin, userId, profile))
    )
    // Two-step tool_use: get confirmation text after tool execution
    if (toolUses.length > 0) {
      const followUpMessages = [
        ...openingMessages,
        { role: 'assistant', content: rawContent },
        {
          role: 'user',
          content: toolUses.map((tu, i) => ({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(toolActions[i] || { result: 'ok' })
          }))
        }
      ]
      const { text: confirmText } = await callClaude(followUpMessages, systemPrompt, false)
      if (confirmText) text = confirmText
    }
    // Increment session_count for opening check-ins (fire-and-forget)
    supabaseAdmin.from('profiles')
      .select('session_count').eq('id', userId).single()
      .then(({ data }) => {
        const current = data?.session_count || 0
        supabaseAdmin.from('profiles').update({ session_count: current + 1 }).eq('id', userId).then(() => {
        })
      }).catch(err => console.error('[checkin] session_count increment failed:', err))
    // Log AI response for opening messages
    logCheckinMessage(supabaseAdmin, userId, 'assistant', text, personaBlend).catch(() => {})
    // Fire-and-forget memory compression for opening messages after 3+ exchanges (6+ total)
    if (isPro && openingMessages && openingMessages.length >= 6) {
      compressAndSaveMemory(userId, openingMessages, profile.rolling_memory_summary).catch(err => console.error('Memory compression failed:', err))
    }
    return res.status(200).json({
      message: text,
      actionsExecuted: [...actionsExecuted, ...toolActions.filter(Boolean)]
    })
  } catch (err) {
    console.error('[checkin] opening error:', err.message)
    return res.status(500).json({ error: 'Failed to generate check-in' })
  }

  } catch (err) {
    console.error('[checkin] unhandled error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withAuth(handler)
