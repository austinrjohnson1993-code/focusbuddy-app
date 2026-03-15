// FocusBuddy Chrome Extension — Background Service Worker
// Handles: focus timer alarms, badge updates, desktop notifications

const ALARM_NAME = 'focusbuddy-timer'
const BADGE_INTERVAL_ALARM = 'focusbuddy-badge-tick'

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'START_TIMER') {
    startTimer(msg.minutes, msg.endAt)
    sendResponse({ ok: true })
  } else if (msg.type === 'STOP_TIMER') {
    stopTimer()
    sendResponse({ ok: true })
  }
})

// ── Timer logic ───────────────────────────────────────────────────────────────
async function startTimer(minutes, endAt) {
  // Clear any existing alarm
  await chrome.alarms.clear(ALARM_NAME)
  await chrome.alarms.clear(BADGE_INTERVAL_ALARM)

  // Set completion alarm
  chrome.alarms.create(ALARM_NAME, { when: endAt })

  // Set 1-minute tick for badge updates
  chrome.alarms.create(BADGE_INTERVAL_ALARM, { periodInMinutes: 1 / 60 })

  updateBadge(endAt)
}

async function stopTimer() {
  await chrome.alarms.clear(ALARM_NAME)
  await chrome.alarms.clear(BADGE_INTERVAL_ALARM)
  chrome.action.setBadgeText({ text: '' })
}

function updateBadge(endAt) {
  const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000))
  if (remaining === 0) {
    chrome.action.setBadgeText({ text: '' })
    return
  }
  const minutes = Math.ceil(remaining / 60)
  chrome.action.setBadgeText({ text: `${minutes}m` })
  chrome.action.setBadgeBackgroundColor({ color: '#ff4d1c' })
}

// ── Alarm handler ─────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    // Timer complete
    chrome.action.setBadgeText({ text: '' })
    await chrome.storage.local.set({ timerEndAt: null })
    await chrome.alarms.clear(BADGE_INTERVAL_ALARM)

    chrome.notifications.create('focus-complete', {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Focus session complete! 🎉',
      message: 'Great work. Take a short break before your next session.',
      priority: 2,
    })
  } else if (alarm.name === BADGE_INTERVAL_ALARM) {
    // Update badge countdown
    const { timerEndAt } = await chrome.storage.local.get(['timerEndAt'])
    if (timerEndAt && Date.now() < timerEndAt) {
      updateBadge(timerEndAt)
    } else {
      chrome.action.setBadgeText({ text: '' })
      chrome.alarms.clear(BADGE_INTERVAL_ALARM)
    }
  }
})

// ── Notification click handler ────────────────────────────────────────────────
chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId === 'focus-complete') {
    chrome.tabs.create({ url: 'https://focus-buddy.app/dashboard' })
    chrome.notifications.clear(notifId)
  }
})

// ── Install / startup ─────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: 'https://focus-buddy.app/dashboard' })
  }
})

// Restore badge on service worker restart
chrome.runtime.onStartup.addListener(async () => {
  const { timerEndAt } = await chrome.storage.local.get(['timerEndAt'])
  if (timerEndAt && Date.now() < timerEndAt) {
    updateBadge(timerEndAt)
    // Re-register badge tick alarm if timer is still active
    chrome.alarms.create(BADGE_INTERVAL_ALARM, { periodInMinutes: 1 / 60 })
  }
})
