import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const supabaseAdmin = getAdminClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: tasks, error } = await supabaseAdmin
    .from('tasks')
    .select('title, completed_at')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('completed_at', sevenDaysAgo.toISOString())

  if (error) {
    console.error('[weekly-summary] Tasks fetch error:', JSON.stringify(error))
    return res.status(500).json({ error: 'Failed to fetch tasks' })
  }

  const taskList = tasks?.length > 0
    ? tasks.map(t => `"${t.title}"`).join(', ')
    : 'no completed tasks'

  const prompt = `User completed these tasks this week: ${taskList}.

Write exactly 3 sentences: one specific win using a real task name, one pattern you noticed, one thing to focus on next week. Be direct. No filler.`

  console.log(`[weekly-summary] Generating for ${userId} — ${tasks?.length || 0} completed tasks`)

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
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('[weekly-summary] Anthropic API error:', response.status, errBody)
      return res.status(502).json({ error: 'Anthropic API error', status: response.status })
    }

    data = await response.json()
  } catch (err) {
    console.error('[weekly-summary] Fetch to Anthropic failed:', err.message)
    return res.status(500).json({ error: 'Failed to reach Anthropic API', message: err.message })
  }

  const summary = data?.content?.[0]?.text?.trim() ?? ''
  console.log(`[weekly-summary] Done for ${userId}`)
  return res.status(200).json({ summary })
}
