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

    const data = await response.json()
    const text = data.content[0].text.trim()
    const parsed = JSON.parse(text)
    res.status(200).json(parsed)
  } catch (err) {
    console.error('Parse task error:', err)
    res.status(500).json({ error: 'Failed to parse' })
  }
}
