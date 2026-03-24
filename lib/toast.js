import React from 'react'

// ─────────────────────────────────────────────────────────────────
// Custom EventEmitter for pub/sub
// ─────────────────────────────────────────────────────────────────
class ToastEmitter {
  constructor() {
    this.listeners = []
  }

  on(callback) {
    this.listeners.push(callback)
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  emit(data) {
    this.listeners.forEach(cb => cb(data))
  }
}

const emitter = new ToastEmitter()
let toastId = 0

// ─────────────────────────────────────────────────────────────────
// showToast: Public API to create toasts
// ─────────────────────────────────────────────────────────────────
export function showToast(message, options = {}) {
  const {
    duration = 3000,
    type = 'default',
    undoCallback = null,
  } = options

  const id = ++toastId

  const toast = {
    id,
    message,
    type,
    undoCallback: type === 'undo' ? undoCallback : null,
    createdAt: Date.now(),
  }

  // Emit ADD event to all subscribers
  emitter.emit({ action: 'ADD', toast })

  // Auto-dismiss after duration (if duration > 0)
  if (duration > 0) {
    setTimeout(() => {
      emitter.emit({ action: 'REMOVE', id })
    }, duration)
  }

  return id
}

// ─────────────────────────────────────────────────────────────────
// Single Toast component (with animations)
// ─────────────────────────────────────────────────────────────────
function Toast({ toast, onRemove }) {
  const [isExiting, setIsExiting] = React.useState(false)

  const handleUndo = () => {
    if (toast.undoCallback) {
      toast.undoCallback()
    }
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 150) // Wait for fade out
  }

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 150)
  }

  const toastStyle = {
    background: '#3E3228',
    color: '#F0EAD6',
    border: '1px solid rgba(240,234,214,0.12)',
    borderRadius: '10px',
    padding: '12px 14px',
    maxWidth: '280px',
    fontFamily: 'Figtree, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
    opacity: isExiting ? 0 : 1,
    transform: isExiting ? 'translateY(20px)' : 'translateY(0)',
    transition: isExiting
      ? 'opacity 150ms ease-out, transform 150ms ease-out'
      : 'opacity 200ms ease-out, transform 200ms ease-out',
    ...(toast.type === 'error' && {
      borderLeft: '3px solid #E8321A',
      paddingLeft: '11px',
    }),
    ...(toast.type === 'success' && {
      borderLeft: '3px solid #4CAF50',
      paddingLeft: '11px',
    }),
  }

  const messageStyle = {
    flex: 1,
    wordBreak: 'break-word',
  }

  const undoButtonStyle = {
    color: '#FF6644',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'Figtree, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    padding: '4px 0',
    whiteSpace: 'nowrap',
    transition: 'opacity 200ms ease',
    opacity: 0.9,
  }

  return (
    <div style={toastStyle}>
      <span style={messageStyle}>{toast.message}</span>
      {toast.undoCallback && toast.type === 'undo' && (
        <button
          style={undoButtonStyle}
          onClick={handleUndo}
          onMouseEnter={(e) => (e.target.style.opacity = '1')}
          onMouseLeave={(e) => (e.target.style.opacity = '0.9')}
        >
          Undo
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ToastContainer: React component to mount in app
// ─────────────────────────────────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = React.useState([])

  React.useEffect(() => {
    const unsubscribe = emitter.on(({ action, toast, id }) => {
      if (action === 'ADD') {
        setToasts(prev => {
          const updated = [...prev, toast]
          // Keep only the last 3 toasts (FIFO: remove oldest)
          if (updated.length > 3) {
            updated.shift()
          }
          return updated
        })
      } else if (action === 'REMOVE') {
        setToasts(prev => prev.filter(t => t.id !== id))
      }
    })

    return unsubscribe
  }, [])

  const containerStyle = {
    position: 'fixed',
    bottom: '100px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '320px',
    pointerEvents: 'auto',
  }

  return (
    <div style={containerStyle}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))}
        />
      ))}
    </div>
  )
}
