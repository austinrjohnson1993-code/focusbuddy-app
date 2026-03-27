import styles from '../../styles/Landing.module.css'

export default function LandingEmpathy() {
  return (
    <section className={styles.empathySection}>
      <div className={styles.empathyInner}>
        <div className={styles.empathyEyebrow}>Sound familiar?</div>
        <h2 className={styles.empathyHeadline}>
          You know exactly what you need to do.<br />
          <em className={styles.empathyHeadlineEm}>So why isn&apos;t it done?</em>
        </h2>
        <div className={styles.empathyBody}>
          <p>
            You&apos;ve been here before. <strong>The Notion database, set up perfectly and never opened again.</strong> The Todoist workflow with 47 overdue tasks you stopped looking at. The planner you bought with genuine optimism in January. Every one failed — not because you&apos;re broken, but because every one assumed your problem was organizational.
          </p>
          <p>
            <strong>It isn&apos;t.</strong> The gap between knowing what to do and actually starting it is neurological. It&apos;s the distance between intention and action — and it&apos;s not solved by a better system. It&apos;s solved by something that shows up for you. Something that knows when you&apos;re avoiding, notices what you keep rescheduling, and reaches out before you fall behind.
          </p>
          <p>
            <strong>You&apos;ve tried everything that waits for you to remember it.</strong> Cinis doesn&apos;t wait.
          </p>
        </div>
        <div className={styles.empathyKicker}>
          The coach that shows up. Before you think to ask.
        </div>
      </div>
    </section>
  )
}
