import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import styles from '../styles/Upgrade.module.css'
import CinisMark from '../lib/CinisMark'
import { PRICING } from '../lib/constants'

const CINIS_MARK = <CinisMark size={64} />

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
                  <span className={styles.priceAmount}>{PRICING.monthlyDisplay}</span>
                  <span className={styles.pricePeriod}>/month</span>
                </div>
                <div className={styles.yearlyPrice}>
                  <span className={styles.yearlyAmount}>{PRICING.annualLabel}</span>
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
