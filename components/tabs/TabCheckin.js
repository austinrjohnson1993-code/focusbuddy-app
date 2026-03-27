import React, { useState, useEffect, useRef } from 'react'
import { getCheckinType, loadChatHistory, saveChatHistory } from './shared'
import CinisMark from '../../lib/CinisMark'

export default function TabCheckin({ user, profile, tasks = [], showToast, loggedFetch }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  // Load history from localStorage
  useEffect(() => {
    if (!user) return
    const chatKey = `cinis_checkin_${user.id}`
    const saved = loadChatHistory(chatKey)
    if (saved && saved.length > 0) setMessages(saved)
  }, [user])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    if (!text.trim() || sending) return
    const userMsg = { role: 'user', content: text.trim(), time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setSending(true)
    const chatKey = `cinis_checkin_${user.id}`

    try {
      const fetchFn = loggedFetch || fetch
      const res = await fetchFn('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          checkInType: getCheckinType(),
          messages: updated,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      })
      const data = await res.json()
      if (data.error === 'rate_limit_reached') {
        setMessages(p => [...p, { role: 'assistant', content: "You've hit your daily limit. Upgrade to Pro for more.", time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }])
      } else if (data.message) {
        const aiMsg = { role: 'assistant', content: data.message, tasks: data.tasks, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
        const final = [...updated, aiMsg]
        setMessages(final)
        saveChatHistory(chatKey, final)
      }
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: 'Something went wrong. Try again.', time: '' }])
    }
    setSending(false)
  }

  const chips = ["What should I do next?", "Prioritize my list", "I'm stuck"]

  const personaBlend = profile?.persona_blend || []
  const personaLabel = personaBlend.length > 0 ? personaBlend.map(p => {
    const names = { drill_sergeant: 'Drill Sergeant', coach: 'Coach', thinking_partner: 'Thinking Partner', hype_person: 'Hype Person', strategist: 'Strategist', empath: 'Empath' }
    return names[p] || p
  }).join(' \u00B7 ') : 'Coach'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E3', fontFamily: "'Figtree',sans-serif" }}>Check-in</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', background: '#FF664410', borderRadius: 10, border: '1px solid #FF664418' }}>
            <span style={{ fontSize: 14, color: '#FF6644', fontFamily: "'Figtree',sans-serif", fontWeight: 500 }}>&#10022; {personaLabel}</span>
          </div>
        </div>
        <div style={{ height: 1, background: '#F5F0E318' }} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 0' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: "'Figtree',sans-serif", lineHeight: 1.6 }}>Your coach is ready.<br />What&apos;s on your mind?</div>
          </div>
        )}
        {messages.map((m, i) => m.role === 'assistant' ? (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FF664415', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <CinisMark size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ background: '#3E3228', borderRadius: '2px 12px 12px 12px', padding: '11px 13px', fontSize: 14, color: '#F5F0E3', fontFamily: "'Figtree',sans-serif", lineHeight: 1.65 }}>{m.content}</div>
                {m.tasks && m.tasks.map((t, ti) => (
                  <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', background: '#FF664406', border: '1px solid #FF664415', borderRadius: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 14, color: '#F5F0E3', fontFamily: "'Figtree',sans-serif", flex: 1 }}>{t}</span>
                    <div style={{ padding: '10px 12px', background: '#FF6644', borderRadius: 6, fontSize: 14, color: '#F5F0E3', fontFamily: "'Figtree',sans-serif", cursor: 'pointer', fontWeight: 500 }}>Add</div>
                  </div>
                ))}
                <div style={{ fontSize: 14, color: '#F5F0E338', fontFamily: "'Figtree',sans-serif", marginTop: 5, paddingLeft: 2 }}>{m.time}</div>
              </div>
            </div>
          </div>
        ) : (
          <div key={i} style={{ marginBottom: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ maxWidth: '78%' }}>
              <div style={{ background: '#FF664412', borderRadius: '12px 2px 12px 12px', padding: '11px 13px', fontSize: 14, color: '#F5F0E3', fontFamily: "'Figtree',sans-serif", lineHeight: 1.65 }}>{m.content}</div>
              <div style={{ fontSize: 14, color: '#F5F0E338', fontFamily: "'Figtree',sans-serif", marginTop: 5, textAlign: 'right' }}>{m.time}</div>
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FF664415', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <CinisMark size={14} />
              </div>
              <div style={{ background: '#3E3228', borderRadius: '2px 12px 12px 12px', padding: '11px 13px', fontSize: 14, color: '#F5F0E350', fontFamily: "'Figtree',sans-serif" }}>&middot;&middot;&middot;</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: '8px 14px 14px', borderTop: '.5px solid #F5F0E318', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, overflowX: 'auto' }}>
          {chips.map((ch, i) => (
            <div key={i} onClick={() => send(ch)} style={{ padding: '10px 12px', background: '#3E3228', border: '1px solid #F5F0E31E', borderRadius: 20, fontSize: 14, color: '#F5F0E390', fontFamily: "'Figtree',sans-serif", cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{ch}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, background: '#3E3228', borderRadius: 12, padding: '0 14px', border: '1px solid #F5F0E31E' }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(input)} placeholder="Message..." style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#F5F0E3', fontSize: 14, fontFamily: "'Figtree',sans-serif", padding: '11px 0' }} />
          </div>
          <div onClick={() => send(input)} style={{ width: 44, height: 44, borderRadius: 12, background: input.trim() ? '#FF6644' : '#F5F0E306', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F5F0E3" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </div>
        </div>
      </div>
    </div>
  )
}
