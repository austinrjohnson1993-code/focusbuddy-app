import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

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

const MONTHLY_PRICE_ID = 'price_1TCRi82OSKmsLrz4fKxjcqyt'
const YEARLY_PRICE_ID  = 'price_1TCmBd2OSKmsLrz4A9AJ7qC9'

export default function Upgrade() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCheckout = async (priceId) => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ priceId })
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('No checkout URL returned')
      }
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Go Pro — Cinis</title>
        <meta name="description" content="Upgrade to Cinis Pro for unlimited check-ins and coach memory." />
      </Head>

      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <a href="/" style={styles.logoLink}>
            <CinisMark size={32} />
          </a>
        </div>

        {/* Hero */}
        <div style={styles.hero}>
          <h1 style={styles.title}>Go Pro</h1>
          <p style={styles.tagline}>Your coach remembers everything on Pro.</p>
        </div>

        {/* Feature Comparison Table */}
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.headerRow}>
                <th style={styles.featureCol}>Feature</th>
                <th style={styles.planCol}>Free</th>
                <th style={styles.planCol}>Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr style={styles.row}>
                <td style={styles.featureName}>AI check-ins per day</td>
                <td style={styles.value}>5</td>
                <td style={styles.value}>Unlimited</td>
              </tr>
              <tr style={styles.row}>
                <td style={styles.featureName}>Coach memory</td>
                <td style={styles.value}>Session only</td>
                <td style={styles.value}>Rolls forward forever</td>
              </tr>
              <tr style={styles.row}>
                <td style={styles.featureName}>Morning + evening check-ins</td>
                <td style={{ ...styles.value, ...styles.emptyValue }}>—</td>
                <td style={styles.checkmark}>✓</td>
              </tr>
              <tr style={styles.row}>
                <td style={styles.featureName}>Proactive nudges</td>
                <td style={{ ...styles.value, ...styles.emptyValue }}>—</td>
                <td style={styles.checkmark}>✓</td>
              </tr>
              <tr style={styles.row}>
                <td style={styles.featureName}>Habit coaching</td>
                <td style={styles.value}>Basic</td>
                <td style={styles.value}>Full AI feedback</td>
              </tr>
              <tr style={styles.row}>
                <td style={styles.featureName}>Finance insights</td>
                <td style={{ ...styles.value, ...styles.emptyValue }}>—</td>
                <td style={styles.value}>AI-generated</td>
              </tr>
              <tr style={styles.priceRow}>
                <td style={styles.featureName}>Price</td>
                <td style={styles.value}>Free</td>
                <td style={styles.value}>$14/mo or $99/yr</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* CTA Section */}
        <div style={styles.ctaSection}>
          <h2 style={styles.ctaHeading}>Ready to build a coach that actually knows you?</h2>

          <div style={styles.buttonGrid}>
            <button
              onClick={() => handleCheckout(MONTHLY_PRICE_ID)}
              disabled={loading}
              style={styles.ctaButtonPrimary}
            >
              Start monthly — $14/mo
            </button>
            <button
              onClick={() => handleCheckout(YEARLY_PRICE_ID)}
              disabled={loading}
              style={styles.ctaButtonSecondary}
            >
              Go yearly — $99/yr
              <span style={styles.saveBadge}>save 15%</span>
            </button>
          </div>

          <p style={styles.microCopy}>Cancel anytime. No questions asked.</p>
        </div>

        {/* Back to Dashboard */}
        <div style={styles.footer}>
          <button
            onClick={() => router.push('/dashboard')}
            style={styles.backBtn}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#1a0f08',
    color: '#f0ead6',
    fontFamily: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: '40px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  header: {
    marginBottom: '60px',
    textAlign: 'center',
  },

  logoLink: {
    display: 'inline-flex',
    alignItems: 'center',
    textDecoration: 'none',
  },

  hero: {
    textAlign: 'center',
    marginBottom: '80px',
    maxWidth: '700px',
  },

  title: {
    fontFamily: "'Cormorant Garamond', 'Cormorant', serif",
    fontSize: '64px',
    fontWeight: 700,
    margin: '0 0 24px',
    color: '#f0ead6',
    letterSpacing: '-0.02em',
  },

  tagline: {
    fontSize: '24px',
    color: 'rgba(240,234,214,0.75)',
    margin: 0,
    lineHeight: 1.4,
    fontWeight: 300,
  },

  tableContainer: {
    maxWidth: '800px',
    width: '100%',
    marginBottom: '100px',
    overflow: 'auto',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    borderSpacing: 0,
  },

  headerRow: {
    borderBottom: '2px solid rgba(255,200,120,0.15)',
  },

  featureCol: {
    textAlign: 'left',
    padding: '16px 0',
    fontWeight: 600,
    fontSize: '14px',
    color: 'rgba(240,234,214,0.55)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    minWidth: '160px',
  },

  planCol: {
    textAlign: 'center',
    padding: '16px 0',
    fontWeight: 600,
    fontSize: '14px',
    color: 'rgba(240,234,214,0.55)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    minWidth: '120px',
  },

  row: {
    borderBottom: '1px solid rgba(255,200,120,0.08)',
  },

  featureName: {
    padding: '18px 0',
    fontSize: '15px',
    fontWeight: 500,
    color: '#f0ead6',
    textAlign: 'left',
    minWidth: '160px',
  },

  value: {
    padding: '18px 0',
    textAlign: 'center',
    fontSize: '15px',
    color: 'rgba(240,234,214,0.8)',
    minWidth: '120px',
  },

  emptyValue: {
    color: 'rgba(240,234,214,0.35)',
  },

  checkmark: {
    padding: '18px 0',
    textAlign: 'center',
    fontSize: '18px',
    color: '#FF6644',
    fontWeight: 700,
    minWidth: '120px',
  },

  priceRow: {
    borderTop: '2px solid rgba(255,200,120,0.15)',
    borderBottom: 'none',
  },

  ctaSection: {
    textAlign: 'center',
    marginBottom: '80px',
    maxWidth: '600px',
  },

  ctaHeading: {
    fontFamily: "'Cormorant Garamond', 'Cormorant', serif",
    fontSize: '40px',
    fontWeight: 700,
    margin: '0 0 40px',
    color: '#f0ead6',
    letterSpacing: '-0.02em',
  },

  buttonGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
  },

  ctaButtonPrimary: {
    padding: '16px 28px',
    background: 'linear-gradient(135deg, #FF6644, #FF4500)',
    color: '#fff',
    border: 'none',
    borderRadius: '100px',
    fontSize: '16px',
    fontWeight: 700,
    fontFamily: "'Figtree', sans-serif",
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 16px rgba(255,77,28,0.4)',
  },

  ctaButtonSecondary: {
    padding: '16px 28px',
    background: 'rgba(255,200,120,0.08)',
    color: '#f0ead6',
    border: '1px solid rgba(255,200,120,0.2)',
    borderRadius: '100px',
    fontSize: '16px',
    fontWeight: 700,
    fontFamily: "'Figtree', sans-serif",
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
  },

  saveBadge: {
    display: 'inline-block',
    marginLeft: '8px',
    padding: '2px 8px',
    background: 'rgba(255,102,68,0.2)',
    color: '#FF6644',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
  },

  microCopy: {
    fontSize: '14px',
    color: 'rgba(240,234,214,0.45)',
    margin: 0,
  },

  footer: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },

  backBtn: {
    background: 'none',
    border: '1px solid rgba(255,200,120,0.2)',
    color: 'rgba(240,234,214,0.6)',
    padding: '12px 24px',
    borderRadius: '100px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: "'Figtree', sans-serif",
  },
}
