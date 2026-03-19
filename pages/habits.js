import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import styles from '../styles/Dashboard.module.css'
import { ArrowLeft, Flame } from 'lucide-react'

export default function Habits() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitFreq, setNewHabitFreq] = useState('daily')
  const [newHabitColor, setNewHabitColor] = useState('#E8321A')
  const [toastMsg, setToastMsg] = useState('')

  const colorOptions = ['#E8321A', '#FF6644', '#A82010', '#5A1005', '#F0EAD6', '#2A1810']

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      fetchHabits(user.id)
    }
    checkAuth()
  }, [])

  const fetchHabits = async (userId) => {
    setLoading(true)
    const res = await fetch(`/api/habits?userId=${userId}`)
    if (res.ok) {
      const { habits } = await res.json()
      setHabits(habits || [])
    }
    setLoading(false)
  }

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  const handleAddHabit = async (e) => {
    e.preventDefault()
    if (!newHabitName.trim() || !user) return

    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        name: newHabitName.trim(),
        frequency: newHabitFreq,
        color: newHabitColor,
      }),
    })

    if (res.ok) {
      const { habit } = await res.json()
      setHabits(prev => [habit, ...prev])
      setNewHabitName('')
      setNewHabitFreq('daily')
      setNewHabitColor('#E8321A')
      setShowAddModal(false)
      showToast('Habit added!')
    } else {
      showToast('Failed to add habit')
    }
  }

  const toggleCompletion = async (habitId, currentState) => {
    if (!user) return

    const res = await fetch('/api/habits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        habitId: habitId,
      }),
    })

    if (res.ok) {
      const { completedToday } = await res.json()
      setHabits(prev =>
        prev.map(h =>
          h.id === habitId ? { ...h, completedToday } : h
        )
      )
    }
  }

  return (
    <>
      <Head>
        <title>Habits — Cinis</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.view}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid rgba(240,234,214,0.1)' }}>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#F0EAD6', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={20} />
            </button>
            <h1 className={styles.greetingText}>Habits</h1>
          </div>

          {/* Add button */}
          <button onClick={() => setShowAddModal(true)} className={styles.addTaskBtn} style={{ marginBottom: '24px' }}>
            + Add habit
          </button>

          {/* Empty state */}
          {habits.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔥</div>
              <p className={styles.emptyText}>No habits yet.</p>
              <p className={styles.emptySubtext}>Start small. One habit changes everything.</p>
              <button onClick={() => setShowAddModal(true)} className={styles.emptyAddBtn}>
                Add your first habit
              </button>
            </div>
          )}

          {/* Habits list */}
          {habits.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {habits.map(habit => (
                <div
                  key={habit.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px',
                    background: 'rgba(255,102,68,0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,102,68,0.15)',
                  }}
                >
                  {/* Left content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#F0EAD6', marginBottom: '4px' }}>
                      {habit.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(240,234,214,0.5)', textTransform: 'capitalize' }}>
                        {habit.frequency}
                      </span>
                      {habit.streak > 0 && (
                        <span style={{ fontSize: '12px', color: '#FF6644' }}>
                          🔥 {habit.streak} day streak
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Completion circle */}
                  <button
                    onClick={() => toggleCompletion(habit.id, habit.completedToday)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: habit.completedToday ? 'none' : `2px solid rgba(240,234,214,0.3)`,
                      background: habit.completedToday ? '#E8321A' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 200ms ease',
                    }}
                  >
                    {habit.completedToday && (
                      <span style={{ fontSize: '18px' }}>✓</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add habit modal */}
        {showAddModal && (
          <div
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAddModal(false)
            }}
          >
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Add habit</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: 'none', color: '#F0EAD6', fontSize: '24px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAddHabit} style={{ padding: '20px' }}>
                {/* Name input */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Habit name</label>
                  <input
                    type="text"
                    placeholder="e.g. Meditate"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    required
                    className={styles.fieldInput}
                    autoFocus
                  />
                </div>

                {/* Frequency toggle */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Frequency</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['daily', 'weekly'].map(freq => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setNewHabitFreq(freq)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '6px',
                          border: newHabitFreq === freq ? '2px solid #FF6644' : '1px solid rgba(240,234,214,0.2)',
                          background: newHabitFreq === freq ? 'rgba(255,102,68,0.1)' : 'transparent',
                          color: '#F0EAD6',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                          fontWeight: newHabitFreq === freq ? 600 : 400,
                        }}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color swatches */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Color</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                    {colorOptions.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewHabitColor(color)}
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: '6px',
                          background: color,
                          border: newHabitColor === color ? '3px solid #F0EAD6' : 'none',
                          cursor: 'pointer',
                          transition: 'all 200ms ease',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Save button */}
                <button type="submit" className={styles.addTaskBtn} style={{ width: '100%', marginTop: '16px' }}>
                  Save habit
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Toast */}
        {toastMsg && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.8)',
            color: '#F0EAD6',
            padding: '12px 20px',
            borderRadius: '6px',
            fontSize: '14px',
            zIndex: 9999,
          }}>
            {toastMsg}
          </div>
        )}
      </div>
    </>
  )
}
