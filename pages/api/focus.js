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

const PROMPTS = {
  stuck: (task, dur) => `The user finished a ${dur}-min session on "${task}" and got stuck. Give one specific unblocking question or action. Under 2 sentences. No fluff.`,
  complete: (task, dur) => `The user completed a ${dur}-min session and finished "${task}". One genuine sentence of acknowledgment + a quick prompt for their next move.`,
  progress: (task, dur) => `The user made progress on "${task}" in ${dur} min but didn't finish. Short encouragement + one concrete next step. Under 2 sentences.`,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, outcome, taskTitle, focusDuration } = req.body
  if (!userId || !outcome) return res.status(400).json({ error: 'userId and outcome required' })

  const supabaseAdmin = getAdminClient()
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single()

  const systemPrompt = profile ? buildPersonaPrompt(profile) : ''
  const userPrompt = (PROMPTS[outcome] || PROMPTS.stuck)(taskTitle || 'a task', focusDuration || 25)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const message = response.content.find(b => b.type === 'text')?.text ?? "What felt hardest about that?"
    return res.status(200).json({ message })
  } catch (err) {
    console.error('[focus] error:', err.message)
    return res.status(200).json({ message: "What felt hardest about starting that?" })
  }
}
