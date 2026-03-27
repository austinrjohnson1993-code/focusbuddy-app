import styles from '../../styles/Landing.module.css'
import WaitlistForm from './WaitlistForm'

export default function LandingPricing() {
  return (
    <section className={styles.pricingSection} id="pricing">
      <div className={styles.pricingInner}>
        <div className={styles.pricingEyebrow}>Launching April 2026</div>
        <h2 className={styles.pricingHeadline}>Start free.</h2>
        <p className={styles.pricingSub}>Go Pro when it clicks.</p>
        <p className={styles.pricingDesc}>Most people feel the difference in the first week.</p>

        <div className={styles.pricingTiers}>
          {/* Free */}
          <div className={styles.tierCard}>
            <div className={styles.tierLeft}>
              <div className={styles.tierName}>Free</div>
              <div className={styles.tierDesc}>5 AI check-ins/day &middot; Core tools</div>
            </div>
            <div className={styles.tierRight}>
              <div className={styles.tierPrice}>$0</div>
              <div className={styles.tierPer}>forever</div>
            </div>
          </div>

          {/* Pro */}
          <div className={`${styles.tierCard} ${styles.tierCardPro}`}>
            <div className={styles.tierBadgePro}>MOST POPULAR</div>
            <div className={styles.tierLeft}>
              <div className={styles.tierName}>Pro</div>
              <div className={styles.tierDesc}>Unlimited AI &middot; Memory &middot; Proactive</div>
            </div>
            <div className={styles.tierRight}>
              <div className={`${styles.tierPrice} ${styles.tierPriceHot}`}>
                $14
              </div>
              <div className={styles.tierPer}>/month</div>
            </div>
          </div>

          {/* Annual */}
          <div className={`${styles.tierCard} ${styles.tierCardAnnual}`}>
            <div className={styles.tierLeft}>
              <div className={styles.tierName}>Annual</div>
              <div className={styles.tierDesc}>Everything in Pro &middot; Best value</div>
            </div>
            <div className={styles.tierRight}>
              <div className={`${styles.tierPrice} ${styles.tierPriceGold}`}>
                $99
              </div>
              <div className={styles.tierPer}>/year</div>
              <div className={styles.tierSavings}>Save $69</div>
            </div>
          </div>
        </div>

        <p className={styles.pricingClose}>
          Early access is open now. <strong>April 14 is the launch date.</strong>
        </p>

        {/* Waitlist form */}
        <div className={styles.pricingFormWrap}>
          <WaitlistForm buttonLabel="Join the waitlist" micro="No card. No commitment." />
        </div>
      </div>
    </section>
  )
}
