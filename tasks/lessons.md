# tasks/lessons.md — Cinis Session Lessons
*Auto-read by Claude Code at session start via session_start.sh*
*Updated after every correction. Lessons compound across sessions.*

---

## Formatting Rules

Each lesson follows this format:
```
## [DATE] — [what broke]
**What happened:** [one sentence]
**Root cause:** [one sentence]
**Rule going forward:** [what Claude must do differently]
```

---

## Active Lessons

## 2026-03-18 — OAuth redirect after domain rebrand
**What happened:** After moving to cinis.app, OAuth redirected to old domain.
**Root cause:** Supabase Site URL and Google Cloud redirect URIs were not updated after domain change.
**Rule going forward:** Any domain change requires immediate update to: Supabase Site URL + Google Cloud OAuth redirect URIs. Check both before marking rebrand complete.

## 2026-03-18 — Vercel build failing with syntax error on API files
**What happened:** First line of several API files had a stray `→ artifact` string after the rebrand.
**Root cause:** Rebrand prompt accidentally prepended artifact marker to file content.
**Rule going forward:** After any rebrand pass, check the first line of every API file before pushing. Never push API files without reading line 1.

## 2026-03-18 — Merge conflict on push after parallel terminal work
**What happened:** T3 and T4 pushed simultaneously and created merge conflict on main.
**Root cause:** Neither terminal ran git fetch before push.
**Rule going forward:** Before every push: run `git fetch origin && git rebase origin/main`. Non-negotiable.

---

*Add new lessons immediately after any correction. Never delete old lessons.*
