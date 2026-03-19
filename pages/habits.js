import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import styles from '../styles/Habits.module.css'

const BRAND_COLORS = ['#E8321A', '#F07D3A', '#2D6BE4', '#22A66E', '#9B59B6', '#E8B31A']

export default function Habits() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // New habit form state
  const [newName, setNewName] = useState('')
  const [newFrequency, setNewFrequency] = useState('daily')
  const [newColor, setNewColor] = useState('#E8321A')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      fetchHabits(session.user.id)
    })
  }, [])

  async function fetchHabits(userId) {
    setLoading(true)
    const res = await fetch(`/api/habits?userId=${userId}`)
    if (res.ok) {
      const data = await res.json()
      setHabits(data.habits || [])
    }
    setLoading(false)
  }

  async function createHabit(e) {
    e.preventDefault()
    if (!newName.trim() || !user) return
    setSaving(true)
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, name: newName, frequency: newFrequency, color: newColor }),
    })
    if (res.ok) {
      const data = await res.json()
      setHabits(prev => [...prev, data.habit])
      setShowModal(false)
      setNewName('')
      setNewFrequency('daily')
      setNewColor('#E8321A')
    }
    setSaving(false)
  }

  async function toggleCompletion(habitId) {
    if (!user) return
    const res = await fetch('/api/habits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, habitId }),
    })
    if (res.ok) {
      const data = await res.json()
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, completedToday: data.completedToday } : h))
    }
  }

  return (
    <>
      <Head>
        <title>Habits — Cinis</title>
      </Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>← Dashboard</button>
          <h1 className={styles.title}>Habits</h1>
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>+ Add habit</button>
        </header>

        <main className={styles.main}>
          {loading ? (
            <p className={styles.loading}>Loading...</p>
          ) : habits.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyIcon}>🔥</p>
              <p className={styles.emptyText}>No habits yet.</p>
              <p className={styles.emptySub}>Add your first one to start building momentum.</p>
              <button className={styles.emptyAddBtn} onClick={() => setShowModal(true)}>Add your first habit</button>
            </div>
          ) : (
            <div className={styles.habitList}>
              {habits.map(habit => (
                <div key={habit.id} className={styles.habitCard} style={{ borderLeftColor: habit.color }}>
                  <div className={styles.habitInfo}>
                    <span className={styles.habitName}>{habit.name}</span>
                    <span className={styles.habitFreq}>{habit.frequency}</span>
                  </div>
                  <div className={styles.habitRight}>
                    <span className={styles.streakBadge}>🔥 0</span>
                    <button
                      className={`${styles.completionCircle} ${habit.completedToday ? styles.completed : ''}`}
                      onClick={() => toggleCompletion(habit.id)}
                      title={habit.completedToday ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {habit.completedToday ? '✓' : ''}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {showModal && (
          <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>New Habit</h2>
              <form onSubmit={createHabit} className={styles.form}>
                <label className={styles.label}>Name</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Morning walk"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                  required
                />

                <label className={styles.label}>Frequency</label>
                <select className={styles.select} value={newFrequency} onChange={e => setNewFrequency(e.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>

                <label className={styles.label}>Color</label>
                <div className={styles.colorPicker}>
                  {BRAND_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`${styles.colorSwatch} ${newColor === c ? styles.colorSwatchActive : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewColor(c)}
                    />
                  ))}
                </div>

                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className={styles.saveBtn} disabled={saving || !newName.trim()}>
                    {saving ? 'Saving...' : 'Add Habit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
