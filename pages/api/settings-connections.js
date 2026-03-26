// Stub — settings connections API
// Handles external service connection state for the Settings tab.
//
// QUEUED FOR TERMINAL 1 NEXT RUN:
//
// BUG-023: Add "Coming soon" badges to Google Calendar, Spotify, Apple Music,
//   Fitbit, Oura Ring Connect buttons in Settings tab (dashboard.js).
//   Change button text from "Connect" to "Coming soon".
//   Make them non-clickable: disabled attribute + opacity 0.5.
//
// BUG-024: If push notifications not enabled, disable/grey out Morning check-in
//   and Evening wrap-up toggles in Settings tab and show tooltip:
//   "Enable push notifications first"
//
// BUG-025: In persona edit modal (Settings tab), pre-select the user's current
//   persona_blend so they can see their active selection when the modal opens.

import { withAuthGuard } from '../../lib/authGuard'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  // TODO: return connected integration status per user
  return res.status(200).json({ connections: {} })
}

export default withAuthGuard(handler)
