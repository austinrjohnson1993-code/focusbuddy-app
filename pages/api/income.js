import { createClient } from '@supabase/supabase-js'

const VALID_FREQUENCIES = ['weekly', 'biweekly', 'bimonthly', 'monthly']

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export default async function handler(req, res) {
  // Authenticate via Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No auth token provided' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error('[income] Auth error:', JSON.stringify(authError))
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseAdmin = getAdminClient()

  // GET — fetch monthly_income and income_frequency from profile
  if (req.method === 'GET') {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('monthly_income, income_frequency')
      .eq('id', user.id)
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
      .eq('id', user.id)

    if (error) {
      console.error('[income:POST] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to update income' })
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
