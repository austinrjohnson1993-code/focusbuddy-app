import styles from '../../styles/Landing.module.css'

export default function LandingEmpathy() {
  return (
    <section className={styles.empathySection}>
      <div className={styles.empathyInner}>
        <div className={styles.empathyEyebrow}>Sound familiar?</div>
        <h2 className={styles.empathyHeadline}>
          You&apos;ve been here before.
        </h2>
        <div className={styles.empathyBody}>
          <p>
            The Notion database, set up perfectly and never opened again. The Todoist workflow with 47 overdue tasks you stopped looking at. The planner you bought with genuine optimism in January. Every one failed — not because you&apos;re broken, but because every one assumed your problem was organizational.
          </p>
          <p>
            It isn&apos;t. The gap between knowing what to do and actually starting it is neurological. It&apos;s the distance between intention and action — and it&apos;s not solved by a better system. It&apos;s solved by something that <strong>shows up for you.</strong> Something that knows when you&apos;re avoiding, notices what you keep rescheduling, and reaches out before you fall behind.
          </p>
          <p>
            You&apos;ve tried everything that waits for you to remember it. <strong>Cinis doesn&apos;t wait.</strong>
          </p>
        </div>
        <div className={styles.empathyKicker}>
          The coach that shows up. Before you think to ask.
        </div>
      </div>
    </section>
  )
}
