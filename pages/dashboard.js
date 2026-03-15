import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Dashboard.module.css'

const NAV_ITEMS = [
  { id: 'tasks', label: 'Tasks', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )},
  { id: 'checkin', label: 'Check-in', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )},
  { id: 'calendar', label: 'Calendar', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )},
  { id: 'journal', label: 'Journal', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
    </svg>
  )},
]

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [activeTab, setActiveTab] = useState('tasks')

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
    })
  }, [])

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
    else router.push('/onboarding')
  }

  const fetchTasks = async (userId) => {
    const { data } = await supabase
      .from('tasks').select('*').eq('user_id', userId).eq('archived', false)
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
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

  return (
    <>
      <Head><title>Dashboard — FocusBuddy</title></Head>
      <div className={styles.appShell}>

        {/* LEFT SIDEBAR — desktop only */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarLogo}>
            <span className="brand"><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
          </div>
          <nav className={styles.sidebarNav}>
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`${styles.sidebarNavItem} ${activeTab === item.id ? styles.sidebarNavItemActive : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.sidebarFooter}>
            <span className={styles.sidebarEmail}>{user?.email}</span>
            <button onClick={handleSignOut} className={styles.signOutBtn}>Sign out</button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className={styles.main}>

          {/* TASKS VIEW */}
          {activeTab === 'tasks' && (
            <div className={styles.view}>
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
            </div>
          )}

          {/* CHECK-IN VIEW */}
          {activeTab === 'checkin' && (
            <div className={styles.view}>
              <div className={styles.header}>
                <h1 className={styles.greetingText}>Check-in</h1>
                <p className={styles.headerSub}>Your daily coaching conversation.</p>
              </div>
              <div className={styles.stubCard}>
                <div className={styles.stubIcon}>💬</div>
                <p className={styles.stubText}>Daily check-in coming soon.</p>
                <p className={styles.stubSubtext}>This is where FocusBuddy will meet you each morning — brief, personal, and task-aware.</p>
              </div>
            </div>
          )}

          {/* CALENDAR VIEW */}
          {activeTab === 'calendar' && (
            <div className={styles.view}>
              <div className={styles.header}>
                <h1 className={styles.greetingText}>Calendar</h1>
                <p className={styles.headerSub}>Your schedule, your way.</p>
              </div>
              <div className={styles.stubCard}>
                <div className={styles.stubIcon}>📅</div>
                <p className={styles.stubText}>Calendar coming soon.</p>
                <p className={styles.stubSubtext}>An internal calendar — no Google auth required. Schedule tasks, set reminders, see your week at a glance.</p>
              </div>
            </div>
          )}

          {/* JOURNAL VIEW */}
          {activeTab === 'journal' && (
            <div className={styles.view}>
              <div className={styles.header}>
                <h1 className={styles.greetingText}>Journal</h1>
                <p className={styles.headerSub}>Your private reflection space.</p>
              </div>
              <div className={styles.stubCard}>
                <div className={styles.stubIcon}>📓</div>
                <p className={styles.stubText}>Journal coming soon.</p>
                <p className={styles.stubSubtext}>A private space to think out loud — no structure required. Brain dump, reflect, or just write.</p>
              </div>
            </div>
          )}

        </main>

        {/* BOTTOM NAV — mobile only */}
        <nav className={styles.bottomNav}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`${styles.bottomNavItem} ${activeTab === item.id ? styles.bottomNavItemActive : ''}`}
            >
              <span className={styles.bottomNavIcon}>{item.icon}</span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </button>
          ))}
        </nav>

      </div>
    </>
  )
}
