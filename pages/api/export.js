import { createClient } from '@supabase/supabase-js'
import withAuth from '../../lib/authGuard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function handler(req, res, userId) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const supabaseAdmin = getAdminClient()

    const [
      { data: tasks },
      { data: bills },
      { data: habits },
      { data: habit_completions },
      { data: journal_entries },
      { data: nutrition_entries },
      { data: progress_snapshots },
      { data: financial_goals },
      { data: alarms },
      { data: profileRows },
    ] = await Promise.all([
      supabaseAdmin.from('tasks').select('*').eq('user_id', userId),
      supabaseAdmin.from('bills').select('*').eq('user_id', userId),
      supabaseAdmin.from('habits').select('*').eq('user_id', userId),
      supabaseAdmin.from('habit_completions').select('*').eq('user_id', userId),
      supabaseAdmin.from('journal_entries').select('*').eq('user_id', userId),
      supabaseAdmin.from('nutrition_entries').select('*').eq('user_id', userId),
      supabaseAdmin.from('progress_snapshots').select('*').eq('user_id', userId),
      supabaseAdmin.from('financial_goals').select('*').eq('user_id', userId),
      supabaseAdmin.from('alarms').select('*').eq('user_id', userId),
      supabaseAdmin.from('profiles').select('*').eq('id', userId),
    ])

    const today = new Date().toISOString().split('T')[0]

    const exportObject = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      data: {
        profile: Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0] : null,
        tasks: tasks || [],
        bills: bills || [],
        habits: habits || [],
        habit_completions: habit_completions || [],
        journal_entries: journal_entries || [],
        nutrition_entries: nutrition_entries || [],
        progress_snapshots: progress_snapshots || [],
        financial_goals: financial_goals || [],
        alarms: alarms || [],
      },
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="cinis-export-${today}.json"`)
    return res.status(200).json(exportObject)
  } catch {
    return res.status(500).json({ error: 'Export failed' })
  }
}

export default withAuth(handler)
