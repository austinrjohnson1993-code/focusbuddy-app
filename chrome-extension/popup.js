// ── Config ────────────────────────────────────────────────────────────────────
const APP_BASE = 'https://focus-buddy.app'

// ── DOM helpers ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id)
const show = (el) => el.classList.remove('hidden')
const hide = (el) => el.classList.add('hidden')

// ── Storage helpers ───────────────────────────────────────────────────────────
async function getStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve))
}
async function setStorage(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve))
}
async function removeStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve))
}

// ── Supabase auth helpers ─────────────────────────────────────────────────────
async function getSupabaseConfig() {
  const res = await fetch(`${APP_BASE}/api/extension-config`)
  if (!res.ok) throw new Error('Could not reach FocusBuddy')
  return res.json()
}

async function signIn(email, password) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig()
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.message || 'Sign in failed')
  return data
}

async function refreshToken(refreshTokenStr) {
  const { supabaseUrl, supabaseAnonKey } = await getSupabaseConfig()
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ refresh_token: refreshTokenStr }),
  })
  if (!res.ok) return null
  return res.json()
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const { accessToken } = await getStorage(['accessToken'])
  const res = await fetch(`${APP_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(opts.headers || {}),
    },
  })
  return res
}

async function fetchTodayTasks() {
  const res = await apiFetch('/api/extension-tasks')
  if (!res.ok) return []
  return res.json()
}

async function parseTask(text) {
  const res = await apiFetch('/api/parse-task', {
    method: 'POST',
    body: JSON.stringify({ transcript: text }),
  })
  if (!res.ok) return null
  return res.json()
}

async function createTask(taskData) {
  const res = await apiFetch('/api/extension-tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  })
  if (!res.ok) return null
  return res.json()
}

async function completeTask(taskId) {
  const res = await apiFetch(`/api/extension-tasks`, {
    method: 'PATCH',
    body: JSON.stringify({ task_id: taskId, completed: true }),
  })
  return res.ok
}

// ── Timer helpers ─────────────────────────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

let timerInterval = null

async function syncTimerUI() {
  const { timerEndAt, timerMinutes } = await getStorage(['timerEndAt', 'timerMinutes'])
  const timerIdle = $('timer-idle')
  const timerActive = $('timer-active')

  if (timerEndAt && Date.now() < timerEndAt) {
    hide(timerIdle)
    show(timerActive)
    startTimerTick(timerEndAt)
  } else {
    show(timerIdle)
    hide(timerActive)
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  }
}

function startTimerTick(endAt) {
  if (timerInterval) clearInterval(timerInterval)
  const update = () => {
    const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000))
    $('timer-display').textContent = formatTime(remaining)
    if (remaining === 0) {
      clearInterval(timerInterval)
      timerInterval = null
      setStorage({ timerEndAt: null })
      syncTimerUI()
    }
  }
  update()
  timerInterval = setInterval(update, 1000)
}

// ── Task list rendering ───────────────────────────────────────────────────────
function renderTasks(tasks) {
  const list = $('task-list')
  const badge = $('task-count-badge')
  const incomplete = tasks.filter(t => !t.completed)

  badge.textContent = incomplete.length

  if (tasks.length === 0) {
    list.innerHTML = '<p class="muted">No tasks today — nice!</p>'
    return
  }

  list.innerHTML = ''
  tasks.slice(0, 8).forEach(task => {
    const item = document.createElement('div')
    item.className = `task-item${task.completed ? ' done' : ''}`
    item.dataset.id = task.id

    const dueStr = task.due_time
      ? new Date(task.due_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : ''

    item.innerHTML = `
      <div class="task-check">${task.completed ? '✓' : ''}</div>
      <span class="task-title">${escapeHtml(task.title)}</span>
      ${dueStr ? `<span class="task-time">${dueStr}</span>` : ''}
    `

    if (!task.completed) {
      item.addEventListener('click', async () => {
        item.classList.add('done')
        item.querySelector('.task-check').textContent = '✓'
        await completeTask(task.id)
        const remaining = list.querySelectorAll('.task-item:not(.done)').length
        badge.textContent = remaining
      })
    }

    list.appendChild(item)
  })

  if (tasks.length > 8) {
    const more = document.createElement('p')
    more.className = 'muted'
    more.style.fontSize = '11px'
    more.style.paddingTop = '4px'
    more.textContent = `+${tasks.length - 8} more`
    list.appendChild(more)
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Page context ──────────────────────────────────────────────────────────────
async function getPageContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab) return null
    return { title: tab.title, url: tab.url }
  } catch {
    return null
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function initMain() {
  show($('screen-main'))
  hide($('screen-login'))

  // Timer
  await syncTimerUI()

  // Page context hint
  const ctx = await getPageContext()
  if (ctx && !ctx.url.startsWith('chrome://') && !ctx.url.startsWith('chrome-extension://')) {
    $('page-context-hint').textContent = `📄 ${truncate(ctx.title, 42)}`
  }

  // Load tasks
  try {
    const tasks = await fetchTodayTasks()
    renderTasks(tasks)
  } catch {
    $('task-list').innerHTML = '<p class="muted">Could not load tasks.</p>'
  }
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ── Event handlers ────────────────────────────────────────────────────────────

// Login
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const btn = $('login-btn')
  const errEl = $('login-error')
  btn.disabled = true
  btn.textContent = 'Signing in…'
  errEl.textContent = ''

  try {
    const data = await signIn($('email').value.trim(), $('password').value)
    await setStorage({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userId: data.user.id,
      expiresAt: Date.now() + data.expires_in * 1000,
    })
    await initMain()
  } catch (err) {
    errEl.textContent = err.message
  } finally {
    btn.disabled = false
    btn.textContent = 'Sign In'
  }
})

// Logout
$('logout-btn').addEventListener('click', async () => {
  await removeStorage(['accessToken', 'refreshToken', 'userId', 'expiresAt'])
  hide($('screen-main'))
  show($('screen-login'))
  $('email').value = ''
  $('password').value = ''
})

// Open app
$('open-app-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: `${APP_BASE}/dashboard` })
})

// Timer start
document.querySelectorAll('.timer-start-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const minutes = parseInt(btn.dataset.minutes, 10)
    const endAt = Date.now() + minutes * 60 * 1000
    await setStorage({ timerEndAt: endAt, timerMinutes: minutes })

    // Tell background to set an alarm
    chrome.runtime.sendMessage({ type: 'START_TIMER', minutes, endAt })

    hide($('timer-idle'))
    show($('timer-active'))
    startTimerTick(endAt)
  })
})

// Timer stop
$('timer-stop-btn').addEventListener('click', async () => {
  await setStorage({ timerEndAt: null })
  chrome.runtime.sendMessage({ type: 'STOP_TIMER' })
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  show($('timer-idle'))
  hide($('timer-active'))
})

// Add task
$('add-task-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const input = $('task-input')
  const btn = $('add-task-btn')
  const status = $('add-task-status')
  const text = input.value.trim()
  if (!text) return

  btn.disabled = true
  status.textContent = ''
  status.className = 'status-msg'

  try {
    // Get page context to optionally attach as notes
    const ctx = await getPageContext()
    const pageNote = ctx && !ctx.url.startsWith('chrome://') && !ctx.url.startsWith('chrome-extension://')
      ? `From: ${ctx.title} — ${ctx.url}`
      : null

    // Parse the natural-language input
    const parsed = await parseTask(text)
    const taskData = parsed
      ? { ...parsed, source_url: ctx?.url || null, source_note: pageNote }
      : { title: text, source_url: ctx?.url || null, source_note: pageNote }

    const created = await createTask(taskData)
    if (created) {
      status.textContent = '✓ Task added'
      input.value = ''
      // Refresh task list
      const tasks = await fetchTodayTasks()
      renderTasks(tasks)
    } else {
      throw new Error('Failed to save')
    }
  } catch (err) {
    status.className = 'status-msg err'
    status.textContent = err.message || 'Error adding task'
  } finally {
    btn.disabled = false
    // Clear status after 3s
    setTimeout(() => { status.textContent = '' }, 3000)
  }
})

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  const { accessToken, expiresAt, refreshToken: rt } = await getStorage([
    'accessToken', 'expiresAt', 'refreshToken',
  ])

  if (!accessToken) {
    show($('screen-login'))
    return
  }

  // Refresh if expiring within 5 minutes
  if (expiresAt && Date.now() > expiresAt - 5 * 60 * 1000 && rt) {
    try {
      const refreshed = await refreshToken(rt)
      if (refreshed) {
        await setStorage({
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token,
          expiresAt: Date.now() + refreshed.expires_in * 1000,
        })
      } else {
        // Could not refresh — show login
        await removeStorage(['accessToken', 'refreshToken', 'userId', 'expiresAt'])
        show($('screen-login'))
        return
      }
    } catch {
      show($('screen-login'))
      return
    }
  }

  await initMain()
}

bootstrap()
