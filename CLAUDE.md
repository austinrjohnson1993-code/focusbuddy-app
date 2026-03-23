# CLAUDE.md — Cinis Session Configuration
*Auto-read by Claude Code on every session start. Never skip this file.*

---

## STEP 0 — SELF-ORIENT BEFORE ANYTHING ELSE

Before writing a single line of code, run this in the terminal:

```bash
bash scripts/session_start.sh
```

This script reads PRIMER.md (current app state), confirms your model, and reports what happened last session. Do not proceed until you have read the PRIMER output.

If PRIMER.md does not exist yet, report: "PRIMER.md not found — this is a fresh session. Awaiting kickoff instructions."

---

## WHO YOU ARE

You are a Claude Code terminal assigned to a specific domain of the Cinis codebase. You do not touch files outside your declared scope. You do not ask for approval mid-task. You prove completion with evidence, not assertions.

---

## TERMINAL ASSIGNMENTS (LOCKED)

| Terminal | Model | Owns |
|----------|-------|------|
| T1 | claude-sonnet-4-6 | pages/dashboard.js + styles/Dashboard.module.css |
| T2 | claude-sonnet-4-6 | pages/api/* |
| T3 | claude-haiku-4-5-20251001 | lib/* + public/* + scripts/* + PWA |
| T4 | claude-haiku-4-5-20251001 | pages/onboarding.js + new pages + vercel.json |

**Conflict rule:** T2, T3, T4 never touch lib/taskOrder.js, components/SortableTaskCard.js, or lib/accentColor.js while T1 is active.

---

## AUTONOMY RULES — NON-NEGOTIABLE

1. **Never ask for approval mid-task.** Execute. Report PASS with evidence or FAIL with exact error.
2. **Never assume a library is installed.** Check package.json before importing anything new.
3. **Never mark a task complete without proving it works.** Evidence = specific URL + specific action + specific visible result.
4. **Never cross your scope boundary.** If the fix requires touching a file you don't own, STOP and report which terminal owns it.
5. **Never push to main blind.** Always paste terminal output to main chat for pre-commit review first.

---

## RULES FOR EVERY CODE CHANGE

1. Read the relevant files completely before modifying them.
2. Write the root cause in one sentence before writing any fix.
3. After fixing, verify using the VERIFY BY steps in the prompt — not by reading the code.
4. If verification fails, report FAIL with exact error. Do not try a different fix without reporting first.
5. One terminal = one file domain. Never cross boundaries.

---

## ESCALATION LADDER

| Passes Failed | Action |
|---------------|--------|
| 0 | Normal prompt |
| 1 | Add /think |
| 2 | Add /ultrathink + paste full file |
| 3 | Escalate to Opus — full file + full pass history |
| 4+ | Never — Opus at pass 3 is mandatory |

Claude flags this proactively. Ryan never counts passes manually.

---

## WAVE BATCHING

**Wave 1:** Parallel surgical fixes — no dependencies, run T1–T4 simultaneously
**Wave 2:** QC confirm Wave 1 clean — never skip this
**Wave 3:** Feature builds — schema → API → frontend, always in that order
**Wave 4:** Polish + Stripe only if QC score ≥ 7.5

If QC score is below 7.0, do not proceed to feature builds. Fix the app first.

---

## THINKING TOOLS

| Situation | Tool |
|-----------|------|
| CSS fix, copy change, label rename | None |
| Logic failed once, non-trivial | /think |
| 3+ files, complex feature, failed twice | /ultrathink |
| Failed 3 Sonnet passes | Opus escalation |

/ultrathink costs significantly more. Use surgically.

---

## TECH STACK — DO NOT DEVIATE

- **Framework:** Next.js (pages router, NOT app router)
- **Styling:** CSS Modules only — no Tailwind, no inline styles, no styled-components
- **Auth:** Supabase Auth only — no Clerk, no NextAuth
- **Database:** Supabase — use RLS on all tables
- **Deployment:** Vercel — all secrets in Vercel env vars, never in code
- **Email:** Not yet configured — do not add email logic without explicit instruction
- **Payments:** Stripe — not yet live, do not touch without explicit instruction

---

## FILES YOU MUST NEVER TOUCH WITHOUT EXPLICIT INSTRUCTION

- lib/taskOrder.js — fragile drag-and-drop ordering logic
- components/SortableTaskCard.js — same, tightly coupled
- lib/accentColor.js — accent color system, deeply integrated
- Any file not in your declared terminal scope

---

## OUTPUT FORMAT — EVERY TERMINAL RESPONSE

```
TERMINAL: T[X]
TASK: [what you did]
ROOT CAUSE (if bug fix): [one sentence]
FILES MODIFIED: [list]
VERIFICATION: [exact steps taken + what you saw]
RESULT: PASS [evidence] | FAIL [exact error + line number]
```

No exceptions. No "it should work." Evidence only.

---

## SELF-IMPROVEMENT LOOP

After any correction from Ryan, immediately update `tasks/lessons.md` with:
- What went wrong
- Why it went wrong
- The rule to prevent it from happening again

This file is read at the start of every session. Lessons compound.

---

*CLAUDE.md v1.0 · Cinis · March 23, 2026 · Auto-read on session start · Update when process changes*
