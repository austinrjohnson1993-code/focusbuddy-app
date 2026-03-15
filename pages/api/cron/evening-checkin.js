import { runRollover } from '../rollover-tasks'

// Called nightly at 8PM by Vercel cron (see vercel.json)
// The AI conversation part of the check-in will be added in the next sprint
export default async function handler(req, res) {
  try {
    const result = await runRollover()
    console.log(`[evening-checkin] Rollover complete — ${result.rolled} tasks moved to tomorrow`)
    if (result.rolled > 0) {
      console.log('[evening-checkin] Tasks rolled:', result.tasks)
    }
    return res.status(200).json({ success: true, rolled: result.rolled })
  } catch (err) {
    console.error('[evening-checkin] Error:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
}
