// Toast notification system — browser-only, works from any component
// Usage: import { showToast } from '../lib/toastUtils'
//        showToast('Saved!', 'success')

const TOAST_EVENT = 'focusbuddy:toast'

const STYLES = {
  success: { bg: '#10b981', icon: '✓' },
  error:   { bg: '#ef4444', icon: '✕' },
  info:    { bg: '#6366f1', icon: 'i' },
}

let container = null

function getContainer() {
  if (container && document.body.contains(container)) return container
  container = document.createElement('div')
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    display: 'flex',
    flexDirection: 'column-reverse',
    alignItems: 'center',
    gap: '8px',
    pointerEvents: 'none',
  })
  document.body.appendChild(container)
  return container
}

function renderToast(message, type) {
  if (typeof document === 'undefined') return
  const c = getContainer()
  const { bg, icon } = STYLES[type] || STYLES.info

  const toast = document.createElement('div')
  Object.assign(toast.style, {
    background: bg,
    color: '#fff',
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    transform: 'translateY(16px)',
    opacity: '0',
    transition: 'transform 0.25s ease, opacity 0.25s ease',
    pointerEvents: 'auto',
    maxWidth: '360px',
    whiteSpace: 'nowrap',
  })
  toast.innerHTML = `<span style="font-weight:bold">${icon}</span><span>${message}</span>`
  c.appendChild(toast)

  // Slide up
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)'
      toast.style.opacity = '1'
    })
  })

  // Auto-dismiss after 3s
  setTimeout(() => {
    toast.style.transform = 'translateY(16px)'
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

if (typeof window !== 'undefined') {
  window.addEventListener(TOAST_EVENT, (e) => renderToast(e.detail.message, e.detail.type))
}

export function showToast(message, type = 'info') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }))
}
