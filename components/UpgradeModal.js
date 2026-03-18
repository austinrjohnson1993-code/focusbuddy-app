import React from 'react'

const COPY = {
  limit: {
    headline: "You've used your 5 daily check-ins.",
    body: "Your coach resets tomorrow — or keep the conversation going with Pro.",
  },
  memory: {
    headline: "I start fresh each day on free.",
    body: "Pro members get a coach who remembers everything — patterns, wins, what you've been avoiding.",
  },
  proactive: {
    headline: "Your coach sent you a message this morning.",
    body: "Upgrade to receive daily check-ins before you open the app.",
  },
}

export default function UpgradeModal({ trigger, onClose }) {
  if (!trigger) return null
  const { headline, body } = COPY[trigger] || COPY.limit

  const handleUpgrade = async () => {
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // no-op — stub endpoint
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={accentBar} />
        <h2 style={headlineStyle}>{headline}</h2>
        <p style={bodyStyle}>{body}</p>
        <button style={ctaBtn} onClick={handleUpgrade}>
          Upgrade to Pro — $14/mo
        </button>
        <button style={laterBtn} onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.72)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
}

const card = {
  background: '#2A1810',
  borderRadius: '16px',
  padding: '32px 28px 28px',
  maxWidth: '380px',
  width: '90%',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const accentBar = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: '3px',
  background: 'linear-gradient(90deg, #FF6644, #FF8C00)',
}

const headlineStyle = {
  fontFamily: "'Figtree', sans-serif",
  fontSize: '18px',
  fontWeight: 700,
  color: '#f0ead6',
  margin: 0,
  lineHeight: 1.3,
}

const bodyStyle = {
  fontFamily: "'Figtree', sans-serif",
  fontSize: '14px',
  color: 'rgba(240,234,214,0.7)',
  margin: 0,
  lineHeight: 1.5,
}

const ctaBtn = {
  width: '100%',
  padding: '14px',
  background: 'linear-gradient(135deg, #FF6644, #FF4500)',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontFamily: "'Figtree', sans-serif",
  fontSize: '15px',
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: '8px',
}

const laterBtn = {
  background: 'none',
  border: 'none',
  color: 'rgba(240,234,214,0.45)',
  fontFamily: "'Figtree', sans-serif",
  fontSize: '13px',
  cursor: 'pointer',
  padding: '4px',
  textAlign: 'center',
}
