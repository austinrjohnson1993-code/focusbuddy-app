#!/bin/bash
# session_start.sh — Cinis Self-Orientation Script
# Run at the start of every Claude Code session: bash scripts/session_start.sh
# Takes ~10 seconds. Replaces 5 minutes of manual setup.

echo ""
echo "═══════════════════════════════════════════════════"
echo "  CINIS SESSION START — $(date '+%B %d, %Y %H:%M')"
echo "═══════════════════════════════════════════════════"
echo ""

# ── 1. PRIMER STATE ──────────────────────────────────────
echo "▶ PRIMER STATE"
echo "───────────────────────────────────────────────────"
if [ -f "PRIMER.md" ]; then
  cat PRIMER.md
else
  echo "  ⚠️  PRIMER.md not found — fresh session or PRIMER not yet created."
  echo "  Awaiting session kickoff instructions from Ryan."
fi
echo ""

# ── 2. GIT STATUS ────────────────────────────────────────
echo "▶ GIT STATUS"
echo "───────────────────────────────────────────────────"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git log -1 --format="%h %s %ar" 2>/dev/null || echo "no commits found")
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo "  Branch:        $BRANCH"
echo "  Last commit:   $LAST_COMMIT"
echo "  Uncommitted:   $UNCOMMITTED file(s) with changes"

if [ "$UNCOMMITTED" -gt "0" ]; then
  echo ""
  echo "  ⚠️  UNCOMMITTED CHANGES:"
  git status --porcelain
fi
echo ""

# ── 3. LESSONS (if exists) ───────────────────────────────
echo "▶ LESSONS FROM PRIOR SESSIONS"
echo "───────────────────────────────────────────────────"
if [ -f "tasks/lessons.md" ]; then
  cat tasks/lessons.md
else
  echo "  No lessons.md yet — create tasks/lessons.md after first session."
fi
echo ""

# ── 4. PACKAGE CHECK ─────────────────────────────────────
echo "▶ KEY DEPENDENCIES"
echo "───────────────────────────────────────────────────"
if [ -f "package.json" ]; then
  echo "  next:        $(node -e "console.log(require('./package.json').dependencies?.next || 'not found')" 2>/dev/null)"
  echo "  react:       $(node -e "console.log(require('./package.json').dependencies?.react || 'not found')" 2>/dev/null)"
  echo "  supabase-js: $(node -e "console.log(require('./package.json').dependencies?.['@supabase/supabase-js'] || 'not found')" 2>/dev/null)"
  echo "  stripe:      $(node -e "console.log(require('./package.json').dependencies?.stripe || 'not found')" 2>/dev/null)"
else
  echo "  ⚠️  package.json not found — wrong directory?"
fi
echo ""

# ── 5. ENV CHECK ─────────────────────────────────────────
echo "▶ ENV VARS (presence check only — no values printed)"
echo "───────────────────────────────────────────────────"
VARS=("NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "OPENAI_API_KEY" "STRIPE_SECRET_KEY" "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
for VAR in "${VARS[@]}"; do
  if [ -n "${!VAR}" ]; then
    echo "  ✅  $VAR"
  else
    echo "  ❌  $VAR — not set"
  fi
done
echo ""

# ── 6. TODO (if exists) ──────────────────────────────────
echo "▶ CURRENT TODO"
echo "───────────────────────────────────────────────────"
if [ -f "tasks/todo.md" ]; then
  cat tasks/todo.md
else
  echo "  No todo.md yet — create tasks/todo.md before starting work."
fi
echo ""

# ── READY ────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════"
echo "  SESSION ORIENTED. Awaiting Wave 1 prompts."
echo "═══════════════════════════════════════════════════"
echo ""
