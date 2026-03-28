import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { localDateStr, todayStr } from './shared'

const MOOD_EMOJIS = ['\uD83D\uDE24', '\uD83D\uDE14', '\uD83D\uDE10', '\uD83E\uDDE0', '\uD83D\uDE0C', '\uD83D\uDCAA', '\uD83D\uDD25']

export default function TabHabits({ user, profile, showToast, loggedFetch }) {
  // ── Habits state ─────────────────────────────────────────────────────────
  const [habits, setHabits] = useState([])
  const [habitCompletions, setHabitCompletions] = useState([])
  const [habitsLoaded, setHabitsLoaded] = useState(false)
  const [habitsLoading, setHabitsLoading] = useState(false)
  const [habitsError, setHabitsError] = useState(false)

  // Add habit overlay
  const [showAddHabitOverlay, setShowAddHabitOverlay] = useState(false)
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitNote, setNewHabitNote] = useState('')
  const [newHabitType, setNewHabitType] = useState('build')
  const [newHabitFrequency, setNewHabitFrequency] = useState('daily')
  const [addingHabit, setAddingHabit] = useState(false)

  // Journal
  const [habitJournalExpanded, setHabitJournalExpanded] = useState(false)
  const [habitJournalMood, setHabitJournalMood] = useState(null)
  const [habitJournalText, setHabitJournalText] = useState('')
  const [habitJournalSending, setHabitJournalSending] = useState(false)
  const [habitJournalAiReply, setHabitJournalAiReply] = useState(null)
  const [journalEntries, setJournalEntries] = useState([])
  const [journalView, setJournalView] = useState('today') // today | write
  const [journalCategory, setJournalCategory] = useState(null)
  const [showPreviousEntries, setShowPreviousEntries] = useState(false)

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchHabits = async (userId) => {
    setHabitsLoaded(true)
    setHabitsLoading(true)
    setHabitsError(false)
    try {
      const res = await loggedFetch(`/api/habits?userId=${userId}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setHabits(data.habits || [])
      setHabitCompletions(data.completions || [])
    } catch {
      setHabitsError(true)
    } finally {
      setHabitsLoading(false)
    }
  }

  const fetchJournalEntries = async (userId) => {
    const { data } = await supabase
      .from('journal_entries').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(5)
    setJournalEntries(data || [])
  }

  useEffect(() => { if (user && !habitsLoaded) fetchHabits(user.id) }, [user])
  useEffect(() => { if (user) fetchJournalEntries(user.id) }, [user])

  // ── Computed ─────────────────────────────────────────────────────────────
  const todayDateStr = todayStr()
  const completedTodayIds = new Set(
    habitCompletions.filter(c => c.completed_at && c.completed_at.slice(0, 10) === todayDateStr).map(c => c.habit_id)
  )
  const journaledToday = journalEntries.some(e => e.created_at && e.created_at.slice(0, 10) === todayDateStr)
  const todayEntry = journalEntries.find(e => e.created_at && e.created_at.slice(0, 10) === todayDateStr)
  const progressNumer = completedTodayIds.size + (journaledToday ? 1 : 0)
  const progressDenom = habits.length + 1
  const allDone = progressNumer >= progressDenom

  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return localDateStr(d) })
  function getHabitHeat(habitId) {
    return last7.map(dateStr => habitCompletions.some(c => c.habit_id === habitId && c.completed_at && c.completed_at.slice(0, 10) === dateStr))
  }
  function getHabitStreak(habitId) {
    let streak = 0
    for (let i = 0; i < 60; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const done = habitCompletions.some(c => c.habit_id === habitId && c.completed_at && c.completed_at.slice(0, 10) === localDateStr(d))
      if (done) streak++
      else if (i > 0) break
    }
    return streak
  }
  function getJournalStreak() {
    let streak = 0
    for (let i = 0; i < 60; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = localDateStr(d)
      if (journalEntries.some(e => e.created_at && e.created_at.slice(0, 10) === ds)) streak++
      else if (i > 0) break
    }
    return streak
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleHabit = async (habitId) => {
    const isCompleted = completedTodayIds.has(habitId)
    if (isCompleted) {
      setHabitCompletions(prev => prev.filter(c => !(c.habit_id === habitId && c.completed_at && c.completed_at.slice(0, 10) === todayDateStr)))
    } else {
      setHabitCompletions(prev => [...prev, { habit_id: habitId, user_id: user.id, completed_at: new Date().toISOString() }])
    }
    try {
      await loggedFetch('/api/habits/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, habitId, date: todayDateStr })
      })
    } catch {
      if (isCompleted) {
        setHabitCompletions(prev => [...prev, { habit_id: habitId, user_id: user.id, completed_at: new Date().toISOString() }])
      } else {
        setHabitCompletions(prev => prev.filter(c => !(c.habit_id === habitId && c.completed_at && c.completed_at.slice(0, 10) === todayDateStr)))
      }
    }
  }

  const deleteHabit = async (habitId) => {
    setHabits(prev => prev.filter(h => h.id !== habitId))
    await loggedFetch(`/api/habits?userId=${user.id}&habitId=${habitId}`, { method: 'DELETE' })
  }

  const sendHabitJournal = async () => {
    if (!habitJournalText.trim()) return
    setHabitJournalSending(true)
    try {
      const moodPrefix = habitJournalMood ? `Mood: ${habitJournalMood}\n\n` : ''
      const res = await loggedFetch('/api/journal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: moodPrefix + habitJournalText.trim(), conversationHistory: [], timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      })
      const data = await res.json()
      if (data.message) {
        setHabitJournalAiReply(data.message)
        setHabitJournalText('')
        setJournalView('today')
        fetchJournalEntries(user.id)
      }
    } catch {}
    setHabitJournalSending(false)
  }

  const addHabit = async () => {
    if (!newHabitName.trim() || addingHabit) return
    setAddingHabit(true)
    try {
      const res = await loggedFetch('/api/habits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name: newHabitName.trim(), habit_type: newHabitType, frequency: newHabitFrequency })
      })
      const data = await res.json()
      if (data.habit) { setHabits(prev => [...prev, data.habit]); setNewHabitName(''); setNewHabitNote(''); setNewHabitType('build'); setNewHabitFrequency('daily'); setShowAddHabitOverlay(false) }
    } catch {}
    setAddingHabit(false)
  }

  const ff = "'Figtree',sans-serif"
  const sf = "'Sora',sans-serif"
  const journalStreak = getJournalStreak()
  const wordCount = habitJournalText.trim().split(/\s+/).filter(Boolean).length

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (habitsLoading) return (
    <div style={{ padding: '12px 14px', paddingBottom: 80 }}>
      {[1, 2].map(i => <div key={i} style={{ background: '#3E3228', borderRadius: 10, padding: 16, marginBottom: 8 }}><div style={{ height: 12, background: '#F5F0E310', borderRadius: 4, width: '60%', marginBottom: 8 }} /><div style={{ height: 10, background: '#F5F0E308', borderRadius: 4, width: '40%' }} /></div>)}
    </div>
  )
  if (habitsError) return (
    <div style={{ padding: '12px 14px', paddingBottom: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 24 }}>&#9888;&#65039;</span>
        <div style={{ fontSize: 14, color: '#F5F0E370', fontFamily: ff, marginTop: 8 }}>Couldn&apos;t load your data.</div>
        <div onClick={() => { setHabitsError(false); fetchHabits(user.id) }} style={{ marginTop: 10, padding: '8px 16px', background: '#FF6644', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer', display: 'inline-block' }}>Try again</div>
      </div>
    </div>
  )

  // ── HeatStrip component ──────────────────────────────────────────────────
  const HeatStrip = ({ heat, color }) => (
    <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
      {heat.map((filled, i) => (
        <div key={i} style={{ width: 14, height: 5, borderRadius: 2, background: filled ? color : '#F5F0E312' }} />
      ))}
    </div>
  )

  // ── BigCheck ─────────────────────────────────────────────────────────────
  const BigCheck = ({ done, color, onClick }) => (
    <div onClick={onClick} style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: done ? 'none' : `2px solid ${color}50`,
        background: done ? color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 12l5 5L19 7" /></svg>}
      </div>
    </div>
  )

  return (
    <>
      <div style={{ padding: '12px 14px', overflowY: 'auto', height: '100%', paddingBottom: 80, position: 'relative', filter: showAddHabitOverlay ? 'blur(8px)' : 'none', pointerEvents: showAddHabitOverlay ? 'none' : 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E3', fontFamily: ff }}>Habits</div>
            <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          </div>
          <div onClick={() => setShowAddHabitOverlay(true)} style={{
            display: 'flex', alignItems: 'center', gap: 3, padding: '10px 12px',
            background: '#FF664412', border: '1px solid #FF664425', borderRadius: 6, cursor: 'pointer'
          }}>
            <span style={{ fontSize: 14, color: '#FF6644', fontFamily: ff, fontWeight: 500 }}>+ Add</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ flex: 1, height: 6, background: '#F5F0E312', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${progressDenom > 0 ? (progressNumer / progressDenom) * 100 : 0}%`, height: '100%', background: allDone ? '#4CAF50' : '#FF6644', borderRadius: 3, transition: 'width .3s' }} />
          </div>
          <span style={{ fontFamily: sf, fontSize: 14, fontWeight: 600, color: allDone ? '#4CAF50' : '#F5F0E3' }}>{progressNumer}/{progressDenom}</span>
        </div>

        {/* Journal card */}
        <div style={{ background: '#3E3228', borderRadius: 10, padding: '12px 12px 10px', marginBottom: 10, borderLeft: '3px solid #3B8BD4' }}>
          {/* Collapsed header — always visible */}
          <div onClick={() => setHabitJournalExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <BigCheck done={journaledToday} color="#3B8BD4" onClick={e => e.stopPropagation()} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: ff, fontSize: 13, fontWeight: 500, color: journaledToday ? 'rgba(240,234,214,0.22)' : '#F0EAD6', textDecoration: journaledToday ? 'line-through' : 'none' }}>Journal</span>
                <span style={{ fontSize: 7, fontFamily: ff, fontWeight: 600, color: '#3B8BD4', background: 'rgba(59,139,212,0.15)', borderRadius: 4, padding: '1px 5px' }}>DAILY</span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(240,234,214,0.22)', fontFamily: ff, marginTop: 2 }}>
                {todayEntry
                  ? `Entry #${journalEntries.indexOf(todayEntry) + 1} \u00B7 ${(todayEntry.content || '').split(/\s+/).filter(Boolean).length} words \u00B7 ${new Date(todayEntry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                  : journaledToday ? 'Entry saved' : 'No entry yet today'
                }
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: sf, fontSize: 15, fontWeight: 700, color: '#3B8BD4', lineHeight: 1 }}>{journalStreak}</div>
              <div style={{ fontSize: 7, color: 'rgba(240,234,214,0.22)', fontFamily: ff }}>days</div>
            </div>
            <span style={{ fontSize: 14, color: '#F5F0E340', transform: habitJournalExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>&#9662;</span>
          </div>

          {/* Heat strip */}
          <div style={{ display: 'flex', gap: 3, marginTop: 9 }}>
            {last7.map((ds, i) => {
              const done = journalEntries.some(e => e.created_at && e.created_at.slice(0, 10) === ds)
              return (
                <div key={i} style={{ flex: 1, height: 18, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'rgba(59,139,212,0.25)' : 'rgba(240,234,214,0.05)', border: done ? '1px solid rgba(59,139,212,0.40)' : '1px solid rgba(240,234,214,0.08)' }}>
                  {done && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3B8BD4' }} />}
                </div>
              )
            })}
          </div>

          {/* Expanded */}
          {habitJournalExpanded && (
            <div style={{ marginTop: 12 }}>
              {/* View toggle */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {['today', 'write'].map(v => (
                  <div key={v} onClick={() => setJournalView(v)} style={{
                    padding: '10px 12px', borderRadius: 6, fontSize: 14, fontFamily: ff, cursor: 'pointer',
                    background: journalView === v ? '#211A14' : 'transparent',
                    color: journalView === v ? '#F5F0E3' : '#F5F0E350',
                  }}>{v === 'today' ? "Today's entry" : 'Write new'}</div>
                ))}
              </div>

              {journalView === 'today' && todayEntry && (
                <div>
                  {/* Mood + meta */}
                  {todayEntry.mood && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#211A14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{todayEntry.mood}</div>
                      <span style={{ fontSize: 14, color: '#F5F0E340', fontFamily: ff }}>{new Date(todayEntry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} &middot; {(todayEntry.content || '').split(/\s+/).filter(Boolean).length} words</span>
                    </div>
                  )}
                  <div style={{ fontSize: 14, color: '#F5F0E390', fontFamily: ff, lineHeight: 1.65 }}>{todayEntry.content}</div>
                  {/* AI response */}
                  {(todayEntry.ai_response || habitJournalAiReply) && (
                    <div style={{ marginTop: 8, background: '#FF66440F', border: '1px solid #FF66441A', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 14, color: '#FF6644', fontFamily: ff, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>&#10022; Your coach</div>
                      <div style={{ fontSize: 14, color: '#F5F0E3', fontFamily: ff, lineHeight: 1.65 }}>{todayEntry.ai_response || habitJournalAiReply}</div>
                    </div>
                  )}
                </div>
              )}

              {journalView === 'today' && !todayEntry && (
                <div style={{ textAlign: 'center', padding: 16, fontSize: 14, color: '#F5F0E350', fontFamily: ff }}>No entry yet today. Switch to &quot;Write new&quot; to start.</div>
              )}

              {journalView === 'write' && (
                <div>
                  {/* Category buttons */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {['Personal', 'Work', 'Reflect'].map(cat => (
                      <div key={cat} onClick={() => setJournalCategory(journalCategory === cat ? null : cat)} style={{
                        padding: '10px 12px', borderRadius: 6, fontSize: 14, fontFamily: ff, cursor: 'pointer',
                        background: journalCategory === cat ? '#FF664420' : 'transparent',
                        color: journalCategory === cat ? '#FF6644' : '#F5F0E350',
                        border: journalCategory === cat ? '1px solid #FF664430' : '1px solid #F5F0E312'
                      }}>{cat}</div>
                    ))}
                  </div>

                  {/* Prompt suggestions */}
                  {journalCategory && !habitJournalText && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                      {(journalCategory === 'Personal' ? ["What's on my mind", "What I'm grateful for", "How I'm feeling"]
                        : journalCategory === 'Work' ? ["What went well today", "What was hard", "What I learned"]
                        : ["What I need tomorrow", "What I'd change about today", "A pattern I noticed"]
                      ).map(p => (
                        <div key={p} onClick={() => setHabitJournalText(p + ': ')} style={{
                          padding: '8px 10px', background: '#211A14', borderRadius: 6,
                          fontSize: 14, color: '#F5F0E370', fontFamily: ff, cursor: 'pointer'
                        }}>{p}</div>
                      ))}
                    </div>
                  )}

                  {/* Textarea */}
                  <textarea
                    placeholder="What's on your mind today?"
                    value={habitJournalText}
                    onChange={e => setHabitJournalText(e.target.value)}
                    rows={4}
                    style={{
                      width: '100%', minHeight: 120, background: '#211A14', border: '1px solid #F5F0E318',
                      borderRadius: 10, padding: '10px 14px', color: '#F5F0E3', fontSize: 14, fontFamily: ff,
                      lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    }}
                  />

                  {/* Mood picker */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {MOOD_EMOJIS.map(emoji => (
                      <div key={emoji} onClick={() => setHabitJournalMood(m => m === emoji ? null : emoji)} style={{
                        width: 44, height: 44, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, cursor: 'pointer',
                        border: habitJournalMood === emoji ? '1.5px solid #FF6644' : '1.5px solid transparent',
                        background: habitJournalMood === emoji ? '#FF664412' : 'transparent',
                      }}>{emoji}</div>
                    ))}
                  </div>

                  {/* Footer row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ fontSize: 14, color: '#F5F0E340', fontFamily: ff }}>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
                    <div onClick={sendHabitJournal} style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, fontFamily: ff, cursor: 'pointer',
                      background: habitJournalText.trim() ? '#FF6644' : '#F5F0E310',
                      color: habitJournalText.trim() ? '#F5F0E3' : '#F5F0E340',
                      opacity: habitJournalSending ? 0.6 : 1,
                    }}>{habitJournalSending ? 'Thinking\u2026' : 'Save entry'}</div>
                  </div>

                  {/* AI reply */}
                  {habitJournalAiReply && (
                    <div style={{ marginTop: 10, background: '#FF66440F', border: '1px solid #FF66441A', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 14, color: '#FF6644', fontFamily: ff, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>&#10022; Your coach</div>
                      <div style={{ fontSize: 14, color: '#F5F0E3', fontFamily: ff, lineHeight: 1.65 }}>{habitJournalAiReply}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Previous entries */}
              {journalEntries.length > 1 && (
                <div style={{ marginTop: 12 }}>
                  <div onClick={() => setShowPreviousEntries(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <span style={{ fontSize: 14, color: '#F5F0E340', fontFamily: ff, textTransform: 'uppercase', letterSpacing: '0.06em' }}>PREVIOUS</span>
                    <span style={{ fontSize: 14, color: '#F5F0E340', transform: showPreviousEntries ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>&#9662;</span>
                  </div>
                  {showPreviousEntries && journalEntries.filter(e => e.created_at && e.created_at.slice(0, 10) !== todayDateStr).slice(0, 3).map(entry => (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F5F0E308' }}>
                      {entry.mood && <span style={{ fontSize: 14 }}>{entry.mood}</span>}
                      <span style={{ fontSize: 14, color: '#F5F0E340', fontFamily: ff, flexShrink: 0 }}>{new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <span style={{ fontSize: 14, color: '#F5F0E360', fontFamily: ff, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{(entry.content || '').slice(0, 60)}</span>
                      <span style={{ fontSize: 14, color: '#F5F0E330', fontFamily: ff, flexShrink: 0 }}>{(entry.content || '').split(/\s+/).filter(Boolean).length}w</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Habit cards */}
        {habitsLoaded && habits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <span style={{ fontSize: 24 }}>&#128293;</span>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#F5F0E3', fontFamily: ff, marginTop: 8 }}>Build your first habit</div>
            <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff, marginTop: 4 }}>Small streaks compound. Start with one.</div>
            <div onClick={() => setShowAddHabitOverlay(true)} style={{ marginTop: 12, padding: '8px 16px', background: '#FF6644', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer', display: 'inline-block' }}>+ Add habit</div>
          </div>
        ) : (
          habits.map(habit => {
            const done = completedTodayIds.has(habit.id)
            const heat = getHabitHeat(habit.id)
            const streak = getHabitStreak(habit.id)
            const isBreak = habit.habit_type === 'break'
            const color = isBreak ? '#E8321A' : '#4CAF50'
            return (
              <div key={habit.id} style={{ background: '#3E3228', borderRadius: 10, padding: '12px 12px 10px', marginBottom: 6, borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BigCheck done={done} color={color} onClick={() => toggleHabit(habit.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: ff, fontSize: 14, fontWeight: 500, color: done ? '#F5F0E350' : '#F5F0E3', textDecoration: done ? 'line-through' : 'none' }}>{habit.name}</div>
                    {habit.description && <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff, marginTop: 2 }}>{habit.description}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: sf, fontSize: 14, fontWeight: 600, color }}>{streak}</div>
                    <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff }}>{isBreak ? 'clean' : 'days'}</div>
                  </div>
                </div>
                <HeatStrip heat={heat} color={color} />
              </div>
            )
          })
        )}
      </div>

      {/* ADD HABIT OVERLAY */}
      {showAddHabitOverlay && (
        <div style={{ position: 'absolute', inset: 0, background: '#211A14', overflowY: 'auto', padding: '12px 14px 20px', zIndex: 20 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E3', fontFamily: ff }}>New habit</span>
            <div onClick={() => setShowAddHabitOverlay(false)} style={{ padding: '6px 14px', background: '#FF6644', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer' }}>Close</div>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <div onClick={() => setNewHabitType('build')} style={{
              flex: 1, padding: '10px 0', textAlign: 'center', borderRadius: 8, cursor: 'pointer', fontFamily: ff, fontSize: 14,
              background: newHabitType === 'build' ? '#3E3228' : 'transparent',
              color: newHabitType === 'build' ? '#4CAF50' : '#F5F0E350',
              border: newHabitType === 'build' ? '1px solid #4CAF5030' : '1px solid #F5F0E312',
            }}>&#127793; Build</div>
            <div onClick={() => setNewHabitType('break')} style={{
              flex: 1, padding: '10px 0', textAlign: 'center', borderRadius: 8, cursor: 'pointer', fontFamily: ff, fontSize: 14,
              background: newHabitType === 'break' ? '#3E3228' : 'transparent',
              color: newHabitType === 'break' ? '#E8321A' : '#F5F0E350',
              border: newHabitType === 'break' ? '1px solid #E8321A30' : '1px solid #F5F0E312',
            }}>&#128683; Break</div>
          </div>
          <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff, marginBottom: 14, lineHeight: 1.5 }}>
            {newHabitType === 'build' ? 'Something you want to do every day.' : 'Something you want to stop doing.'}
          </div>

          {/* Name input */}
          <input
            placeholder="e.g. Drink 8 glasses of water"
            value={newHabitName}
            onChange={e => setNewHabitName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newHabitName.trim() && !addingHabit) addHabit() }}
            autoFocus
            style={{
              width: '100%', background: '#3E3228', border: '1px solid #F5F0E318', borderRadius: 10,
              padding: '12px 14px', color: '#F5F0E3', fontSize: 14, fontFamily: ff, outline: 'none', boxSizing: 'border-box', marginBottom: 8,
            }}
          />
          {/* Note input */}
          <input
            placeholder="Note (optional)"
            value={newHabitNote}
            onChange={e => setNewHabitNote(e.target.value)}
            style={{
              width: '100%', background: '#3E3228', border: '1px solid #F5F0E318', borderRadius: 10,
              padding: '12px 14px', color: '#F5F0E3', fontSize: 14, fontFamily: ff, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
            }}
          />

          {/* Frequency chips */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {['daily', 'weekdays', '3x/week'].map(f => (
              <div key={f} onClick={() => setNewHabitFrequency(f)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 14, fontFamily: ff, cursor: 'pointer',
                background: newHabitFrequency === f ? '#FF664420' : 'transparent',
                color: newHabitFrequency === f ? '#FF6644' : '#F5F0E350',
                border: newHabitFrequency === f ? '1px solid #FF664430' : '1px solid #F5F0E312',
              }}>{f.charAt(0).toUpperCase() + f.slice(1)}</div>
            ))}
          </div>

          {/* Submit */}
          <div onClick={addHabit} style={{
            padding: '12px 0', textAlign: 'center', borderRadius: 10, fontSize: 14, fontWeight: 500, fontFamily: ff, cursor: 'pointer',
            background: newHabitType === 'build' ? '#4CAF50' : '#E8321A',
            color: '#F5F0E3',
            opacity: addingHabit || !newHabitName.trim() ? 0.5 : 1,
          }}>{addingHabit ? 'Adding\u2026' : 'Add habit'}</div>
        </div>
      )}
    </>
  )
}
