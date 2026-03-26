import { createClient } from '@supabase/supabase-js'
import { coachingMessage } from '../../lib/anthropic'
import { withAuthGuard } from '../../lib/authGuard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const SYSTEM_PROMPT = `You are Cinis's financial coach. Be practical and specific. Reference their actual numbers. Suggest one actionable thing at a time. Never shame. Point them toward specific app features when relevant. Keep responses under 4 sentences.`

async function handler(req, res, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, conversationHistory = [] } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })

  const supabase = getAdminClient()

  // Fetch profile and bills in parallel
  const [{ data: profile }, { data: bills }] = await Promise.all([
    supabase.from('profiles').select('full_name, financial_goals').eq('id', userId).single(),
    supabase.from('bills').select('name, amount, frequency, category').eq('user_id', userId),
  ])

  // Build financial context
  const monthlyBills = (bills || []).filter(b => b.frequency === 'monthly')
  const totalMonthly = monthlyBills.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0)
  const billList = monthlyBills.map(b => `${b.name} ($${parseFloat(b.amount).toFixed(0)}/mo)`).join(', ')
  const goals = Array.isArray(profile?.financial_goals) && profile.financial_goals.length
    ? profile.financial_goals.join(', ')
    : 'not specified'

  const context = `User has ${monthlyBills.length} monthly bills totaling $${totalMonthly.toFixed(0)}/month. Bills: ${billList || 'none entered yet'}. Financial goals: ${goals}.`

  const systemPromptWithContext = `${SYSTEM_PROMPT}\n\nContext: ${context}`

  // Build messages array: history + new user message
  const messages = [
    ...conversationHistory,
    { role: 'user', content: message },
  ]

  try {
    const reply = await coachingMessage(messages, systemPromptWithContext)
    return res.status(200).json({ message: reply })
  } catch (err) {
    console.error('[finance-chat] error:', err)
    return res.status(500).json({ error: 'Failed to generate response' })
  }
}

export default withAuthGuard(handler)
