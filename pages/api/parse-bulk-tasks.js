import Anthropic from '@anthropic-ai/sdk'
import withAuth from '../../lib/authGuard'

const client = new Anthropic()

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { text } = req.body
  if (!text?.trim()) return res.json({ tasks: [] })

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayDow = today.getDay()

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You parse a block of text containing multiple tasks and extract them as a JSON array. Today is ${todayStr} (${dayNames[todayDow]}).

Each task object has these fields: title (string, required), due_date (YYYY-MM-DD or null), due_time (HH:MM 24h or null), consequence_level ("self" or "external"), recurrence ("none", "daily", or "weekly"), notes (string or null).

TITLE RULES:
- Preserve deadline context IN the title if it is naturally part of the task name. Example: "Pay electric bill by Friday" → title: "Pay electric bill by Friday", NOT "Pay electric bill".
- Do not strip phrases like "by Friday", "before Monday", "by [date]" from titles.

DUE DATE RULES:
- If the title contains "by [day]" or "before [day]", compute the actual YYYY-MM-DD for the next upcoming occurrence of that day and set due_date. "by Friday" = next Friday from today.
- "today" = ${todayStr}, "tomorrow" = next calendar day.

CONSEQUENCE LEVEL RULES:
- "external" = ONLY when there is clearly another person involved: a meeting, appointment, call, pickup, or someone else is waiting on this.
- "self" = anything self-directed: paying a bill, cleaning, exercising, buying something, reading, writing, studying.
- Default to "self" when unclear. Do NOT default to "external".

Return ONLY valid JSON — a bare array, no markdown, no explanation.`,
      messages: [{ role: 'user', content: text }],
    })
    const raw = response.content[0].text.trim()
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return res.json({ tasks: [] })
    const tasks = JSON.parse(jsonMatch[0])
    return res.json({ tasks: Array.isArray(tasks) ? tasks : [] })
  } catch (err) {
    console.error('[parse-bulk-tasks]', err)
    return res.status(500).json({ tasks: [] })
  }
}

export default withAuth(handler)
