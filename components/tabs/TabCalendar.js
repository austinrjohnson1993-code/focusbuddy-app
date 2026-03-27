import React, { useState } from 'react'
import {
  localDateStr, todayStr, tomorrowStr,
  getTasksForDate, getTaskOccurrencesForMonth, fmtMoney,
} from './shared'

export default function TabCalendar({ user, profile, tasks = [], setTasks, showToast, switchTab, bills = [], loading, tasksError, setTasksError, setLoading, fetchTasks, setDetailTask, setNewDueDate, setShowAddModal }) {
  const [calMonth, setCalMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1) })
  const [calDay, setCalDay] = useState(null)
  const [calDayPanelOpen, setCalDayPanelOpen] = useState(false)

  // Calendar helpers
  function calTasksForDay(dStr) {
    const [y, m, d] = dStr.split('-').map(Number)
    return getTasksForDate(tasks, new Date(y, m - 1, d))
  }
  function calPrevMonth() { setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function calNextMonth() { setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  const todayDStr = todayStr()
  const year = calMonth.getFullYear()
  const month = calMonth.getMonth()
  const monthName = calMonth.toLocaleDateString('en-US', { month: 'long' })
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const monthOccurrences = getTaskOccurrencesForMonth(tasks, year, month)
  const billDueDays = {}
  ;(bills || []).forEach(b => {
    if (b.due_day) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(b.due_day).padStart(2, '0')}`
      if (!billDueDays[dStr]) billDueDays[dStr] = []
      billDueDays[dStr].push(b)
    }
  })

  // Upcoming — next 7 days
  const upStart = new Date(); upStart.setHours(0, 0, 0, 0)
  const upEnd = new Date(upStart); upEnd.setDate(upStart.getDate() + 7)
  const upcomingTasks = tasks
    .filter(t => !t.completed && !t.archived && t.scheduled_for)
    .filter(t => { const sf = new Date(t.scheduled_for); sf.setHours(0, 0, 0, 0); return sf >= upStart && sf <= upEnd })
    .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))
  const upcomingByDate = {}
  upcomingTasks.forEach(t => { const d = t.scheduled_for.slice(0, 10); if (!upcomingByDate[d]) upcomingByDate[d] = []; upcomingByDate[d].push(t) })
  const todayD = todayStr()
  const tomD = tomorrowStr()
  const fmtUpDate = (dStr) => {
    if (dStr === todayD) return 'Today'
    if (dStr === tomD) return 'Tomorrow'
    const [y, m, day] = dStr.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Upcoming bills in next 7 days
  const upcomingBills = (bills || []).filter(b => {
    if (!b.due_day) return false
    const billDate = new Date(year, month, b.due_day)
    return billDate >= upStart && billDate <= upEnd
  })

  // Day panel data
  const panelDayTasks = calDay ? calTasksForDay(localDateStr(calDay)) : []
  const panelScheduled = panelDayTasks.filter(t => t.due_time).sort((a, b) => new Date(a.due_time) - new Date(b.due_time))
  const panelUnscheduled = panelDayTasks.filter(t => !t.due_time)
  const panelBills = calDay ? (bills || []).filter(b => b.due_day === calDay.getDate()) : []
  const panelDayLabel = calDay ? calDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : ''
  const panelDayName = calDay ? calDay.toLocaleDateString('en-US', { weekday: 'long' }) : ''
  const panelIsToday = calDay && localDateStr(calDay) === todayDStr

  const ff = "'Figtree',sans-serif"
  const sf = "'Sora',sans-serif"

  if (loading) return (
    <div style={{ padding: '12px 14px', paddingBottom: 80, overflowY: 'auto', height: '100%' }}>
      <div style={{ background: '#3E3228', borderRadius: 10, padding: 20, marginBottom: 14 }}>
        <div style={{ height: 14, background: '#F5F0E310', borderRadius: 4, marginBottom: 8, width: '60%' }} />
        <div style={{ height: 100, background: '#F5F0E308', borderRadius: 6 }} />
      </div>
    </div>
  )

  if (tasksError) return (
    <div style={{ padding: '12px 14px', paddingBottom: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 24 }}>&#9888;&#65039;</span>
        <div style={{ fontSize: 14, color: '#F5F0E370', fontFamily: ff, marginTop: 8 }}>Couldn&apos;t load your data.</div>
        <div onClick={() => { if (setTasksError) setTasksError(false); if (setLoading) setLoading(true); if (fetchTasks) fetchTasks(user.id) }} style={{ marginTop: 10, padding: '8px 16px', background: '#FF6644', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer', display: 'inline-block' }}>Try again</div>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', overflowY: 'auto', height: '100%', paddingBottom: 80 }}>

        {/* Month grid card */}
        <div style={{ background: '#3E3228', borderRadius: 10, padding: '10px 10px 8px', marginBottom: 14 }}>
          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div onClick={calPrevMonth} style={{ padding: 6, cursor: 'pointer', color: '#F5F0E370', fontSize: 16 }}>&#8249;</div>
            <div style={{ fontFamily: ff, fontSize: 15, fontWeight: 600, color: '#F5F0E3' }}>{monthName} {year}</div>
            <div onClick={calNextMonth} style={{ padding: 6, cursor: 'pointer', color: '#F5F0E370', fontSize: 16 }}>&#8250;</div>
          </div>
          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} style={{ fontSize: 14, color: '#F5F0E340', fontFamily: ff, textAlign: 'center', padding: '4px 0' }}>{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} style={{ height: 44 }} />
              const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayTaskList = monthOccurrences[dStr] || []
              const dayBillList = billDueDays[dStr] || []
              const isToday = dStr === todayDStr
              const isSelected = calDay && localDateStr(calDay) === dStr
              return (
                <div key={idx} onClick={() => { setCalDay(new Date(year, month, day)); setCalDayPanelOpen(true) }} style={{
                  height: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, cursor: 'pointer',
                  background: isToday ? '#FF66441F' : isSelected ? '#F5F0E30A' : 'transparent',
                }}>
                  <span style={{
                    fontSize: 14, fontFamily: ff,
                    fontWeight: isToday ? 600 : 400,
                    color: isToday ? '#FF6644' : '#F5F0E3',
                  }}>{day}</span>
                  <div style={{ display: 'flex', gap: 2, marginTop: 2, height: 3 }}>
                    {dayTaskList.length > 0 && <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#FF6644' }} />}
                    {dayBillList.length > 0 && <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#E8321A' }} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Coming up section */}
        <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#F5F0E350', fontFamily: ff, fontWeight: 500, marginBottom: 8 }}>Coming up</div>

        {Object.keys(upcomingByDate).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff }}>You&apos;re clear for the next 7 days.</div>
          </div>
        ) : (
          Object.entries(upcomingByDate).map(([dStr, dayList]) => (
            <div key={dStr}>
              <div style={{ fontSize: 14, fontWeight: 500, fontFamily: ff, padding: '6px 0 3px', color: dStr === todayD ? '#FF6644' : '#F5F0E370' }}>{fmtUpDate(dStr)}</div>
              {dayList.map(t => (
                <div key={t.id} onClick={() => setDetailTask && setDetailTask(t)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
                  background: '#3E3228', borderRadius: 8, marginBottom: 4, cursor: 'pointer'
                }}>
                  <div style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><div style={{ width: 17, height: 17, borderRadius: '50%', border: '1.5px solid #F5F0E350' }} /></div>
                  <span style={{ fontSize: 14, color: '#F5F0E3', fontFamily: ff, flex: 1 }}>{t.title}</span>
                  {t.due_time && <span style={{ fontSize: 14, color: '#F5F0E350', fontFamily: sf }}>{new Date(t.due_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                </div>
              ))}
            </div>
          ))
        )}

        {/* Upcoming bills */}
        {upcomingBills.length > 0 && upcomingBills.map(b => (
          <div key={b.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
            background: '#3E3228', borderRadius: 8, marginBottom: 4, borderLeft: '3px solid #E8321A'
          }}>
            <span style={{ fontSize: 14 }}>&#129534;</span>
            <span style={{ fontSize: 14, color: '#F5F0E3', fontFamily: ff, flex: 1 }}>{b.name}</span>
            <span style={{ fontSize: 14, color: '#F5F0E370', fontFamily: sf }}>{fmtMoney(b.amount)}</span>
          </div>
        ))}

      </div>

      {/* Day Panel bottom sheet */}
      {calDayPanelOpen && calDay && (
        <>
          <div onClick={() => setCalDayPanelOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9 }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
            background: '#3E3228', borderTop: '1px solid #F5F0E318',
            borderRadius: '16px 16px 0 0', padding: '12px 14px 20px',
            maxHeight: '60%', overflowY: 'auto',
          }}>
            {/* Handle */}
            <div style={{ width: 32, height: 3, borderRadius: 2, background: '#F5F0E325', margin: '0 auto 8px' }} />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: ff, fontSize: 14, fontWeight: 600, color: '#F5F0E3' }}>
                {panelDayLabel} &middot; {panelIsToday ? 'Today' : panelDayName}
              </div>
              <div onClick={() => setCalDayPanelOpen(false)} style={{ cursor: 'pointer', fontSize: 14, color: '#F5F0E350', padding: 4 }}>&#10005;</div>
            </div>

            {/* Timed tasks */}
            {panelScheduled.length > 0 && panelScheduled.map(t => (
              <div key={t.id} onClick={() => { if (setDetailTask) setDetailTask(t); setCalDayPanelOpen(false) }} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                background: '#211A14', borderRadius: 8, marginBottom: 4, cursor: 'pointer'
              }}>
                <span style={{ fontSize: 14, color: '#F5F0E350', fontFamily: sf, width: 52, flexShrink: 0 }}>
                  {new Date(t.due_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span style={{ fontSize: 14, color: '#F5F0E3', fontFamily: ff }}>{t.title}</span>
              </div>
            ))}

            {/* Unscheduled */}
            {panelUnscheduled.length > 0 && (
              <>
                <div style={{ fontSize: 14, color: '#F5F0E340', fontFamily: ff, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 0 4px' }}>Unscheduled</div>
                {panelUnscheduled.map(t => (
                  <div key={t.id} onClick={() => { if (setDetailTask) setDetailTask(t); setCalDayPanelOpen(false) }} style={{
                    padding: '8px 10px', background: '#211A14', borderRadius: 8, marginBottom: 4,
                    fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer'
                  }}>{t.title}</div>
                ))}
              </>
            )}

            {/* Bills */}
            {panelBills.length > 0 && (
              <>
                <div style={{ fontSize: 14, color: '#F5F0E340', fontFamily: ff, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 0 4px' }}>Bills Due</div>
                {panelBills.map(b => (
                  <div key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: '#211A14', borderRadius: 8, marginBottom: 4
                  }}>
                    <span style={{ fontSize: 14, color: '#E8321A', flexShrink: 0 }}>&#129534;</span>
                    <span style={{ fontSize: 14, color: '#F5F0E3', fontFamily: ff, flex: 1 }}>{b.name}</span>
                    <span style={{ fontSize: 14, color: '#F5F0E370', fontFamily: sf }}>{fmtMoney(b.amount)}</span>
                  </div>
                ))}
              </>
            )}

            {/* Empty */}
            {panelDayTasks.length === 0 && panelBills.length === 0 && (
              <div style={{ textAlign: 'center', padding: 16, fontSize: 14, color: '#F5F0E350', fontFamily: ff }}>Nothing scheduled</div>
            )}

            {/* Add task button */}
            <div onClick={() => {
              if (calDay && setNewDueDate) setNewDueDate(`${calDay.getFullYear()}-${String(calDay.getMonth() + 1).padStart(2, '0')}-${String(calDay.getDate()).padStart(2, '0')}`)
              setCalDayPanelOpen(false)
              if (setShowAddModal) setShowAddModal(true)
            }} style={{
              marginTop: 8, padding: '10px 0', textAlign: 'center',
              background: '#FF664412', border: '1px solid #FF664425', borderRadius: 8,
              fontSize: 14, color: '#FF6644', fontFamily: ff, fontWeight: 500, cursor: 'pointer'
            }}>+ Add task for this day</div>
          </div>
        </>
      )}
    </div>
  )
}
