// FocusBuddy content script — runs on focus-buddy.app
// Syncs the Supabase auth session into chrome.storage so the popup can
// make authenticated API calls without asking the user to log in twice.

(function syncAuth() {
  try {
    // Supabase stores the session in localStorage under a key that starts with
    // "sb-" followed by the project ref and ending with "-auth-token".
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    if (!key) return

    const raw = localStorage.getItem(key)
    if (!raw) return

    const session = JSON.parse(raw)
    const { access_token, refresh_token, expires_at, user } = session || {}
    if (!access_token) return

    chrome.storage.local.set({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_at ? expires_at * 1000 : null,
      userId: user?.id || null,
    })
  } catch {
    // Silently ignore — content scripts should never break the host page
  }
})()
