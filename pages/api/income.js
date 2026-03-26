import { createClient } from '@supabase/supabase-js'
import { withAuthGuard } from '../../lib/authGuard'

const VALID_FREQUENCIES = ['weekly', 'biweekly', 'bimonthly', 'monthly']

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  const supabaseAdmin = getAdminClient()

  // GET — fetch monthly_income and income_frequency from profile
  if (req.method === 'GET') {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('monthly_income, income_frequency')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[income:GET] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to fetch income' })
    }

    return res.status(200).json({
      monthly_income: profile.monthly_income,
      income_frequency: profile.income_frequency
    })
  }

  // POST { amount, frequency } — update income on profile
  if (req.method === 'POST') {
    const { amount, frequency } = req.body

    if (frequency && !VALID_FREQUENCIES.includes(frequency)) {
      return res.status(400).json({ error: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` })
    }

    const updates = {}
    if (amount !== undefined) updates.monthly_income = amount
    if (frequency !== undefined) updates.income_frequency = frequency

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'amount or frequency required' })
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) {
      console.error('[income:POST] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to update income' })
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuthGuard(handler)
