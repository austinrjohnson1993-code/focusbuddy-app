import Head from 'next/head'
import styles from '../styles/Legal.module.css'

const CinisMark = ({ size = 28 }) => (
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

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service — Cinis</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <a href="/dashboard" className={styles.logoLink}>
            <CinisMark size={28} />
            <span className={styles.wordmark}>Cinis</span>
          </a>
        </div>

        <div className={styles.body}>
          <h1 className={styles.pageTitle}>Terms of Service</h1>
          <p className={styles.updated}>Last updated: March 2026</p>

          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>What Cinis is</h2>
            <p className={styles.p}>
              Cinis is an AI-powered productivity coaching tool designed to help you manage tasks, build habits, and develop self-awareness through structured reflection. By using Cinis, you agree to these terms.
            </p>
            <div className={styles.disclaimer}>
              <p>
                <strong>Cinis is not a medical service, mental health service, or licensed therapy platform.</strong> The AI coaching provided is for productivity and self-reflection purposes only. It is not a substitute for professional mental health care, medical advice, or crisis support. If you are experiencing a mental health emergency, please contact a qualified professional or call a crisis helpline.
              </p>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>Account responsibilities</h2>
            <ul className={styles.ul}>
              <li>You must be at least 13 years old to use Cinis.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You agree to provide accurate information during signup and to keep it current.</li>
              <li>You may not create accounts on behalf of others without their consent.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>Subscription terms</h2>
            <p className={styles.p}>
              Cinis offers a free tier and a Pro subscription. Pro is available at:
            </p>
            <ul className={styles.ul}>
              <li><strong>Monthly</strong> — $9.99/month, billed monthly.</li>
              <li><strong>Yearly</strong> — $99/year, billed annually (equivalent to ~$8.25/month).</li>
            </ul>
            <p className={styles.p}>
              Subscriptions renew automatically at the end of each billing period. You may cancel at any time through your account settings or by contacting us. Cancellation takes effect at the end of the current billing period — you retain Pro access until then.
            </p>
            <p className={styles.p}>
              <strong>Refunds:</strong> We do not offer refunds for partial billing periods. If you believe you were charged in error, contact us within 7 days at{' '}
              <a href="mailto:hello@getcinis.app" className={styles.link}>hello@getcinis.app</a>.
            </p>
            <p className={styles.p}>
              We reserve the right to change pricing with at least 30 days' notice to active subscribers.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>Acceptable use</h2>
            <p className={styles.p}>You agree not to:</p>
            <ul className={styles.ul}>
              <li>Use Cinis to generate, store, or transmit illegal content.</li>
              <li>Attempt to reverse engineer, scrape, or extract data from the service at scale.</li>
              <li>Share your account credentials with others or resell access.</li>
              <li>Use Cinis to harass, harm, or impersonate others.</li>
              <li>Attempt to circumvent rate limits, authentication, or security measures.</li>
            </ul>
            <p className={styles.p}>
              We reserve the right to suspend or terminate accounts that violate these terms without notice.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>No medical advice</h2>
            <div className={styles.disclaimer}>
              <p>
                Nothing in Cinis — including AI responses, coaching messages, journal reflections, or any feature of the service — constitutes medical advice, psychological diagnosis, or therapeutic treatment. Cinis does not create a doctor-patient or therapist-client relationship. Always seek the advice of a qualified healthcare professional for any health-related concerns.
              </p>
            </div>
            <p className={styles.p}>
              If you are in crisis or experiencing thoughts of self-harm, please contact the 988 Suicide and Crisis Lifeline (call or text 988 in the US) or your local emergency services.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>Limitation of liability</h2>
            <p className={styles.p}>
              Cinis is provided "as is" without warranties of any kind. To the maximum extent permitted by law, Cinis and its operators are not liable for any indirect, incidental, special, or consequential damages arising from your use of the service, including but not limited to lost data, missed deadlines, or decisions made based on AI-generated content.
            </p>
            <p className={styles.p}>
              Our total liability to you for any claim arising from use of Cinis shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>Changes to these terms</h2>
            <p className={styles.p}>
              We may update these terms from time to time. When we make material changes, we will notify you by email or via an in-app notice at least 14 days before the changes take effect. Continued use of Cinis after that date constitutes acceptance of the updated terms.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>Contact</h2>
            <p className={styles.p}>
              Questions about these terms?{' '}
              <a href="mailto:hello@getcinis.app" className={styles.link}>hello@getcinis.app</a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
