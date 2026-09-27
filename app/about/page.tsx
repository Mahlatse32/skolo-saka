import type { Metadata } from 'next';
import SecondaryShell from '../SecondaryShell';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About Skolo Saka',
  description: 'Learn how Skolo Saka brings former learners, communities and partners together to support sport at schools.',
};

export default function AboutPage() {
  return <SecondaryShell active="about">
    <article className={styles.page}>
      <header className={styles.intro}>
        <span className="secondary-eyebrow">About Skolo Saka</span>
        <h1 className="secondary-title">From our schools, for our schools, for our future.</h1>
        <p className="secondary-lead">Skolo Saka brings former learners, communities, businesses and partners together to strengthen sport at under-resourced South African schools.</p>
      </header>

      <section className="secondary-card" aria-labelledby="why">
        <h2 id="why">Why we exist</h2>
        <p>Many schools have talented learners and committed educators, but lack sporting equipment, facilities, uniforms, transport and opportunities to compete. Those gaps can make it harder for learners to participate consistently and develop their abilities.</p>
        <p>We aim to connect schools with people and organisations willing to support clearly defined sporting needs.</p>
      </section>

      <section className="secondary-card" aria-labelledby="how">
        <h2 id="how">How Skolo Saka works</h2>
        <ol className={styles.steps}>
          <li><strong>Identify a need.</strong> A participating school identifies a priority sporting need.</li>
          <li><strong>Define a project.</strong> The need becomes a clear, costed project with a target and implementation plan.</li>
          <li><strong>Bring supporters together.</strong> Former learners, families, neighbours, businesses and other supporters can contribute.</li>
          <li><strong>Implement and report.</strong> We aim to share progress and evidence so supporters can follow what their help makes possible.</li>
        </ol>
        <p>Skolo Saka is designed for accessible giving from R10, including once-off and recurring support where available. Supporters do not need to have attended a school to help it.</p>
      </section>

      <section className="secondary-card" aria-labelledby="support">
        <h2 id="support">What support can provide</h2>
        <p>Depending on a school’s approved plans, support may help with kits and uniforms, balls and training equipment, facility improvements, coaching, transport, tournaments and other defined school sport needs.</p>
        <p>Small contributions can come together around a project; partners can also offer equipment, services or expertise.</p>
      </section>

      <section className="secondary-card" aria-labelledby="pathway">
        <h2 id="pathway">From participation to opportunity</h2>
        <p>Our aim is to help learners progress through access, participation, training, competition, exposure and development. Stronger school sport programmes can give more learners the chance to practise, compete and show what they can do.</p>
      </section>

      <section className="secondary-card" aria-labelledby="trust">
        <h2 id="trust">Transparency and accountability</h2>
        <p>Support should be connected to defined projects and measurable needs. As projects are approved and implemented, we aim to show funding targets, amounts raised, project status, intended use, progress updates and evidence of outcomes where applicable.</p>
      </section>

      <section className="secondary-card" aria-labelledby="join">
        <h2 id="join">Who can take part</h2>
        <p>Former learners can reconnect with their schools and give back. Parents and community members can support schools they care about. Businesses, coaches, academies, sporting organisations and other partners can sponsor projects or contribute skills and resources.</p>
        <p>Our vision is for more learners to have meaningful opportunities to participate in sport and develop their potential.</p>
        <a className="primary" href="/">Explore Skolo Saka</a>
      </section>
    </article>
  </SecondaryShell>;
}
