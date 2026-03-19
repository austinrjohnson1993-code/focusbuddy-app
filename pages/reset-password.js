import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Auth.module.css'

const CinisMark = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <polygon points="32,2 56,15 56,43 32,56 8,43 8,15" fill="none" stroke="#FF6644" strokeWidth="1.1" opacity="0.45"/>
    <polygon points="32,4 54,16 54,42 32,54 10,42 10,16" fill="#FF6644"/>
    <polygon points="32,7 51,18 51,40 32,52 13,40 13,18" fill="#120704"/>
    <polygon points="32,14 46,22 46,40 32,48 18,40 18,22" fill="#5A1005"/>
    <polygon points="32,20 42,26 42,40 32,45 22,40 22,26" fill="#A82010"/>
    <polygon points="32,26 38,29 38,40 32,43 26,40 26,29" fill="#E8321A"/>
    <polygon points="32,29 45,40 40,43 32,47 24,43 19,40" fill="#FF6644" opacity="0.92"/>
    <polygon points="32,33 41,40 38,42 32,45 26,42 23,40" fill="#FFD0C0" opacity="0.76"/>
    <polygon points="32,36 37,40 36,41 32,43 28,41 27,40" fill="#FFF0EB" opacity="0.60"/>
  </svg>
)

function getPasswordStrength(pw) {
  if (pw.length < 8) return null
  const hasUpper = /[A-Z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  const hasSpecial = /[^A-Za-z0-9]/.test(pw)
  const score = (hasUpper ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0)
  if (pw.length >= 12 && score >= 2) return 'strong'
  if (score >= 1) return 'fair'
  return 'weak'
}

const strengthConfig = {
  weak:   { label: 'Weak',   color: '#e74c3c', width: '33%' },
  fair:   { label: 'Fair',   color: '#f39c12', width: '66%' },
  strong: { label: 'Strong', color: '#3ecf8e', width: '100%' },
}

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // PASSWORD_RECOVERY event fires when user lands here from the reset email link
      if (event === 'PASSWORD_RECOVERY') {
        // session is now active — form is already shown
      }
    })
    return () => subscription?.unsubscribe()
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    }
  }

  const strength = getPasswordStrength(password)
  const strengthCfg = strength ? strengthConfig[strength] : null

  return (
    <>
      <Head>
        <title>Set New Password — Cinis</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.card}>
          <a href="/" style={{ display: 'inline-block', marginBottom: '28px', lineHeight: 0, textDecoration: 'none' }}>
            <CinisMark size={40} />
          </a>

          <h1 className={styles.heading}>Set a new password.</h1>
          <p className={styles.sub}>Choose a strong password for your account.</p>

          {done ? (
            <div className={styles.success}>
              <div className={styles.successIcon}>✓</div>
              <p>Password set! Signing you in…</p>
            </div>
          ) : (
            <>
              {error && <div className={styles.error}>{error}</div>}

              <form onSubmit={handleReset} className={styles.form}>
                <div>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="New password (min 8 characters)"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className={styles.input}
                    />
                    <button
                      type="button"
                      className={styles.showHideBtn}
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {strengthCfg && (
                    <div className={styles.strengthWrap}>
                      <div className={styles.strengthBar}>
                        <div className={styles.strengthFill} style={{ width: strengthCfg.width, background: strengthCfg.color }} />
                      </div>
                      <span className={styles.strengthLabel} style={{ color: strengthCfg.color }}>{strengthCfg.label}</span>
                    </div>
                  )}
                </div>
                <div className={styles.passwordWrap}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.showHideBtn}
                    onClick={() => setShowConfirm(v => !v)}
                    tabIndex={-1}
                  >
                    {showConfirm ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                <button type="submit" disabled={loading} className={styles.submitBtn}>
                  {loading ? 'Saving…' : 'Set password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
