import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildPersonaPrompt } from '../../lib/persona'
import { checkDailyRateLimit, rateLimitErrorResponse } from '../../lib/rateLimit'
import withAuth from '../../lib/authGuard'
import { sanitizeContent } from '../../lib/sanitize'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const CLOSING_PHRASES = ['see you', 'glad it landed', 'take care', 'good luck', 'until next time']

function parseExtractedTasks(text) {
  const tasks = []
  const regex = /\[TASK:\s*(.+?)\]/g
  let match
  while ((match = regex.exec(text)) !== null) {
    tasks.push({ title: match[1].trim(), task_type: 'task' })
  }
  return tasks
}

function isConversationEnd(text) {
  const lower = text.toLowerCase()
  return CLOSING_PHRASES.some(phrase => lower.includes(phrase))
}

function isJournalReminder(title) {
  const lower = title.toLowerCase()
  return lower.includes('journal') &&
    (lower.includes('remind') || lower.includes('reminder') || lower.includes('write') || lower.includes('entry'))
}

function isDailyReminder(title) {
  const lower = title.toLowerCase()
  return lower.includes('daily') || lower.includes('tomorrow') || lower.includes('every day')
}

async function callHaiku(prompt) {
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
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    return data?.content?.[0]?.text?.trim() ?? null
  } catch {
    return null
  }
}

async function handler(req, res, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { content, conversationHistory } = req.body
  if (!content) return res.status(400).json({ error: 'content required' })

  if (content.length > 2000) {
    return res.status(400).json({ error: 'Message too long. Please keep messages under 2000 characters.' })
  }

  const rateCheck = await checkDailyRateLimit(userId)
  if (!rateCheck.allowed) {
    return res.status(429).json(rateLimitErrorResponse(rateCheck))
  }

  // FIX 2 — date normalization
  const timezone = req.body.timezone || 'America/Chicago'
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: timezone })

  const supabaseAdmin = getAdminClient()

  const [
    { data: profile, error: profileErr },
    // FIX 1 — fetch existing tasks for deduplication
    { data: existing }
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
    supabaseAdmin.from('tasks').select('title').eq('user_id', userId).eq('completed', false).eq('archived', false)
  ])

  if (profileErr || !profile) return res.status(404).json({ error: 'Profile not found' })

  const existingTitles = (existing || []).map(t => t.title)
  const dedupContext = existingTitles.length
    ? `\n\nUser's existing tasks: ${existingTitles.map(t => `"${t}"`).join(', ')}. Do NOT suggest adding a task if a very similar one already exists. If they mention something already on their list, acknowledge it's already there instead of offering to add it.`
    : ''

  const dateContext = `\n\nToday is ${todayStr}. Tomorrow is ${tomorrowStr}. When creating tasks: 'today' = ${todayStr} at noon, 'tomorrow' = ${tomorrowStr} at noon, 'this week' = no specific date.`

  const JOURNAL_MODE = `

You are in journal mode. The user is thinking out loud. Listen first. Reflect back one specific observation about what they said. Ask one good question. Keep it under 3 sentences total.

If they mention something that sounds like a task or action item, add it on its own line at the very end in exactly this format:
[TASK: task name here]

Only include a [TASK: ...] line if something genuinely actionable was mentioned. Do not invent tasks.${dedupContext}${dateContext}`

  const baselineContext = profile?.baseline_profile ? `USER COACHING PROFILE:\n${profile.baseline_profile}\n\n` : ''
  const systemPrompt = baselineContext + buildPersonaPrompt(profile) + JOURNAL_MODE

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
    const detectedTasks = parseExtractedTasks(aiText)
    const displayText = aiText.replace(/\[TASK:\s*.+?\]/g, '').trim()
    const sanitizedContent = sanitizeContent(content)

    // FIX 2 + FIX 3 — insert extracted tasks with date normalization and reminder scheduling
    for (const { title, task_type } of detectedTasks) {
      let scheduledFor = null

      if (isJournalReminder(title)) {
        // FIX 3 — journal reminder scheduling
        if (isDailyReminder(title)) {
          // daily reminder → tomorrow at noon
          const rawDate = new Date(tomorrowStr)
          rawDate.setHours(12, 0, 0, 0)
          scheduledFor = rawDate.toISOString()
        }
        // weekly → scheduledFor stays null, no due_time
      } else {
        // FIX 2 — default to today at noon
        const rawDate = new Date(todayStr)
        rawDate.setHours(12, 0, 0, 0)
        scheduledFor = rawDate.toISOString()
      }

      const { error: taskErr } = await supabaseAdmin
        .from('tasks')
        .insert({
          user_id: userId,
          title,
          task_type,
          scheduled_for: scheduledFor,
          completed: false,
          archived: false,
        })

      if (taskErr) {
        console.error('[journal] task insert error:', JSON.stringify(taskErr))
      }
    }

    // FIX 4 — auto-log full conversation on detected close
    if (isConversationEnd(displayText)) {
      const allMessages = [...messages, { role: 'assistant', content: displayText }]
      const conversationText = allMessages
        .map(m => `${m.role === 'user' ? 'User' : 'FocusBuddy'}: ${m.content}`)
        .join('\n\n')

      const summaryPrompt = `In one sentence describe what this journal conversation covered. If it seems personal or emotional (relationships, feelings, struggles), return exactly: 'Personal entry.' Otherwise describe the topic factually.\n\nConversation:\n${conversationText}`

      // fire-and-forget — don't block response
      callHaiku(summaryPrompt).then(aiSummary => {
        supabaseAdmin.from('journal_entries').insert({
          user_id: userId,
          content: sanitizeContent(conversationText),
          ai_response: displayText,
          ai_summary: aiSummary ?? 'Journal entry.',
          created_at: new Date().toISOString(),
        })
      })
    } else {
      // save individual turn
      supabaseAdmin.from('journal_entries').insert({
        user_id: userId,
        content: sanitizedContent,
        ai_response: displayText,
      })
    }

    return res.status(200).json({ message: displayText, detectedTasks })
  } catch (err) {
    console.error('[journal] error:', err.message)
    return res.status(500).json({ error: 'Failed to get response' })
  }
}

export default withAuth(handler)
