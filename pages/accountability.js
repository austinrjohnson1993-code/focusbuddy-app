import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { UsersThree, PaperPlaneRight, CaretLeft } from '@phosphor-icons/react'

const ACCENT = '#FF6644'

const s = {
  page: { minHeight: '100vh', background: '#110d06', color: '#f0ead6', fontFamily: "'Figtree', sans-serif" },
  topBar: { borderBottom: '1px solid rgba(255,200,120,0.1)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '10px' },
  backBtn: { background: 'none', border: 'none', color: 'rgba(240,234,214,0.45)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0', marginRight: '6px' },
  heading: { margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f0ead6' },
  inviteBtn: { marginLeft: 'auto', background: ACCENT, border: 'none', borderRadius: '100px', padding: '8px 18px', color: '#110d06', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' },
  body: { maxWidth: '600px', margin: '0 auto', padding: '32px 24px' },
  card: { background: '#2A1810', border: '1px solid rgba(255,200,120,0.1)', borderRadius: '14px', padding: '20px 22px', marginBottom: '20px' },
  cardAccent: { background: '#2A1810', border: '1px solid rgba(255,200,120,0.1)', borderLeft: `3px solid ${ACCENT}`, borderRadius: '14px', padding: '20px 22px', marginBottom: '20px' },
  label: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(240,234,214,0.38)', marginBottom: '8px' },
  name: { fontSize: '18px', fontWeight: 700, marginBottom: '14px' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  statNum: { fontSize: '26px', fontWeight: 700, color: ACCENT },
  statLabel: { fontSize: '12px', color: 'rgba(240,234,214,0.45)' },
  togetherBanner: { background: 'rgba(232,50,26,0.08)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'rgba(240,234,214,0.7)', lineHeight: 1.5 },
  primaryBtn: { background: ACCENT, border: 'none', borderRadius: '100px', padding: '10px 22px', color: '#110d06', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' },
  secondaryBtn: { background: 'none', border: '1px solid rgba(255,200,120,0.18)', borderRadius: '100px', padding: '10px 18px', color: 'rgba(240,234,214,0.55)', fontSize: '0.875rem', cursor: 'pointer' },
  input: { display: 'block', width: '100%', background: 'rgba(255,200,120,0.05)', border: '1px solid rgba(255,200,120,0.15)', borderRadius: '100px', padding: '12px 18px', color: '#f0ead6', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box', fontFamily: "'Figtree', sans-serif" },
  msgInput: { flex: 1, background: 'rgba(255,200,120,0.05)', border: '1px solid rgba(255,200,120,0.12)', borderRadius: '100px', padding: '10px 16px', color: '#f0ead6', fontSize: '13px', outline: 'none', fontFamily: "'Figtree', sans-serif' " },
}

export default function Accountability() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pairs, setPairs] = useState([])
  const [partner, setPartner] = useState(null)
  const [messages, setMessages] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteStatus, setInviteStatus] = useState(null)
  const [messageInput, setMessageInput] = useState('')
  const [messageSending, setMessageSending] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUser(user)
      fetchData(user.id)
    })
  }, [])

  async function fetchData(userId) {
    setLoading(true)
    try {
      const res = await fetch(`/api/accountability?userId=${userId}`)
      const data = await res.json()
      setPairs(data.pairs || [])
      setPartner(data.partner || null)
      setMessages(data.messages || [])
      setPendingInvites(data.pendingInvites || [])
    } catch (e) {
      console.error('[accountability] fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function sendInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteSending(true)
    setInviteStatus(null)
    try {
      const res = await fetch('/api/accountability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'invite', email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (data.error) {
        setInviteStatus({ type: 'error', msg: data.error })
      } else {
        setInviteStatus({ type: 'sent', msg: 'Invite sent!' })
        setInviteEmail('')
        setShowInviteForm(false)
        fetchData(user.id)
      }
    } catch {
      setInviteStatus({ type: 'error', msg: 'Something went wrong.' })
    } finally {
      setInviteSending(false)
    }
  }

  async function respondToInvite(pairId, action) {
    await fetch('/api/accountability', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, pairId, action }),
    })
    fetchData(user.id)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!messageInput.trim() || !partner) return
    setMessageSending(true)
    try {
      await fetch('/api/accountability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'message', message: messageInput.trim(), partnerId: partner.id }),
      })
      setMessageInput('')
      fetchData(user.id)
    } finally {
      setMessageSending(false)
    }
  }

  const outgoingPending = pairs.filter(p => p.user_id === user?.id && p.status === 'pending')
  const partnerFirstName = partner ? (partner.name.split(' ')[0] || partner.name) : ''

  return (
    <>
      <Head><title>Partners — Cinis</title></Head>
      <div style={s.page}>
        {/* Top bar */}
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => router.push('/dashboard')}>
            <CaretLeft size={14} /> Back
          </button>
          <UsersThree size={20} color={ACCENT} weight="fill" />
          <h1 style={s.heading}>Partners</h1>
          {!partner && !showInviteForm && (
            <button style={s.inviteBtn} onClick={() => setShowInviteForm(true)}>
              Invite a partner
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', opacity: 0.35, fontSize: '14px' }}>Loading…</div>
        ) : (
          <div style={s.body}>

            {/* Pending incoming invites */}
            {pendingInvites.map(invite => (
              <div key={invite.id} style={{ ...s.card, borderColor: `${ACCENT}30` }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                  {invite.senderName} wants to be your accountability partner.
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(240,234,214,0.45)', marginBottom: '16px' }}>{invite.senderEmail}</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button style={s.primaryBtn} onClick={() => respondToInvite(invite.id, 'accept')}>Accept</button>
                  <button style={s.secondaryBtn} onClick={() => respondToInvite(invite.id, 'decline')}>Decline</button>
                </div>
              </div>
            ))}

            {/* Active partner */}
            {partner ? (
              <>
                <div style={s.cardAccent}>
                  <div style={s.label}>Your partner</div>
                  <div style={s.name}>{partnerFirstName}</div>
                  <div style={s.statsGrid}>
                    <div>
                      <div style={s.statNum}>{partner.tasksToday}</div>
                      <div style={s.statLabel}>tasks today</div>
                    </div>
                    <div>
                      <div style={s.statNum}>{partner.tasksThisWeek}</div>
                      <div style={s.statLabel}>tasks this week</div>
                    </div>
                  </div>
                  <div style={s.togetherBanner}>
                    You and <strong style={{ color: '#f0ead6' }}>{partnerFirstName}</strong> have completed{' '}
                    <strong style={{ color: '#f0ead6' }}>{partner.combinedTasksThisWeek} tasks</strong> together this week.
                  </div>
                </div>

                {/* Message thread */}
                <div style={{ background: '#1a1008', border: '1px solid rgba(255,200,120,0.08)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
                  <div style={s.label}>Nudges</div>
                  {messages.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'rgba(240,234,214,0.3)', margin: '0 0 16px', fontStyle: 'italic' }}>
                      No messages yet. Send {partnerFirstName} a quick nudge.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '240px', overflowY: 'auto' }}>
                      {messages.map(msg => {
                        const isMe = msg.sender_id === user?.id
                        return (
                          <div key={msg.id} style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '80%',
                            background: isMe ? 'rgba(232,50,26,0.14)' : 'rgba(255,200,120,0.06)',
                            border: `1px solid ${isMe ? 'rgba(232,50,26,0.22)' : 'rgba(255,200,120,0.1)'}`,
                            borderRadius: '10px',
                            padding: '9px 13px',
                            fontSize: '13px',
                            color: 'rgba(240,234,214,0.85)',
                            lineHeight: 1.5,
                          }}>
                            {msg.message}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Send a nudge…"
                      value={messageInput}
                      onChange={e => setMessageInput(e.target.value)}
                      style={{ flex: 1, background: 'rgba(255,200,120,0.05)', border: '1px solid rgba(255,200,120,0.12)', borderRadius: '100px', padding: '10px 16px', color: '#f0ead6', fontSize: '13px', outline: 'none', fontFamily: "'Figtree', sans-serif" }}
                    />
                    <button
                      type="submit"
                      disabled={messageSending || !messageInput.trim()}
                      style={{ background: ACCENT, border: 'none', borderRadius: '100px', padding: '10px 16px', cursor: 'pointer', color: '#110d06', display: 'flex', alignItems: 'center', opacity: (!messageInput.trim() || messageSending) ? 0.4 : 1 }}
                    >
                      <PaperPlaneRight size={16} weight="fill" />
                    </button>
                  </form>
                </div>
              </>

            ) : outgoingPending.length > 0 ? (
              /* Pending outgoing invite */
              <div style={{ ...s.card, textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Invite sent</div>
                <div style={{ fontSize: '13px', color: 'rgba(240,234,214,0.45)' }}>Waiting for them to accept.</div>
              </div>

            ) : !showInviteForm ? (
              /* Empty state */
              <div style={{ textAlign: 'center', padding: '64px 24px 40px' }}>
                <UsersThree size={48} color={ACCENT} weight="duotone" style={{ opacity: 0.6, marginBottom: '20px', display: 'block', margin: '0 auto 20px' }} />
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 12px' }}>Accountability is better together.</h2>
                <p style={{ fontSize: '14px', color: 'rgba(240,234,214,0.5)', lineHeight: 1.7, maxWidth: '320px', margin: '0 auto 32px' }}>
                  Invite a friend and you'll see each other's wins — not scores.
                </p>
                <button style={s.primaryBtn} onClick={() => setShowInviteForm(true)}>Invite a partner</button>
              </div>
            ) : null}

            {/* Invite form */}
            {showInviteForm && !partner && (
              <div style={s.card}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Invite by email</div>
                <form onSubmit={sendInvite}>
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                    style={s.input}
                  />
                  {inviteStatus && (
                    <p style={{ fontSize: '13px', color: inviteStatus.type === 'error' ? '#e74c3c' : '#3ecf8e', margin: '0 0 12px' }}>
                      {inviteStatus.msg}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" disabled={inviteSending} style={{ ...s.primaryBtn, opacity: inviteSending ? 0.6 : 1 }}>
                      {inviteSending ? 'Sending…' : 'Send invite'}
                    </button>
                    <button type="button" style={s.secondaryBtn} onClick={() => { setShowInviteForm(false); setInviteStatus(null) }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  )
}
