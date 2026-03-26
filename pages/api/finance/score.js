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
    { data: bills },
    { data: profile },
    { data: weekSpend },
  ] = await Promise.all([
    supabaseAdmin.from('bills').select('id, autopay').eq('user_id', userId),
    supabaseAdmin.from('profiles')
      .select('budget_plan, income_sources, financial_goals')
      .eq('id', userId)
      .single(),
    supabaseAdmin.from('spend_log')
      .select('id, impulse')
      .eq('user_id', userId)
      .gte('logged_at', sevenDaysAgo.toISOString()),
  ])

  const billList = bills || []
  const spendEntries = weekSpend || []

  // ── Autopay coverage (0–15) ───────────────────────────────────────────────
  let autopay = 0
  if (billList.length > 0) {
    const autopayCount = billList.filter(b => b.autopay).length
    autopay = Math.min(15, Math.round((autopayCount / billList.length) * 15))
  }

  // ── Budget set up (0 or 12) ───────────────────────────────────────────────
  const budget = profile?.budget_plan ? 12 : 0

  // ── Spending tracked (0–15) — entries this week / 7 * 15 ─────────────────
  const spending = Math.min(15, Math.round((spendEntries.length / 7) * 15))

  // ── Emergency fund (0 or 15) ─────────────────────────────────────────────
  const financialGoals = profile?.financial_goals || []
  const hasEmergencyGoal = Array.isArray(financialGoals)
    ? financialGoals.some(g => String(g).toLowerCase().includes('emergency'))
    : String(financialGoals).toLowerCase().includes('emergency')
  const emergency = hasEmergencyGoal ? 15 : 0

  // ── Impulse control (0–13) — start at 13, minus 2 per impulse this week ──
  const impulseCount = spendEntries.filter(e => e.impulse).length
  const impulse = Math.max(0, 13 - impulseCount * 2)

  // ── Auto-save active (0 or 15) ────────────────────────────────────────────
  const incomeSources = profile?.income_sources || []
  const hasAutoSave = Array.isArray(incomeSources)
    ? incomeSources.some(s => String(s?.type || s).toLowerCase().includes('auto_save') || String(s?.type || s).toLowerCase().includes('autosave'))
    : false
  const autosave = hasAutoSave ? 15 : 0

  // ── Needs under 50% — skip for now ───────────────────────────────────────
  const needs = 0

  const score = autopay + budget + spending + emergency + impulse + autosave + needs


  return res.status(200).json({
    score,
    breakdown: { autopay, budget, spending, emergency, impulse, autosave, needs },
  })
}

export default withAuth(handler)
