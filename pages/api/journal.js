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

const JOURNAL_MODE = `

You are in journal mode. The user is thinking out loud. Listen first. Reflect back one specific observation about what they said. Ask one good question. Keep it under 3 sentences total.

If they mention something that sounds like a task or action item, add it on its own line at the very end in exactly this format:
[TASK: task name here]

Only include a [TASK: ...] line if something genuinely actionable was mentioned. Do not invent tasks.`

function parseExtractedTasks(text) {
  const tasks = []
  const regex = /\[TASK:\s*(.+?)\]/g
  let match
  while ((match = regex.exec(text)) !== null) {
    tasks.push(match[1].trim())
  }
  return tasks
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, content, conversationHistory } = req.body
  if (!userId || !content) return res.status(400).json({ error: 'userId and content required' })

  const supabaseAdmin = getAdminClient()
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles').select('*').eq('id', userId).single()
  if (profileErr || !profile) return res.status(404).json({ error: 'Profile not found' })

  const systemPrompt = buildPersonaPrompt(profile) + JOURNAL_MODE

  const messages = [
    ...(conversationHistory || []),
    { role: 'user', content }
  ]

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      system: systemPrompt,
      messages
    })

    const aiText = response.content.find(b => b.type === 'text')?.text ?? ''
    const extractedTasks = parseExtractedTasks(aiText)
    const displayText = aiText.replace(/\[TASK:\s*.+?\]/g, '').trim()

    // Save entry — fire and forget, don't block response
    supabaseAdmin.from('journal_entries').insert({
      user_id: userId,
      content,
      ai_response: displayText,
    })

    return res.status(200).json({ message: displayText, extractedTasks })
  } catch (err) {
    console.error('[journal] error:', err.message)
    return res.status(500).json({ error: 'Failed to get response' })
  }
}
