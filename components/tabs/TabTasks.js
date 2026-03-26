import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function TabTasks({ user, profile, tasks = [], setTasks, showToast, loggedFetch, switchTab }) {
  const [greet, setGreet] = useState(true)
  const [xpId, setXpId] = useState(null)
  const [loading, setLoading] = useState(false)

  // Fetch tasks on mount if empty
  useEffect(() => {
    if (!user || tasks.length > 0) return
    setLoading(true)
    supabase.from('tasks').select('*').eq('user_id', user.id).eq('archived', false).order('created_at', { ascending: false })
      .then(({ data }) => { if (data && setTasks) setTasks(data) })
      .finally(() => setLoading(false))
  }, [user])

  const toggle = async (id) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const newCompleted = !task.completed
    const completedAt = newCompleted ? new Date().toISOString() : null
    if (setTasks) setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: newCompleted, completed_at: completedAt } : t))
    if (newCompleted) { setXpId(id); setTimeout(() => setXpId(null), 1200) }
    await supabase.from('tasks').update({ completed: newCompleted, completed_at: completedAt }).eq('id', id)
  }

  const star = async (id) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    if (setTasks) setTasks(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t))
    await supabase.from('tasks').update({ starred: !task.starred }).eq('id', id)
  }

  const active = tasks.filter(t => !t.completed && !t.archived).sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))
  const done = tasks.filter(t => t.completed && !t.archived)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const name = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto', height: '100%', paddingBottom: 80 }}>
      <style>{`@keyframes xpFloat{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-24px)}} @keyframes greetIn{0%{max-height:0;opacity:0;padding:0 12px;margin-bottom:0}30%{opacity:0}100%{max-height:120px;opacity:1;padding:11px 12px;margin-bottom:10px}} @keyframes greetText{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: "'Figtree',sans-serif" }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 12px', background: '#FF664412', border: '1px solid #FF664425', borderRadius: 6, cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF6644" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          <span style={{ fontSize: 13, color: '#FF6644', fontFamily: "'Figtree',sans-serif", fontWeight: 500 }}>Add</span>
        </div>
      </div>

      {/* Morning greeting */}
      {greet && (
        <div style={{ background: 'linear-gradient(135deg,#3E3228 0%,#211A14 100%)', borderRadius: 10, padding: '11px 12px', marginBottom: 10, border: '.5px solid #F5F0E318', position: 'relative', animation: 'greetIn .6s ease forwards' }}>
          <div onClick={() => setGreet(false)} style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer', padding: 4, fontSize: 10, color: '#F5F0E350' }}>&#10005;</div>
          <div style={{ animation: 'greetText .4s ease .4s both', fontSize: 13, fontWeight: 600, color: '#F5F0E3', fontFamily: "'Figtree',sans-serif", marginBottom: 3 }}>{greeting}, {name}</div>
          <div style={{ animation: 'greetText .4s ease .55s both', fontSize: 10, color: '#F5F0E390', fontFamily: "'Figtree',sans-serif", lineHeight: 1.5, paddingRight: 18 }}>
            {active.length > 0 ? `${active.length} task${active.length !== 1 ? 's' : ''} on your list.` : 'Nothing on your list yet. Add something to start.'}
          </div>
        </div>
      )}

      {/* Priority card — starred task */}
      {active.find(t => t.starred) && (() => { const p = active.find(t => t.starred); return (
        <div style={{ background: '#3E3228', borderRadius: 10, padding: 12, marginBottom: 10, borderLeft: '3px solid #E8321A' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.08em', color: '#E8321A', fontFamily: "'Figtree',sans-serif" }}>Do this first</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E3', fontFamily: "'Figtree',sans-serif" }}>{p.title}</div>
          {p.scheduled_for && <div style={{ fontSize: 10, color: '#F5F0E350', fontFamily: "'Figtree',sans-serif", marginTop: 3 }}>{new Date(p.scheduled_for).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <div onClick={() => switchTab && switchTab('focus')} style={{ padding: '6px 14px', background: '#E8321A', borderRadius: 8, fontSize: 14, fontWeight: 500, color: '#F5F0E3', fontFamily: "'Figtree',sans-serif", cursor: 'pointer' }}>Start timer</div>
            <div style={{ padding: '6px 12px', background: '#F5F0E308', border: '1px solid #F5F0E318', borderRadius: 8, fontSize: 14, color: '#F5F0E350', fontFamily: "'Figtree',sans-serif", cursor: 'pointer' }}>Tomorrow</div>
          </div>
        </div>
      ); })()}

      {/* Loading state */}
      {loading && <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: '#F5F0E350', fontFamily: "'Figtree',sans-serif" }}>Loading tasks...</div>}

      {/* Task list */}
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: '#F5F0E350', fontFamily: "'Figtree',sans-serif", fontWeight: 500, padding: '8px 0 4px' }}>Up next ({active.length})</div>
      {active.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', background: '#3E3228', borderRadius: 8, marginBottom: 5, position: 'relative' }}>
          <div onClick={() => toggle(t.id)} style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}><div style={{ width: 17, height: 17, borderRadius: '50%', border: '1.5px solid #F5F0E350', background: 'transparent' }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#F5F0E3', fontFamily: "'Figtree',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
            {t.scheduled_for && <div style={{ fontSize: 10, color: '#F5F0E350', fontFamily: "'Figtree',sans-serif", marginTop: 2 }}>{new Date(t.scheduled_for).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>}
          </div>
          <div onClick={() => star(t.id)} style={{ cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={t.starred ? '#E8321A' : 'none'} stroke={t.starred ? '#E8321A' : '#F5F0E320'} strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          </div>
          {xpId === t.id && <div style={{ position: 'absolute', top: -4, right: 12, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: '#FFB800', animation: 'xpFloat 1.2s ease forwards', pointerEvents: 'none' }}>+10 XP</div>}
        </div>
      ))}

      {/* Completed */}
      {done.length > 0 && <>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: '#F5F0E350', fontFamily: "'Figtree',sans-serif", fontWeight: 500, padding: '8px 0 4px' }}>Completed ({done.length})</div>
        {done.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', background: '#3E3228', borderRadius: 8, marginBottom: 5, opacity: 0.45 }}>
            <div onClick={() => toggle(t.id)} style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
              <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 12l5 5L19 7" /></svg>
              </div>
            </div>
            <span style={{ fontSize: 13, color: '#F5F0E350', fontFamily: "'Figtree',sans-serif", textDecoration: 'line-through' }}>{t.title}</span>
          </div>
        ))}
      </>}

      {/* Momentum bar */}
      <div style={{ background: '#3E3228', borderRadius: 8, padding: '8px 10px', marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11 }}>&#128293;</span>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 600, color: '#FF6644' }}>{done.length}/{tasks.filter(t => !t.archived).length}</span>
            <span style={{ fontSize: 9, color: '#F5F0E350', fontFamily: "'Figtree',sans-serif" }}>today</span>
          </div>
          <span style={{ fontSize: 9, color: '#FFB800', fontFamily: "'Sora',sans-serif", fontWeight: 500 }}>{profile?.total_xp || 0} XP &middot; {profile?.current_streak || 0}d streak</span>
        </div>
        <div style={{ height: 4, background: '#F5F0E308', borderRadius: 2, marginTop: 6 }}>
          <div style={{ width: `${(done.length / Math.max(tasks.filter(t => !t.archived).length, 1)) * 100}%`, height: '100%', background: '#FF6644', borderRadius: 2, transition: 'width .3s' }} />
        </div>
      </div>
    </div>
  )
}
