import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Upgrade.module.css'

const CINIS_MARK = <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
  <polygon points="32,2 56,15 56,43 32,56 8,43 8,15" fill="none" stroke="#FF6644" strokeWidth="1.1" opacity="0.45"/>
  <path d="M 12.63,14.56 L 29.37,5.44 Q 32,4 34.63,5.44 L 51.37,14.56 Q 54,16 54,19 L 54,39 Q 54,42 51.37,43.44 L 34.63,52.56 Q 32,54 29.37,52.56 L 12.63,43.44 Q 10,42 10,39 L 10,19 Q 10,16 12.63,14.56 Z" fill="#FF6644"/>
  <path d="M 14.9,16.1 L 29.8,7.8 Q 32,6.6 34.2,7.8 L 49.1,16.1 Q 51.4,17.4 51.4,20 L 51.4,38 Q 51.4,40.6 49.1,41.9 L 34.2,50.2 Q 32,51.4 29.8,50.2 L 14.9,41.9 Q 12.6,40.6 12.6,38 L 12.6,20 Q 12.6,17.4 14.9,16.1 Z" fill="#120704"/>
  <polygon points="32,14 46,22 46,40 32,48 18,40 18,22" fill="#5A1005"/>
  <polygon points="32,20 42,26 42,40 32,45 22,40 22,26" fill="#A82010"/>
  <polygon points="32,26 38,29 38,40 32,43 26,40 26,29" fill="#E8321A"/>
  <polygon points="32,29 45,40 40,43 32,47 24,43 19,40" fill="#FF6644" opacity="0.92"/>
  <polygon points="32,33 41,40 38,42 32,45 26,42 23,40" fill="#FFD0C0" opacity="0.76"/>
  <polygon points="32,36 37,40 36,41 32,43 28,41 27,40" fill="#FFF0EB" opacity="0.60"/>
</svg>

const PRICE_IDS = {
  monthly: 'price_1TCRi82OSKmsLrz4fKxjcqyt',
  yearly: 'price_1TCmBd2OSKmsLrz4A9AJ7qC9',
}

export default function Upgrade() {
  const router = useRouter()
  const [status, setStatus] = useState('loading') // 'loading' | 'error'
  const [error, setError] = useState(null)

  const initiateCheckout = async (priceId) => {
    try {
      setStatus('loading')
      setError(null)
      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_id: priceId }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout session')
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Something went wrong')
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    const plan = router.query.plan || 'monthly'
    const priceId = PRICE_IDS[plan]
    if (!priceId) {
      setStatus('error')
      setError('Invalid plan')
      return
    }
    const timer = setTimeout(() => {
      initiateCheckout(priceId)
    }, 300)
    return () => clearTimeout(timer)
  }, [router.isReady, router.query.plan])

  return (
    <>
      <Head>
        <title>Upgrade to Pro — Cinis</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.content}>
          <div className={styles.mark}>{CINIS_MARK}</div>
          <div className={styles.wordmark}>CINIS</div>
          <p className={styles.statusText}>
            {status === 'loading' ? 'Setting up your Pro account...' : 'Something went wrong.'}
          </p>
          {status === 'loading' && (
            <div className={styles.dots}>
              <div className={`${styles.dot} ${styles.dot1}`} />
              <div className={`${styles.dot} ${styles.dot2}`} />
              <div className={`${styles.dot} ${styles.dot3}`} />
            </div>
          )}
          {status === 'error' && (
            <button
              onClick={() => {
                const plan = router.query.plan || 'monthly'
                const priceId = PRICE_IDS[plan]
                initiateCheckout(priceId)
              }}
              className={styles.retryBtn}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </>
  )
}
