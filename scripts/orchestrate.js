#!/usr/bin/env node
/**
 * orchestrate.js — Claude Code multi-terminal orchestration (macOS)
 *
 * Reads a JSON file of terminal prompts, spawns a `claude -p` subprocess
 * for each, opens a live VS Code terminal tab showing the output, and
 * reports a summary when all terminals complete.
 *
 * Usage:
 *   node scripts/orchestrate.js <prompts.json> [--watch]
 *
 * Prompts JSON format:
 *   { "T1": "prompt text", "T2": "prompt text", ... }
 *
 * Completion signals (configurable via COMPLETION_SIGNALS below):
 *   "Report done", "pushed to origin/main"
 *
 * Requires: claude CLI in PATH, macOS, VS Code
 */

'use strict'

const { execSync, spawn } = require('child_process')
const fs   = require('fs')
const path = require('path')
const os   = require('os')

// ─── Config ──────────────────────────────────────────────────────────────────

const COMPLETION_SIGNALS = [
  'Report done',
  'pushed to origin/main',
]

const LAUNCH_STAGGER_MS = 1500   // delay between opening each VS Code tab
const TMP_DIR = path.join(os.tmpdir(), 'cinis-orchestrate')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function log(msg) {
  console.log(`[${ts()}] ${msg}`)
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function runAppleScript(script) {
  try {
    return execSync(`osascript << 'APPLESCRIPT'\n${script}\nAPPLESCRIPT`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

// ─── Locate claude CLI ────────────────────────────────────────────────────────

function findClaudeCLI() {
  // Check PATH first
  try {
    execSync('which claude', { stdio: 'ignore' })
    return 'claude'
  } catch {}

  // Common install locations
  const candidates = [
    path.join(os.homedir(), '.claude', 'local', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }

  return null
}

// ─── AppleScript: open a VS Code terminal tab tailing a log file ─────────────
//
// Opens a new integrated terminal tab in VS Code and runs:
//   printf '\033]0;T1\007' && tail -f /tmp/cinis-orchestrate/T1.log
//
// The printf sets the terminal tab title to the terminal ID.
// The user sees live output as claude writes to the log file.

function openVSCodeTab(termId, logFile) {
  // Escape for AppleScript string embedding
  const safeLog = logFile.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const safeId  = termId.replace(/"/g, '')

  const script = `
tell application "Code"
  activate
end tell
delay 0.5
tell application "System Events"
  tell process "Code"
    keystroke "\`" using {control down, shift down}
    delay 0.8
    keystroke "printf '\\\\033]0;${safeId}\\\\007' && tail -f \\"${safeLog}\\""
    key code 36
  end tell
end tell
`
  const result = runAppleScript(script)
  if (result === null) {
    log(`  ⚠  AppleScript failed for ${termId} — output will still be logged to ${logFile}`)
  }
}

// ─── Run a single terminal: spawn claude, pipe to log, detect completion ──────

function runTerminal(claudeCmd, termId, prompt, logFile) {
  return new Promise((resolve) => {
    const logStream = fs.createWriteStream(logFile, { flags: 'a' })
    logStream.write(`── ${termId} started at ${new Date().toISOString()} ──\n`)

    const child = spawn(claudeCmd, ['-p', prompt, '--no-color'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let completionSignal = null
    let done = false

    const onChunk = (chunk) => {
      const text = chunk.toString()
      logStream.write(text)

      // Stream prefixed output to orchestrator console
      text.split('\n').forEach(line => {
        if (line.trim()) process.stdout.write(`\x1b[2m[${termId}]\x1b[0m ${line}\n`)
      })

      // Check for completion signal
      if (!completionSignal) {
        const found = COMPLETION_SIGNALS.find(s => text.includes(s))
        if (found) {
          completionSignal = found
          log(`\x1b[32m✓ ${termId}\x1b[0m — "${found}"`)
        }
      }
    }

    child.stdout.on('data', onChunk)
    child.stderr.on('data', onChunk)

    child.on('close', (code) => {
      if (done) return
      done = true

      logStream.write(`── ${termId} exited (code ${code}) ──\n`)
      logStream.end()

      // Final scan in case signal arrived in last buffered chunk
      const fullLog = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : ''
      const finalSignal = completionSignal || COMPLETION_SIGNALS.find(s => fullLog.includes(s))

      resolve({
        termId,
        completed : !!finalSignal,
        signal    : finalSignal || null,
        exitCode  : code,
        logFile,
        error     : (!finalSignal && code !== 0) ? `exited with code ${code}` : null,
      })
    })

    child.on('error', (err) => {
      if (done) return
      done = true
      logStream.write(`── ${termId} error: ${err.message} ──\n`)
      logStream.end()
      resolve({
        termId,
        completed : false,
        signal    : null,
        exitCode  : null,
        logFile,
        error     : err.message,
      })
    })
  })
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function printSummary(results) {
  const line = '─'.repeat(58)
  console.log(`\n${line}`)
  console.log('  ORCHESTRATION SUMMARY')
  console.log(line)

  for (const r of results) {
    const icon   = r.completed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
    const detail = r.signal || r.error || 'no completion signal detected'
    console.log(`  ${icon}  ${r.termId.padEnd(5)} ${detail}`)
  }

  console.log(line)
  const n = results.filter(r => r.completed).length
  console.log(`  ${n}/${results.length} terminals completed`)
  console.log(`${line}\n`)
  console.log('  Log files:')
  results.forEach(r => console.log(`    ${r.termId}: ${r.logFile}`))
  console.log()
}

// ─── Core orchestration run ───────────────────────────────────────────────────

async function run(promptsFile, claudeCmd) {
  let prompts
  try {
    prompts = JSON.parse(fs.readFileSync(promptsFile, 'utf8'))
  } catch (e) {
    console.error(`Error reading ${promptsFile}: ${e.message}`)
    return
  }

  const termIds = Object.keys(prompts)
  if (termIds.length === 0) {
    console.error('No terminals found in prompts JSON.')
    return
  }

  log(`Launching ${termIds.length} terminal(s): ${termIds.join(', ')}`)
  ensureDir(TMP_DIR)

  // Prepare log and prompt temp files
  const tasks = termIds.map(termId => {
    const logFile    = path.join(TMP_DIR, `${termId}.log`)
    const promptFile = path.join(TMP_DIR, `${termId}.prompt.txt`)
    fs.writeFileSync(logFile, '')   // clear previous run
    fs.writeFileSync(promptFile, prompts[termId])
    return { termId, logFile, promptFile, prompt: prompts[termId] }
  })

  // Open VS Code terminal tabs (staggered so VS Code doesn't drop keystrokes)
  log('Opening VS Code terminal tabs...')
  for (let i = 0; i < tasks.length; i++) {
    const { termId, logFile } = tasks[i]
    log(`  → opening tab for ${termId}`)
    openVSCodeTab(termId, logFile)
    if (i < tasks.length - 1) await sleep(LAUNCH_STAGGER_MS)
  }

  // Spawn all claude processes concurrently
  log('Spawning claude processes...\n')
  const settled = await Promise.allSettled(
    tasks.map(({ termId, prompt, logFile }) =>
      runTerminal(claudeCmd, termId, prompt, logFile)
    )
  )

  const results = settled.map(s =>
    s.status === 'fulfilled'
      ? s.value
      : { termId: '?', completed: false, signal: null, error: s.reason?.message, logFile: '' }
  )

  printSummary(results)
}

// ─── Watch mode ──────────────────────────────────────────────────────────────

function watchFile(filePath, cb) {
  let lastMtime = fs.statSync(filePath).mtimeMs
  setInterval(() => {
    try {
      const mtime = fs.statSync(filePath).mtimeMs
      if (mtime !== lastMtime) {
        lastMtime = mtime
        cb()
      }
    } catch {}
  }, 2000)
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  const args        = process.argv.slice(2)
  const watch       = args.includes('--watch')
  const promptsFile = args.find(a => !a.startsWith('--'))

  if (!promptsFile) {
    console.error([
      '',
      'Usage: node scripts/orchestrate.js <prompts.json> [--watch]',
      '',
      'Example:',
      '  node scripts/orchestrate.js scripts/prompts/example.json',
      '  node scripts/orchestrate.js scripts/prompts/session.json --watch',
      '',
    ].join('\n'))
    process.exit(1)
  }

  if (!fs.existsSync(promptsFile)) {
    console.error(`Error: ${promptsFile} not found`)
    process.exit(1)
  }

  const claudeCmd = findClaudeCLI()
  if (!claudeCmd) {
    console.error([
      'Error: claude CLI not found.',
      'Install it: https://claude.ai/code',
      'Or ensure it is in your PATH.',
    ].join('\n'))
    process.exit(1)
  }

  log(`claude CLI: ${claudeCmd}`)
  log(`prompts:    ${path.resolve(promptsFile)}`)
  log(`log dir:    ${TMP_DIR}`)
  if (watch) log('--watch enabled: will re-run when prompts file changes')
  console.log()

  await run(promptsFile, claudeCmd)

  if (watch) {
    log('Watching for changes to prompts file...')
    watchFile(promptsFile, async () => {
      log('Prompts file changed — re-running...\n')
      await run(promptsFile, claudeCmd)
      log('Watching for changes to prompts file...')
    })
    // Keep alive
    process.stdin.resume()
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
