import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'
import { sanitizeTitle } from '../../../lib/sanitize'

export const config = { api: { bodyParser: true } }

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const SYSTEM_PROMPT = `You are a task parser. Extract structured data from natural language input.
Respond ONLY with a valid JSON object. No explanation, no markdown, no backticks.

Extract:
{
  "title": "clean task title (required)",
  "type": "task" | "bill" | "appointment" | "chore",
  "scheduled_for": "YYYY-MM-DD or null",
  "due_time": "HH:MM in 24h format or null",
  "amount": number or null (only for bills),
  "notes": "any extra context or null"
}

Rules:
- type = "bill" if the input mentions money, payment, or a recurring charge
- type = "appointment" if it mentions meeting, doctor, dentist, call, or a specific person at a specific time
- type = "chore" if it's a household task with no money or calendar element
- type = "task" for everything else
- For dates: "today" = today's date, "tomorrow" = tomorrow's date, "tuesday" = next Tuesday, etc.
- Today's date for reference will be provided in the user message.
- If no date mentioned, scheduled_for = today's date
- If no time mentioned, due_time = null
- Title should be clean and action-oriented. "Call the dentist" not "i need to call the dentist"`

async function handler(req, res, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text } = req.body
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }

  // Sanitize before AI call — strips HTML, trims, truncates to 500
  const sanitizedText = sanitizeTitle(text)
  if (!sanitizedText) return res.status(400).json({ error: 'text is required' })

  const today = new Date().toISOString().split('T')[0]
  const userMessage = `Parse this: "${sanitizedText}". Today's date is ${today}.`

  // ── AI Parse ─────────────────────────────────────────────────────────────

  let rawText = ''
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('[voice/parse] Anthropic error:', response.status, errBody)
      return res.status(502).json({ error: 'AI service error' })
    }

    const data = await response.json()
    rawText = data?.content?.[0]?.text?.trim() ?? ''
  } catch (fetchErr) {
    console.error('[voice/parse] Fetch to Anthropic failed:', fetchErr.message)
    return res.status(502).json({ error: 'AI service unavailable' })
  }

  // Strip markdown fences if model wraps response despite instructions
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (parseErr) {
    console.error('[voice/parse] JSON parse failed:', parseErr.message, '| raw:', rawText)
    return res.status(422).json({ error: 'parse_failed' })
  }

  // Normalise type to known values
  const VALID_TYPES = ['task', 'bill', 'appointment', 'chore']
  const type = VALID_TYPES.includes(parsed.type) ? parsed.type : 'task'
  const title = typeof parsed.title === 'string' && parsed.title.trim()
    ? parsed.title.trim()
    : sanitizedText
  const scheduledFor = typeof parsed.scheduled_for === 'string' ? parsed.scheduled_for : today
  const dueTime = typeof parsed.due_time === 'string' ? parsed.due_time : null
  const amount = typeof parsed.amount === 'number' ? parsed.amount : 0
  const notes = typeof parsed.notes === 'string' ? parsed.notes : null

  const supabaseAdmin = getAdminClient()
  const now = new Date().toISOString()

  // ── DB Insert ─────────────────────────────────────────────────────────────

  if (type === 'bill') {
    const dueDay = scheduledFor ? new Date(scheduledFor).getDate() : 1

    const { data: insertedBill, error: billErr } = await supabaseAdmin
      .from('bills')
      .insert({
        user_id: userId,
        name: title,
        amount: amount,
        due_day: dueDay,
        frequency: 'monthly',
        notes: notes,
        created_at: now,
      })
      .select()
      .single()

    if (billErr) {
      console.error('[voice/parse] bill insert error:', JSON.stringify(billErr))
      return res.status(500).json({ error: 'Failed to create bill' })
    }

    return res.status(200).json({
      record: insertedBill,
      type: 'bill',
      message: `Created: ${title}`,
    })
  }

  // Tasks, appointments, chores all go into tasks table
  let dueTimeISO = null
  if (dueTime) {
    // Combine scheduled_for date with HH:MM time into a full ISO timestamp
    try {
      dueTimeISO = new Date(`${scheduledFor}T${dueTime}:00`).toISOString()
    } catch {
      dueTimeISO = null
    }
  }

  const { data: insertedTask, error: taskErr } = await supabaseAdmin
    .from('tasks')
    .insert({
      user_id: userId,
      title: title,
      task_type: type,
      scheduled_for: scheduledFor,
      due_time: dueTimeISO,
      notes: notes,
      completed: false,
      archived: false,
      starred: false,
      rollover_count: 0,
      sort_order: 0,
      created_at: now,
    })
    .select()
    .single()

  if (taskErr) {
    console.error('[voice/parse] task insert error:', JSON.stringify(taskErr))
    return res.status(500).json({ error: 'Failed to create task' })
  }

  return res.status(200).json({
    record: insertedTask,
    type: type,
    message: `Created: ${title}`,
  })
}

export default withAuth(handler)
