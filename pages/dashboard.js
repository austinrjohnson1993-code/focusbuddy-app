import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Dashboard.module.css'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [greeting, setGreeting] = useState('')

  // Check-in state
  const [checkinComplete, setCheckinComplete] = useState(false)
  const [checkinMessages, setCheckinMessages] = useState([])
  const [checkinInput, setCheckinInput] = useState('')
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [checkinStarted, setCheckinStarted] = useState(false)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      fetchProfile(session.user.id)
      fetchTasks(session.user.id)

      // Check if check-in already done this session
      const done = sessionStorage.getItem('checkin_done')
      if (done) setCheckinComplete(true)
    })
  }, [])

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
    else router.push('/onboarding')
  }

  const fetchTasks = async (userId) => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  // Start check-in with opening message from FocusBuddy
  useEffect(() => {
    if (!loading && !checkinComplete && profile && !checkinStarted) {
      setCheckinStarted(true)
      openCheckin()
    }
  }, [loading, checkinComplete, profile])

  const openCheckin = async () => {
    setCheckinLoading(true)
    const firstName = profile?.full_name?.split(' ')[0] || 'there'
    const pendingCount = tasks.filter(t => !t.completed).length

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hey, I just opened the app.' }],
          userName: firstName,
          taskCount: pendingCount
        })
      })
      const data = await res.json()
      setCheckinMessages([
        { role: 'assistant', content: data.message }
      ])
    } catch (err) {
      setCheckinMessages([
        { role: 'assistant', content: `Hey ${profile?.full_name?.split(' ')[0] || 'there'} — good to see you. How are you feeling right now?` }
      ])
    }
    setCheckinLoading(false)
  }

  const sendCheckinMessage = async (e) => {
    e.preventDefault()
    if (!checkinInput.trim() || checkinLoading) return

    const userMessage = { role: 'user', content: checkinInput.trim() }
    const updatedMessages = [...checkinMessages, userMessage]
    setCheckinMessages(updatedMessages)
    setCheckinInput('')
    setCheckinLoading(true)

    const firstName = profile?.full_name?.split(' ')[0] || 'there'
    const pendingCount = tasks.filter(t => !t.completed).length

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          userName: firstName,
          taskCount: pendingCount
        })
      })
      const data = await res.json()
      setCheckinMessages([...updatedMessages, { role: 'assistant', content: data.message }])
    } catch (err) {
      setCheckinMessages([...updatedMessages, { role: 'assistant', content: "I'm here. Take your time." }])
    }
    setCheckinLoading(false)
  }

  const completeCheckin = () => {
    sessionStorage.setItem('checkin_done', 'true')
    setCheckinComplete(true)
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!newTask.trim() || !user) return
    setAdding(true)
    const task = {
      user_id: user.id,
      title: newTask.trim(),
      completed: false,
      archived: false,
      created_at: new Date().toISOString(),
      scheduled_for: new Date().toISOString()
    }
    const { data } = await supabase.from('tasks').insert(task).select().single()
    if (data) setTasks([data, ...tasks])
    setNewTask('')
    setAdding(false)
  }

  const toggleTask = async (task) => {
    const updated = { ...task, completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null }
    await supabase.from('tasks').update({ completed: updated.completed, completed_at: updated.completed_at }).eq('id', task.id)
    setTasks(tasks.map(t => t.id === task.id ? updated : t))
  }

  const rescheduleTask = async (task) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const updated = { ...task, scheduled_for: tomorrow.toISOString() }
    await supabase.from('tasks').update({ scheduled_for: updated.scheduled_for }).eq('id', task.id)
    setTasks(tasks.map(t => t.id === task.id ? updated : t))
  }

  const archiveTask = async (task) => {
    await supabase.from('tasks').update({ archived: true }).eq('id', task.id)
    setTasks(tasks.filter(t => t.id !== task.id))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const pendingTasks = tasks.filter(t => !t.completed)
  const completedTasks = tasks.filter(t => t.completed)
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  if (loading) return (
    <div className={styles.loadingPage}>
      <span className="brand"><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
    </div>
  )

  // CHECK-IN SCREEN
  if (!checkinComplete) {
    return (
      <>
        <Head><title>Dashboard — FocusBuddy</title></Head>
        <div className={styles.page}>
          <nav className={styles.nav}>
            <a href="/" className={styles.navLogo}>
              <span className="brand"><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
            </a>
            <div className={styles.navRight}>
              <button onClick={handleSignOut} className={styles.signOutBtn}>Sign out</button>
            </div>
          </nav>

          <main className={styles.checkinMain}>
            <div className={styles.checkinCard}>
              <div className={styles.checkinMessages}>
                {checkinLoading && checkinMessages.length === 0 && (
                  <div className={styles.checkinBubbleAssistant}>
                    <span className={styles.typingDots}>···</span>
                  </div>
                )}
                {checkinMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={msg.role === 'assistant' ? styles.checkinBubbleAssistant : styles.checkinBubbleUser}
                  >
                    {msg.content}
                  </div>
                ))}
                {checkinLoading && checkinMessages.length > 0 && (
                  <div className={styles.checkinBubbleAssistant}>
                    <span className={styles.typingDots}>···</span>
                  </div>
                )}
              </div>

              {checkinMessages.length >= 2 && (
                <button onClick={completeCheckin} className={styles.checkinSkip}>
                  Let's go →
                </button>
              )}

              <form onSubmit={sendCheckinMessage} className={styles.checkinForm}>
                <input
                  type="text"
                  placeholder="How are you doing..."
                  value={checkinInput}
                  onChange={e => setCheckinInput(e.target.value)}
                  className={styles.checkinInput}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={checkinLoading || !checkinInput.trim()}
                  className={styles.checkinSendBtn}
                >
                  →
                </button>
              </form>

              <button onClick={completeCheckin} className={styles.checkinSkipSmall}>
                Skip to my tasks
              </button>
            </div>
          </main>
        </div>
      </>
    )
  }

  // MAIN DASHBOARD
  return (
    <>
      <Head><title>Dashboard — FocusBuddy</title></Head>
      <div className={styles.page}>
        <nav className={styles.nav}>
          <a href="/" className={styles.navLogo}>
            <span className="brand"><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
          </a>
          <div className={styles.navRight}>
            <span className={styles.navEmail}>{user?.email}</span>
            <button onClick={handleSignOut} className={styles.signOutBtn}>Sign out</button>
          </div>
        </nav>

        <main className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.greetingText}>
              {greeting}, <span className={styles.name}>{firstName}.</span>
            </h1>
            <p className={styles.headerSub}>
              {pendingTasks.length === 0
                ? "You're all caught up. Seriously — well done."
                : `You have ${pendingTasks.length} thing${pendingTasks.length !== 1 ? 's' : ''} on your list today.`
              }
            </p>
          </div>

          <form onSubmit={addTask} className={styles.addForm}>
            <input
              type="text"
              placeholder="What do you need to do today?"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              className={styles.addInput}
            />
            <button type="submit" disabled={adding || !newTask.trim()} className={styles.addBtn}>
              {adding ? '...' : '+ Add'}
            </button>
          </form>

          <div className={styles.taskSection}>
            {pendingTasks.length === 0 && completedTasks.length === 0 && (
              <div className={styles.emptyState}>
                <p>Nothing on your list yet.</p>
                <p className={styles.emptySubtext}>Add your first task above — even something small counts.</p>
              </div>
            )}

            {pendingTasks.length > 0 && (
              <div className={styles.taskGroup}>
                <div className={styles.taskGroupLabel}>To do</div>
                {pendingTasks.map(task => (
                  <div key={task.id} className={styles.taskCard}>
                    <button onClick={() => toggleTask(task)} className={styles.taskCheck} />
                    <span className={styles.taskTitle}>{task.title}</span>
                    <div className={styles.taskActions}>
                      <button onClick={() => rescheduleTask(task)} className={styles.taskAction} title="Reschedule for tomorrow">↷</button>
                      <button onClick={() => archiveTask(task)} className={styles.taskActionDelete} title="Remove">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className={styles.taskGroup}>
                <div className={styles.taskGroupLabel}>Completed today</div>
                {completedTasks.map(task => (
                  <div key={task.id} className={`${styles.taskCard} ${styles.taskDone}`}>
                    <button onClick={() => toggleTask(task)} className={`${styles.taskCheck} ${styles.taskCheckDone}`}>✓</button>
                    <span className={styles.taskTitleDone}>{task.title}</span>
                    <button onClick={() => archiveTask(task)} className={styles.taskActionDelete} title="Remove">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
