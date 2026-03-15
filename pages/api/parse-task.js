export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { transcript } = req.body
  if (!transcript) return res.status(400).json({ error: 'No transcript' })

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const prompt = `You are parsing a spoken task into structured data. Today is ${todayStr}.

User said: "${transcript}"

Return ONLY valid JSON, no other text:
{
  "title": "the task name, clear and concise",
  "due_date": "YYYY-MM-DD or null",
  "due_time": "HH:MM in 24hr format or null",
  "consequence_level": "external or self",
  "notes": "any extra context or reminders mentioned, or null",
  "recurrence": "none or daily or weekly"
}

Rules:
- "tomorrow" = ${tomorrowStr}
- "today" = ${todayStr}
- "morning" = 09:00, "afternoon" = 14:00, "evening" = 18:00, "tonight" = 20:00
- external = involves another person or hard deadline with consequences
- self = personal task, no one else depending on it
- Extract recurrence if they say "every day", "daily", "every week", "weekly"
- notes = anything that would help them start the task (policy numbers, names, context)`

  console.log('[parse-task] Received transcript:', transcript)

  let data
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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('[parse-task] Anthropic API error status:', response.status, errBody)
      return res.status(502).json({ error: 'Anthropic API error', status: response.status })
    }

    data = await response.json()
  } catch (err) {
    console.error('[parse-task] Fetch to Anthropic failed:', err.message)
    return res.status(500).json({ error: 'Failed to reach Anthropic API', message: err.message })
  }

  const rawText = data?.content?.[0]?.text?.trim() ?? ''
  console.log('[parse-task] Raw Claude response:', rawText)

  // Strip markdown fences in case Claude adds them despite instructions
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (parseErr) {
    console.error('[parse-task] JSON parse failed:', parseErr.message, '| Raw text:', rawText)
    return res.status(500).json({ error: 'Failed to parse Claude response as JSON', raw: rawText })
  }

  const result = {
    title: typeof parsed.title === 'string' && parsed.title ? parsed.title : transcript,
    due_date: typeof parsed.due_date === 'string' ? parsed.due_date : null,
    due_time: typeof parsed.due_time === 'string' ? parsed.due_time : null,
    consequence_level: ['external', 'self'].includes(parsed.consequence_level) ? parsed.consequence_level : 'self',
    notes: typeof parsed.notes === 'string' ? parsed.notes : null,
    recurrence: ['none', 'daily', 'weekly'].includes(parsed.recurrence) ? parsed.recurrence : 'none',
  }

  console.log('[parse-task] Normalized result:', JSON.stringify(result))
  return res.status(200).json(result)
}
