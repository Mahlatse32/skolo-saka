import type { ReactNode } from 'react';
import { Building2, CircleUserRound, GraduationCap, Home, Trophy, WalletCards } from 'lucide-react';

type ActiveDestination='schools'|'projects'|'payments';

export function SecondaryMobileNavigation({active}:{active:ActiveDestination}){
  return <nav className="mobile-nav" style={{gridTemplateColumns:'repeat(5,1fr)'}}><a href="/"><Home/><span>Home</span></a><a className={active==='payments'?'active':''} href="/payments"><WalletCards/><span>Payments</span></a><a className={active==='schools'?'active':''} href="/schools"><Building2/><span>Schools</span></a><a className={active==='projects'?'active':''} href="/projects"><Trophy/><span>Projects</span></a><a href="/?view=profile"><CircleUserRound/><span>Profile</span></a></nav>;
}

export default function SecondaryShell({active,children}:{active:ActiveDestination;children:ReactNode}){
  return <main className="secondary-shell">
    <aside className="secondary-sidebar">
      <a className="secondary-brand" href="/"><span><GraduationCap size={20}/></span><b>Skolo Saka</b></a>
      <nav>
        <a href="/"><Home/>Home</a>
        <a className={active==='payments'?'active':''} href="/payments"><WalletCards/>Payments</a>
        <a className={active==='schools'?'active':''} href="/schools"><Building2/>Schools</a>
        <a className={active==='projects'?'active':''} href="/projects"><Trophy/>Projects</a>
        <a href="/?view=profile"><CircleUserRound/>Profile</a>
      </nav>
    </aside>
    <section className="secondary-main">
      <header className="secondary-topbar"><a href="/"><GraduationCap size={19}/> Skolo Saka</a></header>
      <div className="secondary-content">{children}</div>
    </section>
    <SecondaryMobileNavigation active={active}/>
  </main>;
}
