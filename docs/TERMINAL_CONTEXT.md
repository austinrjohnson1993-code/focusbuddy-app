# Cinis Terminal Context
Read this before every task.

## Brand
- Coal #211A14 — background
- Hot Pool #FF6644 — PRIMARY accent, all interactive elements
- Ember #E8321A — RESERVED: delete, overdue, urgent ONLY
- Ash #F0EAD6 — primary text
- Char #3E3228 — cards, inputs, surfaces
- Gold #FFB800 — Pro/subscription only
- Green #4CAF50 — completed/success only
- Body: Figtree. Numbers/wordmark: Sora.
- Wordmark: CINIS, Sora 600, 0.16em, uppercase
- Tagline: "Where start meets finished."
- NEVER: Cormorant Garamond, $9.99, "FocusBuddy"

## Layout
- paddingBottom: 80px on all scrollable content (Voice FAB clearance)
- Content padding: 12px 14px on all tabs
- Sidebar: width 106px, padding 12px 8px
- Cards: background Char, border rgba(240,234,214,0.08), radius 12px
- Inputs: radius 8px, background Char

## DB Column Names (exact)
profiles: id, full_name, persona_blend (text[]), baseline_profile (text),
  rolling_memory_summary, subscription_status, ai_interactions_today,
  current_streak, longest_streak, total_xp, theme_id, push_subscription,
  push_notifications_enabled, morning_time, midday_time, evening_time,
  checkin_times (array), onboarding_complete, birthday

tasks: id, user_id, title, completed, archived, scheduled_for,
  completed_at, due_time, rollover_count, notes, sort_order,
  starred (boolean), task_type (text), estimated_minutes (integer)

bills: id, user_id, name, amount (numeric), due_day, frequency,
  category, autopay, notes, auto_task

journal_entries: id, user_id, content, ai_response, mood, created_at

progress_snapshots: id, user_id, snapshot_date, tasks_completed,
  tasks_added, tasks_rolled, focus_minutes, journal_entries, ai_summary

habits: id, user_id, name, frequency, habit_type ('build'/'break')
habit_completions: id, habit_id, user_id, completed_at

## Do Not Touch
- lib/memoryCompression.js
- lib/rateLimit.js
- pages/api/stripe/webhook.js
- lib/supabase.js auth config

## Auth Pattern
- Plain createClient from @supabase/supabase-js
- onAuthStateChange fires only on INITIAL_SESSION and SIGNED_IN
- No getSession(). No callback.js. No @supabase/ssr.
