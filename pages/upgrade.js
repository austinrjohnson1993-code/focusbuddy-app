import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import styles from '../styles/Upgrade.module.css'

const CINIS_MARK = <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
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

export default function Upgrade() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', session.user.id)
          .single()
        setUser({
          id: session.user.id,
          subscription_tier: profile?.subscription_tier || 'free'
        })
      }
      setLoading(false)
    }
    checkAuth()
  }, [])

  const handleCheckout = async (plan) => {
    setCheckingOut(true)
    try {
      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: plan === 'monthly' ? 'price_1TCRi82OSKmsLrz4fKxjcqyt' : 'price_1TCmBd2OSKmsLrz4A9AJ7qC9'
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('Failed to create checkout session')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setCheckingOut(false)
    }
  }

  if (loading) {
    return <div className={styles.page}><div className={styles.loading}>Loading...</div></div>
  }

  const isAlreadyPro = user?.subscription_tier === 'pro'

  return (
    <>
      <Head>
        <title>Upgrade to Pro — Cinis</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.card}>
          {/* Mark */}
          <div className={styles.markWrapper}>
            <div className={styles.mark}>{CINIS_MARK}</div>
          </div>

          {/* Wordmark */}
          <div className={styles.wordmark}>CINIS</div>

          {isAlreadyPro ? (
            <div className={styles.alreadyProSection}>
              <h1 className={styles.alreadyProTitle}>You&apos;re already Pro</h1>
              <p className={styles.alreadyProSub}>Enjoy all the benefits of a Pro subscription.</p>
              <button onClick={() => router.push('/dashboard')} className={styles.backBtn}>
                Back to dashboard
              </button>
            </div>
          ) : (
            <>
              {/* Pro badge */}
              <div className={styles.proBadge}>Pro</div>

              {/* Pricing */}
              <div className={styles.priceSection}>
                <div className={styles.monthlyPrice}>
                  <span className={styles.priceAmount}>$14</span>
                  <span className={styles.pricePeriod}>/month</span>
                </div>
                <div className={styles.yearlyPrice}>
                  <span className={styles.yearlyAmount}>$99/year</span>
                  <span className={styles.saveBadge}>Save 40%</span>
                </div>
              </div>

              {/* Features */}
              <ul className={styles.features}>
                <li><span className={styles.checkmark}>✓</span> Unlimited tasks &amp; habits</li>
                <li><span className={styles.checkmark}>✓</span> AI insights</li>
                <li><span className={styles.checkmark}>✓</span> Advanced analytics</li>
                <li><span className={styles.checkmark}>✓</span> Priority support</li>
                <li><span className={styles.checkmark}>✓</span> Custom themes</li>
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleCheckout('yearly')}
                disabled={checkingOut}
                className={styles.upgradeBtn}
              >
                {checkingOut ? 'Processing...' : 'Upgrade to Pro'}
              </button>

              {/* Maybe later link */}
              <button
                onClick={() => router.push('/dashboard')}
                className={styles.maybeBtn}
                disabled={checkingOut}
              >
                Maybe later
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
