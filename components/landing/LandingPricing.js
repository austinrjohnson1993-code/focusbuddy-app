import styles from '../../styles/Landing.module.css'
import { PRICING } from '../../lib/constants'
import WaitlistForm from './WaitlistForm'

const FREE_FEATURES = [
  'Unlimited tasks',
  'Daily AI check-in',
  'Basic bill tracking',
  'Coaching profile',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Proactive outreach (SMS + push)',
  'Full finance module',
  '3-layer memory system',
  'All 6 coaching voices',
  'Priority support',
]

const ANNUAL_FEATURES = [
  'Everything in Pro',
  `Save ${PRICING.annualSavings} vs monthly`,
  'Annual coaching review',
]

export default function LandingPricing() {
  return (
    <section className={styles.pricingSection} id="pricing">
      <div className={styles.pricingInner}>
        <div className={styles.pricingLabel}>PRICING</div>
        <h2 className={styles.pricingHeadline}>Simple. No traps.</h2>
        <p className={styles.pricingSub}>Start free. Upgrade when it clicks.</p>

        <div className={styles.pricingTiers}>
          {/* Free */}
          <div className={styles.tierCard}>
            <div className={styles.tierName}>Free</div>
            <div className={styles.tierPrice}>$0</div>
            <div className={styles.tierDivider} />
            <div className={styles.tierFeatures}>
              {FREE_FEATURES.map(f => (
                <div key={f} className={styles.tierFeature}>
                  <span className={styles.tierFeatureCheck}>✓</span>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Pro */}
          <div className={`${styles.tierCard} ${styles.tierCardPro}`}>
            <div className={`${styles.tierBadge} ${styles.tierBadgePro}`}>MOST POPULAR</div>
            <div className={styles.tierName}>Pro</div>
            <div className={styles.tierPrice}>
              {PRICING.monthlyDisplay}
              <span className={styles.tierPriceSub}>/mo</span>
            </div>
            <div className={styles.tierDivider} />
            <div className={styles.tierFeatures}>
              {PRO_FEATURES.map(f => (
                <div key={f} className={styles.tierFeature}>
                  <span className={styles.tierFeatureCheck}>✓</span>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Annual */}
          <div className={`${styles.tierCard} ${styles.tierCardAnnual}`}>
            <div className={`${styles.tierBadge} ${styles.tierBadgeAnnual}`}>BEST VALUE</div>
            <div className={styles.tierName}>Annual</div>
            <div className={styles.tierPrice}>
              {PRICING.annualDisplay}
              <span className={styles.tierPriceSub}>/yr</span>
            </div>
            <div className={styles.tierSavings}>Save {PRICING.savingsPercent} — {PRICING.annualSavings} back in your pocket</div>
            <div className={styles.tierDivider} />
            <div className={styles.tierFeatures}>
              {ANNUAL_FEATURES.map(f => (
                <div key={f} className={styles.tierFeature}>
                  <span className={`${styles.tierFeatureCheck} ${styles.tierFeatureCheckGold}`}>✓</span>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Waitlist form */}
        <div className={styles.pricingFormWrap}>
          <div className={styles.pricingFormLabel}>Get early access</div>
          <p className={styles.pricingFormSub}>Join the waitlist. Launch-day pricing locked in.</p>
          <WaitlistForm />
        </div>
      </div>
    </section>
  )
}
