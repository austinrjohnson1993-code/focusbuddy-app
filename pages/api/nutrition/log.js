import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'
import { sanitizeTitle, sanitizeNotes } from '../../../lib/sanitize'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'pre-workout', 'post-workout']

async function handler(req, res, userId) {
  const supabaseAdmin = getAdminClient()

  // ── GET — today's entries + totals + targets ───────────────────────────────
  if (req.method === 'GET') {
    const timezone = req.query.timezone || 'America/Chicago'
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
    const dayStart = new Date(`${todayStr}T00:00:00`)
    const dayEnd = new Date(`${todayStr}T23:59:59`)

    const [
      { data: entries, error: entriesErr },
      { data: profile, error: profileErr },
    ] = await Promise.all([
      supabaseAdmin
        .from('nutrition_log')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', dayStart.toISOString())
        .lte('logged_at', dayEnd.toISOString())
        .order('logged_at', { ascending: true }),
      supabaseAdmin
        .from('profiles')
        .select('calorie_target, protein_target, water_target')
        .eq('id', userId)
        .single(),
    ])

    if (entriesErr) {
      console.error('[nutrition/log:GET] entries error:', JSON.stringify(entriesErr))
      return res.status(500).json({ error: 'Failed to fetch nutrition log' })
    }
    if (profileErr) {
      console.error('[nutrition/log:GET] profile error:', JSON.stringify(profileErr))
    }

    const list = entries || []

    const totals = list.reduce(
      (acc, e) => ({
        calories: acc.calories + (e.calories || 0),
        protein:  acc.protein  + parseFloat(e.protein_g || 0),
        carbs:    acc.carbs    + parseFloat(e.carbs_g   || 0),
        fat:      acc.fat      + parseFloat(e.fat_g     || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )

    // Round to 1 decimal for macros
    totals.protein = Math.round(totals.protein * 10) / 10
    totals.carbs   = Math.round(totals.carbs   * 10) / 10
    totals.fat     = Math.round(totals.fat     * 10) / 10

    const targets = {
      calories: profile?.calorie_target ?? 2400,
      protein:  profile?.protein_target ?? 180,
      water:    profile?.water_target   ?? 10,
    }

    return res.status(200).json({ entries: list, totals, targets })
  }

  // ── POST — log a meal ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      meal_name,
      food_description,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      meal_type,
      logged_at,
    } = req.body

    if (!meal_name) return res.status(400).json({ error: 'meal_name required' })

    const cleanName = sanitizeTitle(meal_name)
    if (!cleanName) return res.status(400).json({ error: 'Invalid meal_name' })

    if (meal_type && !VALID_MEAL_TYPES.includes(meal_type)) {
      return res.status(400).json({ error: `meal_type must be one of: ${VALID_MEAL_TYPES.join(', ')}` })
    }

    const parsedCalories = parseInt(calories) || 0
    if (parsedCalories < 0) return res.status(400).json({ error: 'calories must be non-negative' })

    const { data: entry, error } = await supabaseAdmin
      .from('nutrition_log')
      .insert({
        user_id:          userId,
        meal_name:        cleanName,
        food_description: food_description ? sanitizeNotes(food_description) : null,
        calories:         parsedCalories,
        protein_g:        parseFloat(protein_g) || 0,
        carbs_g:          parseFloat(carbs_g)   || 0,
        fat_g:            parseFloat(fat_g)     || 0,
        meal_type:        meal_type || null,
        logged_at:        logged_at || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[nutrition/log:POST] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to log meal' })
    }

    console.log(`[nutrition/log:POST] logged "${cleanName}" ${parsedCalories}cal for ${userId}`)
    return res.status(200).json({ entry })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
