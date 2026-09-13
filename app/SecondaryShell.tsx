'use client';

import type { ReactNode } from 'react';
import { Building2, GraduationCap, Home, Trophy, WalletCards } from 'lucide-react';

export default function SecondaryShell({active,children}:{active:'schools'|'projects'|'payments';children:ReactNode}){
  return <main className="secondary-shell">
    <aside className="secondary-sidebar">
      <a className="secondary-brand" href="/"><span><GraduationCap size={20}/></span><b>Skolo Saka</b></a>
      <nav>
        <a href="/"><Home/>Home</a>
        <a className={active==='schools'?'active':''} href="/schools"><Building2/>Schools</a>
        <a className={active==='projects'?'active':''} href="/projects"><Trophy/>Projects</a>
        <a className={active==='payments'?'active':''} href="/payments"><WalletCards/>Payments</a>
      </nav>
    </aside>
    <section className="secondary-main">
      <header className="secondary-topbar"><a href="/"><GraduationCap size={19}/> Skolo Saka</a></header>
      <div className="secondary-content">{children}</div>
    </section>
  </main>;
}
