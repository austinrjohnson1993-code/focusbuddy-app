import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseAdmin = getAdminClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [
    { data: bills, error: billsErr },
    { data: profile, error: profileErr },
    { data: recentSpend, error: spendErr },
  ] = await Promise.all([
    supabaseAdmin.from('bills').select('*').eq('user_id', userId).order('name', { ascending: true }),
    supabaseAdmin.from('profiles').select('monthly_income, income_frequency, full_name').eq('id', userId).single(),
    supabaseAdmin.from('spend_log').select('*').eq('user_id', userId).gte('created_at', sevenDaysAgo.toISOString()).order('created_at', { ascending: false }),
  ])

  if (billsErr) console.error('[finance/summary] bills error:', JSON.stringify(billsErr))
  if (profileErr) console.error('[finance/summary] profile error:', JSON.stringify(profileErr))
  if (spendErr) console.error('[finance/summary] spend error:', JSON.stringify(spendErr))

  const billList = bills || []
  const spendList = recentSpend || []
  const monthlyIncome = parseFloat(profile?.monthly_income) || 0

  // Monthly bill totals by frequency — normalise to monthly
  const FREQ_TO_MONTHLY = {
    monthly: 1,
    weekly: 4.33,
    biweekly: 2.17,
    bimonthly: 0.5,
    quarterly: 1 / 3,
    yearly: 1 / 12,
    'one-time': 0,
  }

  const monthly_bills_total = billList.reduce((sum, b) => {
    const multiplier = FREQ_TO_MONTHLY[b.frequency] ?? 1
    return sum + (parseFloat(b.amount) || 0) * multiplier
  }, 0)

  // Daily number: (income - bills) / 30 — discretionary per day
  const daily_number = monthlyIncome > 0
    ? Math.max(0, (monthlyIncome - monthly_bills_total) / 30)
    : null

  // Spend summary: total last 7 days and by category
  const spend_7d_total = spendList.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

  const spend_by_category = spendList.reduce((acc, e) => {
    const cat = e.category || 'other'
    acc[cat] = (acc[cat] || 0) + (parseFloat(e.amount) || 0)
    return acc
  }, {})

  return res.status(200).json({
    bills: billList,
    monthly_bills_total: parseFloat(monthly_bills_total.toFixed(2)),
    monthly_income: monthlyIncome || null,
    daily_number: daily_number !== null ? parseFloat(daily_number.toFixed(2)) : null,
    recent_spend: spendList,
    spend_7d_total: parseFloat(spend_7d_total.toFixed(2)),
    spend_by_category,
  })
}

export default withAuth(handler)
