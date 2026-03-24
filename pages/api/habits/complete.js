import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, habitId, date } = req.body
  if (!userId || !habitId) return res.status(400).json({ error: 'userId and habitId required' })

  // date should be 'YYYY-MM-DD', defaults to today
  const targetDate = date || new Date().toISOString().split('T')[0]

  const supabaseAdmin = getAdminClient()

  // Check if a completion exists for this habit on this date
  const dayStart = new Date(targetDate + 'T00:00:00.000Z').toISOString()
  const dayEnd = new Date(targetDate + 'T23:59:59.999Z').toISOString()

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('habit_completions')
    .select('id')
    .eq('habit_id', habitId)
    .eq('user_id', userId)
    .gte('completed_at', dayStart)
    .lte('completed_at', dayEnd)
    .limit(1)

  if (fetchError) {
    console.error('[habits/complete:POST] fetch error:', JSON.stringify(fetchError))
    return res.status(500).json({ error: 'Failed to check completion' })
  }

  if (existing && existing.length > 0) {
    // Toggle off — delete the existing completion
    const { error: deleteError } = await supabaseAdmin
      .from('habit_completions')
      .delete()
      .eq('id', existing[0].id)

    if (deleteError) {
      console.error('[habits/complete:POST] delete error:', JSON.stringify(deleteError))
      return res.status(500).json({ error: 'Failed to remove completion' })
    }

    return res.status(200).json({ completed: false })
  } else {
    // Toggle on — insert new completion at noon UTC of the given date
    const completedAt = new Date(targetDate + 'T12:00:00.000Z').toISOString()

    const { data: completion, error: insertError } = await supabaseAdmin
      .from('habit_completions')
      .insert({
        habit_id: habitId,
        user_id: userId,
        completed_at: completedAt,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[habits/complete:POST] insert error:', JSON.stringify(insertError))
      return res.status(500).json({ error: 'Failed to save completion' })
    }

    return res.status(201).json({ completed: true, completion })
  }
}
