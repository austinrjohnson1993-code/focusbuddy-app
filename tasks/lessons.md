# Cinis — Lessons Learned
*Auto-read by Claude Code at session start via CLAUDE.md*
*Updated: S26 · March 25, 2026*
*Rule: Any mistake made twice gets added here immediately. Never delete old lessons — they repeat.*

## Auth — Never Touch These
- lib/supabase.js uses plain createClient — localStorage sessions. DO NOT change.
- Auth pattern in dashboard.js: onAuthStateChange + hasSession ref guard ONLY.
- NEVER add getSession(). NEVER recreate pages/api/auth/callback.js. NEVER install @supabase/ssr.
- Google OAuth redirects directly to /dashboard — no server-side callback. Intentional.
- Before testing old accounts: DevTools → Application → Storage → Clear site data.
- pages/api/auth/callback.js was deleted in S24. Do not recreate it. Ever.

## Files That Must Never Be Modified
- lib/memoryCompression.js — Haiku rolling memory. Hands off.
- lib/rateLimit.js — Rate limiting. Modifying breaks free/pro enforcement.
- pages/api/stripe/webhook.js — bodyParser: false required. Every attempt to improve this has broken it.
- lib/supabase.js — Auth config.
- onAuthStateChange pattern in dashboard.js — Do not refactor.

## Terminal Protocol
- One terminal = one file domain. Concurrent edits = merge conflicts.
- Always run git fetch origin && git rebase origin/main before pushing with multiple terminals active.
- Build passing ≠ feature working. Solver 3 visual confirmation required.
- Never mark complete without npm run build first.

## Launching Claude Code Correctly
- /model /compact /plugin /skills are Claude Code slash commands — NOT raw zsh.
- Launch first: cd ~/Documents/focusbuddy-app && claude --dangerously-skip-permissions
- Then run slash commands inside Claude Code.
- session_start.sh fires automatically via .claude/settings.json startup hook.

## Colors — One Source of Truth
Coal #211A14 · Char #3E3228 · Ash #F5F0E3 · Hot Pool #FF6644 (PRIMARY) · Ember #E8321A (URGENCY ONLY) · Gold #FFB800 · Green #4CAF50 · Blue #3B8BD4
Hot Pool is default for ALL interactive elements. Ember is ONLY for delete, overdue, urgent CTAs.

## Typography
Numbers/wordmark/timer: Sora · Everything else: Figtree · No other fonts.

## Layout Constants
Sidebar: 106px wide · Content padding: 12px 14px · paddingBottom: 80px (FAB clearance) · Card radius: 10px standard, 8px compact

## Transplant Rule
Mockup = spec. Terminal copies it wholesale. Does not interpret, approximate, or improve it.
Read mockup completely → replace section entirely → wire real data → build.

## Dashboard Split (completed S26)
- components/tabs/ has 11 tab files + shared.js
- Each tab receives { user, profile } as props
- No tab imports FROM dashboard.js (circular dependency)
- Voice FAB + morning greeting stay in dashboard.js only

## Supabase MCP
- execute_sql for SELECT/inspect · apply_migration for DDL with IF NOT EXISTS guards
- Always use supabaseAdmin (service role key) in API routes
- bills.amount must be numeric(10,2) — integer loses decimals
- progress_snapshots populated by daily cron — empty for new users is expected

## Progress Snapshots
- Monthly = calendar month window. Weekly = rolling 7 days. SEPARATE fetches, SEPARATE AI prompts.
- Cron: /api/cron/progress-snapshot.js runs daily at midnight UTC.

## Ralph
- Runs inside tmux. tail -f .ralph/logs/latest.log to watch.
- EXIT_SIGNAL must be in every PROMPT.md or ralph won't stop.
- T6 is UltraClaude/Ralph only. Never assign Cinis feature work to T6.
- ralph --reset-circuit if circuit breaker trips.

## context7 MCP
- Use for Next.js, Supabase, Stripe, Twilio docs before implementing anything.
- Kills hallucinated API methods.

## Known Recurring Mistakes
1. Slash commands in raw zsh — always launch claude first.
2. Patching symptoms — always find root cause before fixing.
3. Build pass ≠ visual correct — always Solver 3 after build.
4. Wrong color values — always reference the color table, never guess.
5. Circular imports — tab files must never import from dashboard.js.
6. Missing bodyParser:false — always check stripe/webhook.js after refactors near it.

*Update immediately when a new pattern is discovered. Never delete old lessons.*
