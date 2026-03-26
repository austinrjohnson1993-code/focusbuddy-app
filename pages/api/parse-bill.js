import withAuth from '../../lib/authGuard'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { transcript } = req.body
  if (!transcript) return res.status(400).json({ error: 'No transcript' })

  const prompt = `You are parsing a spoken bill description into structured data.

User said: "${transcript}"

Return ONLY valid JSON, no other text:
{
  "name": "bill name, clear and concise",
  "amount": 0.00,
  "due_day": null,
  "frequency": "monthly",
  "category": "other",
  "autopay": false,
  "is_variable": false,
  "account": null,
  "notes": null,
  "url": null,
  "remind_days": 3
}

Rules:
- frequency must be one of: monthly, weekly, yearly, quarterly, one-time
- category must be one of: housing, utilities, subscriptions, insurance, debt, medical, transport, food, other
- autopay = true if user says "autopay", "automatic", or "auto"
- is_variable = true if user says "varies", "variable", "around", or "approximately"
- due_day = day of month as integer (1-31), or null if not mentioned
- amount = numeric value only, no currency symbols; null if not mentioned
- account = bank or card name if mentioned, otherwise null
- remind_days = days before due_day to remind; default 3 unless user specifies`


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
      console.error('[parse-bill] Anthropic API error status:', response.status, errBody)
      return res.status(502).json({ error: 'Anthropic API error', status: response.status })
    }

    data = await response.json()
  } catch (err) {
    console.error('[parse-bill] Fetch to Anthropic failed:', err.message)
    return res.status(500).json({ error: 'Failed to reach Anthropic API', message: err.message })
  }

  const rawText = data?.content?.[0]?.text?.trim() ?? ''

  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (parseErr) {
    console.error('[parse-bill] JSON parse failed:', parseErr.message, '| Raw text:', rawText)
    return res.status(500).json({ error: 'Failed to parse Claude response as JSON', raw: rawText })
  }

  const FREQUENCIES = ['monthly', 'weekly', 'yearly', 'quarterly', 'one-time']
  const CATEGORIES = ['housing', 'utilities', 'subscriptions', 'insurance', 'debt', 'medical', 'transport', 'food', 'other']

  const result = {
    name: typeof parsed.name === 'string' && parsed.name ? parsed.name : transcript,
    amount: typeof parsed.amount === 'number' ? parsed.amount : null,
    due_day: typeof parsed.due_day === 'number' ? parsed.due_day : null,
    frequency: FREQUENCIES.includes(parsed.frequency) ? parsed.frequency : 'monthly',
    category: CATEGORIES.includes(parsed.category) ? parsed.category : 'other',
    autopay: parsed.autopay === true,
    is_variable: parsed.is_variable === true,
    account: typeof parsed.account === 'string' ? parsed.account : null,
    notes: typeof parsed.notes === 'string' ? parsed.notes : null,
    url: typeof parsed.url === 'string' ? parsed.url : null,
    remind_days: typeof parsed.remind_days === 'number' ? parsed.remind_days : 3,
  }

  return res.status(200).json(result)
}

export default withAuth(handler)
