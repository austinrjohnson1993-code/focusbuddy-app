import { useState } from 'react'
import styles from '../../styles/Landing.module.css'

export default function WaitlistForm({ layout = 'stacked' }) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.includes('@')) { setError('Please enter a valid email'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Try again.')
      }
    } catch {
      setError('Network error. Try again.')
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className={styles.waitlistSuccess}>
        <div className={styles.waitlistSuccessHeadline}>You&apos;re on the list. 🔥</div>
        <div className={styles.waitlistSuccessSub}>We launch April 14. You&apos;ll hear from us that morning.</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={styles.waitlistForm}>
      <div className={styles.waitlistInputRow}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={styles.waitlistInput}
          required
          autoComplete="email"
        />
        <input
          type="tel"
          placeholder="Phone"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className={styles.waitlistInput}
          autoComplete="tel"
        />
      </div>
      {error && <div className={styles.waitlistError}>{error}</div>}
      <button
        type="submit"
        disabled={loading || !email.includes('@')}
        className={styles.waitlistBtn}
      >
        {loading ? 'Joining...' : 'Get early access'}
      </button>
      <p className={styles.waitlistMicro}>Free to start. No credit card.</p>
    </form>
  )
}
