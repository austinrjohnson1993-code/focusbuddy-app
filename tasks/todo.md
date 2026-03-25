# Cinis — Active Todo
*Updated: March 25, 2026 · Session 26*

## 🔴 P1 Blockers
- Dashboard split not in repo — components/tabs/ does not exist — T5 running now
- Stripe Pro flip not verified end-to-end with real payment — root cause: live mode blocked on LLC — T2
- Push notification toggle in Settings not wired to UI — root cause: infrastructure built, no frontend connection — T1

## 🟡 P2 Queue
- Nutrition macro ring labels faint — root cause: missing textTransform/letterSpacing on label elements — T1
- Nutrition water dots not rendering correctly — root cause: flexWrap issue on dot container — T1
- Signup confirmation email landing in spam — root cause: Resend sender domain unverified — Ryan action
- VAPID_KEY + VAPID_PUBLIC_KEY duplicate env vars in Vercel — root cause: dual VAPID setup — Ryan action: delete VAPID_KEY and VAPID_PUBLIC_KEY, keep NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
- CINIS_BUILD_ORDER_V2.md stale — shows S18/116hrs, actually S26/160hrs — Core action at session close

## 🟢 Wave 3 Backlog
<!-- Features ready for ralph when Wave 1 is clean -->

## 🟣 P3 Polish
- OG meta image not updated on cinis.app
- Favicon may not be rounded mark version
- LinkedIn "Open to work" badge still showing — Ryan action

## ✅ Recently Closed
- session_start.sh startup hook created — .claude/settings.json live
- tasks/todo.md created and populated
- CLAUDE.md updated — T5/T6 added, context7, ralph, load confirmation
- context7 MCP installed
