import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export default async function handler(req, res) {
  const supabaseAdmin = getAdminClient()

  // GET ?userId=xxx — fetch all active alarms for user, ordered by alarm_time
  if (req.method === 'GET') {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const { data: alarms, error } = await supabaseAdmin
      .from('alarms')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('alarm_time', { ascending: true })

    if (error) {
      console.error('[alarms:GET] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to fetch alarms' })
    }

    return res.status(200).json({ alarms })
  }

  // POST { userId, alarm_time, title, task_id } — create alarm
  if (req.method === 'POST') {
    const { userId, alarm_time, title, task_id } = req.body
    if (!userId || !alarm_time || !title) {
      return res.status(400).json({ error: 'userId, alarm_time, and title required' })
    }

    const { data: alarm, error } = await supabaseAdmin
      .from('alarms')
      .insert({
        user_id: userId,
        alarm_time,
        title,
        task_id: task_id || null,
        active: true,
        triggered: false,
      })
      .select()
      .single()

    if (error) {
      console.error('[alarms:POST] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to create alarm' })
    }

    return res.status(201).json({ alarm })
  }

  // PATCH { id, triggered: true } — mark alarm as triggered
  if (req.method === 'PATCH') {
    const { id, triggered } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    const updates = {}
    if (triggered === true) {
      updates.triggered = true
      updates.active = false
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data: alarm, error } = await supabaseAdmin
      .from('alarms')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[alarms:PATCH] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to update alarm' })
    }

    return res.status(200).json({ alarm })
  }

  // DELETE { id } — delete alarm
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    const { error } = await supabaseAdmin
      .from('alarms')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[alarms:DELETE] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to delete alarm' })
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
