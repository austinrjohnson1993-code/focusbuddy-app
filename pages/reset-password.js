import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import styles from '../styles/Auth.module.css'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Check if we have a valid session (user came from password reset email)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionReady(true)
      } else {
        setError('Invalid or expired reset link. Please request a new password reset.')
      }
    }
    if (router.isReady) {
      checkSession()
    }
  }, [router.isReady])

  const handleResetPassword = async (e) => {
    e.preventDefault()

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        setSuccess(true)
        setPassword('')
        setConfirm('')
        setLoading(false)
        // Redirect to login after success
        setTimeout(() => router.push('/login'), 2000)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password — Cinis</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.card}>

          <a href="/" className={styles.logoWrap}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true" className={styles.mark}>
              <rect width="30" height="30" rx="8" fill="#FF6644"/>
              <path d="M15 7s-6 5-6 9.5a6 6 0 0012 0C21 12 15 7 15 7z" fill="#211A14"/>
              <circle cx="15" cy="18" r="2.2" fill="#FF6644"/>
            </svg>
            <span className={styles.wordmark}>CINIS</span>
          </a>

          <p className={styles.tagline}>Where start meets finished.</p>

          {success ? (
            <div className={styles.success}>
              <div className={styles.successIcon}>✓</div>
              <p>Password updated successfully!</p>
              <p className={styles.successSub}>Redirecting to sign in...</p>
            </div>
          ) : (
            <>
              <h1 className={styles.heading}>Reset your password.</h1>
              <p className={styles.sub}>Enter your new password below.</p>

              {error && <div className={styles.error}>{error}</div>}

              {sessionReady && (
                <form onSubmit={handleResetPassword} className={styles.form}>
                  <input
                    type="password"
                    placeholder="New password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className={styles.input}
                  />
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    className={styles.input}
                  />
                  <button type="submit" disabled={loading} className={styles.submitBtn}>
                    {loading ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              )}

              <p className={styles.signupLink}>
                <a href="/login">Back to sign in</a>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
