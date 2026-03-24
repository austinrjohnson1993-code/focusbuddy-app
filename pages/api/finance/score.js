import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Score weights — 4 components, 25 points each = 100 max
// autopay:  % of bills on autopay (0-25)
// budget:   income set + bills entered (0-25)
// tracking: spend_log used this week (0-25)
// activity: spending entered last 7 days — more entries = better awareness (0-25)

async function handler(req, res, userId) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseAdmin = getAdminClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [
    { data: bills },
    { data: profile },
    { data: recentSpend },
  ] = await Promise.all([
    supabaseAdmin.from('bills').select('id, autopay, amount, frequency').eq('user_id', userId),
    supabaseAdmin.from('profiles').select('monthly_income').eq('id', userId).single(),
    supabaseAdmin.from('spend_log').select('id').eq('user_id', userId).gte('created_at', sevenDaysAgo.toISOString()),
  ])

  const billList = bills || []
  const spendEntries = recentSpend || []
  const monthlyIncome = parseFloat(profile?.monthly_income) || 0

  // ── Autopay score (0-25) ───────────────────────────────────────────────────
  // Bills entered + % on autopay. No bills entered = 0. All on autopay = 25.
  let autopayScore = 0
  if (billList.length > 0) {
    const autopayCount = billList.filter(b => b.autopay).length
    const autopayRatio = autopayCount / billList.length
    autopayScore = Math.round(autopayRatio * 25)
  }

  // ── Budget score (0-25) ────────────────────────────────────────────────────
  // 15 pts for having income set, 10 pts for having at least 3 bills entered
  let budgetScore = 0
  if (monthlyIncome > 0) budgetScore += 15
  if (billList.length >= 3) budgetScore += 10
  budgetScore = Math.min(budgetScore, 25)

  // ── Tracking score (0-25) — spend_log entries this week ───────────────────
  // 0 entries = 0, 1-2 = 10, 3-5 = 18, 6+ = 25
  let trackingScore = 0
  if (spendEntries.length >= 6) trackingScore = 25
  else if (spendEntries.length >= 3) trackingScore = 18
  else if (spendEntries.length >= 1) trackingScore = 10

  // ── Activity score (0-25) — awareness bonus ───────────────────────────────
  // Did they log something in the last 7 days at all? Capped activity signal.
  // 0 = no, partial = occasional, 25 = tracked most days
  const uniqueDays = new Set(
    spendEntries.map(e => e.created_at?.slice(0, 10)).filter(Boolean)
  ).size
  let activityScore = 0
  if (uniqueDays >= 5) activityScore = 25
  else if (uniqueDays >= 3) activityScore = 18
  else if (uniqueDays >= 1) activityScore = 10

  const total_score = autopayScore + budgetScore + trackingScore + activityScore

  console.log(`[finance/score] userId:${userId} score:${total_score} autopay:${autopayScore} budget:${budgetScore} tracking:${trackingScore} activity:${activityScore}`)

  return res.status(200).json({
    total_score,
    breakdown: {
      autopay: autopayScore,
      budget: budgetScore,
      tracking: trackingScore,
      activity: activityScore,
    },
  })
}

export default withAuth(handler)
