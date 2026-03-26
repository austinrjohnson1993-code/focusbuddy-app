# Cinis — Active Todo
*Updated: March 25, 2026 · Session 26*

## 🔴 P1 Blockers
- Stripe Pro flip not verified end-to-end with real payment — root cause: live mode blocked on LLC — T2
- Push notification toggle in Settings not wired to UI — root cause: infrastructure built, no frontend connection — T1

## 🟡 P2 Queue
- Solver 3 QC results pending — add findings after this session
- session_start.sh path may need verification — T3
- VAPID_KEY + VAPID_PUBLIC_KEY duplicate env vars in Vercel — Ryan action: delete VAPID_KEY and VAPID_PUBLIC_KEY, keep NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
- OG meta image not updated on cinis.app — T1
- Favicon rounded mark — T1

## 🟢 Wave 3 Backlog
<!-- Features ready for ralph when Wave 1 is clean -->

## 🟣 P3 Polish
- LinkedIn "Open to work" badge still showing — Ryan action

## ✅ Recently Closed
- Dashboard split (7,242→326 lines)
- TabTasks transplant
- TabCheckin transplant
- TabFocus transplant
- TabCalendar transplant
- TabHabits transplant
- TabProgress transplant
- TabGuide transplant
- TabFinance transplant
- TabNutrition transplant
- Progress snapshot cron
- Monthly/weekly insight decoupled
- Signup confirmation email fixed
- Rounded logo in onboarding + upgrade
- Landing page logo swapped
- tasks/lessons.md created
- LAUNCH_CHECKLIST.md created
- TRANSPLANT_STATUS.md created
- session_start.sh startup hook created — .claude/settings.json live
- tasks/todo.md created and populated
- CLAUDE.md updated — T5/T6 added, context7, ralph, load confirmation
- context7 MCP installed
- Progress tab "Couldn't load your data" error fixed
- Nutrition active ring color corrected (Ember not Hot)
