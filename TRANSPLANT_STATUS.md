# Cinis — Transplant Status
*Created: S26 · March 25, 2026 · Update after every tab transplant or QC pass*
*Purpose: Single source of truth for which tabs are split / transplanted / QC confirmed*

## Status Key
- ⬜ NOT STARTED — raw extracted code from split, no mockup transplant
- 🔄 IN PROGRESS — terminal actively working
- ✅ TRANSPLANTED — mockup copied in, data wired, build passes
- 🔍 QC PENDING — transplanted, awaiting Solver 3 visual confirmation
- ✅✅ CONFIRMED — Solver 3 verified, matches mockup, ready for launch

## Tab Status

| Tab | File | Split | Transplanted | QC Confirmed | Notes |
|-----|------|-------|--------------|--------------|-------|
| Tasks | TabTasks.js | ✅ | ⬜ | ⬜ | Highest priority — home screen |
| Check-in | TabCheckin.js | ✅ | ⬜ | ⬜ | |
| Focus | TabFocus.js | ✅ | ⬜ | ⬜ | |
| Calendar | TabCalendar.js | ✅ | ⬜ | ⬜ | |
| Habits | TabHabits.js | ✅ | ⬜ | ⬜ | Includes Journal card |
| Tag Team | TabTagTeam.js | ✅ | ⬜ | ⬜ | Placeholder at launch |
| Nutrition | TabNutrition.js | ✅ | ⬜ | ⬜ | Macro ring labels + water dots bugs |
| Finance | TabFinance.js | ✅ | ⬜ | ⬜ | Bills tab working |
| Progress | TabProgress.js | ✅ | ⬜ | ⬜ | Monthly/weekly decoupled S26 |
| Guide | TabGuide.js | ✅ | ⬜ | ⬜ | |
| Settings | TabSettings.js | ✅ | ⬜ | ⬜ | Push notif toggle not wired |

## Dashboard Shell

| Item | Status | Notes |
|------|--------|-------|
| pages/dashboard.js split | ✅ | 7,242 → 326 lines S26 |
| components/tabs/ created | ✅ | 11 files + shared.js S26 |
| components/tabs/shared.js | ✅ | 406 lines S26 |
| Voice FAB in dashboard.js | ✅ | Built S22, verified |
| Morning greeting in dashboard.js | ✅ | Built S22, verified |

## Terminal Ownership for Transplants

| Terminal | Owns |
|----------|------|
| T1 (Sonnet) | TabNutrition, TabFinance, TabProgress, TabGuide |
| T4 (Haiku) | TabTasks, TabCheckin, TabFocus, TabCalendar, TabHabits |

## Mockup Source Files

| Tab | Mockup File |
|-----|-------------|
| Tasks, Checkin, Focus, Calendar, Habits, Progress, Guide, Settings | CinisMaster__2_.jsx |
| Focus (active session) | CinisFocusTab__2_.jsx |
| Habits (detailed) | CinisHabitsTab.jsx |
| Progress (detailed) | CinisProgressTab.jsx |
| Guide (detailed) | CinisGuideTab.jsx |
| Finance | CinisFinanceTab__2_.jsx |
| Nutrition | CinisNutritionTab__2_.jsx |

*Update this file at the end of every terminal pass. Never mark Confirmed without Solver 3.*
