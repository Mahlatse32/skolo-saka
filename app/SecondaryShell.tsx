'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Building2, CircleUserRound, GraduationCap, Home, Info, LogIn, Trophy, WalletCards } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ActiveDestination='schools'|'projects'|'payments'|'about'|'sports';
type NavigationProps={active:ActiveDestination;signedIn:boolean};

function useSignedIn(){
  // Keep account destinations hidden until the browser session is restored.
  const [signedIn,setSignedIn]=useState(false);
  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setSignedIn(Boolean(session?.user));
    });
    return ()=>subscription.unsubscribe();
  },[]);
  return signedIn;
}

function NavigationLinks({active,signedIn}:NavigationProps){
  return <>
    {signedIn?<>
      <a href="/"><Home/><span>Home</span></a>
      <a className={active==='payments'?'active':''} href="/payments"><WalletCards/><span>Contributions</span></a>
      <a className={active==='schools'?'active':''} href="/schools"><Building2/><span>Schools</span></a>
      <a className={active==='projects'?'active':''} href="/projects"><Trophy/><span>Projects</span></a>
      <a href="/?view=profile"><CircleUserRound/><span>Profile</span></a>
      <a className={active==='sports'?'active':''} href="/sports"><Trophy/><span>Sports</span></a>
    </>:<a href="/"><LogIn/><span>Sign in</span></a>}
    <a className={active==='about'?'active':''} href="/about"><Info/><span>About</span></a>
  </>;
}

function MobileNavigation({active,signedIn}:NavigationProps){
  return <nav className="mobile-nav" aria-label="Mobile navigation" style={{gridTemplateColumns:signedIn?'repeat(7,1fr)':'repeat(2,1fr)'}}>
    <NavigationLinks active={active} signedIn={signedIn}/>
  </nav>;
}

export function SecondaryMobileNavigation({active}:{active:ActiveDestination}){
  const signedIn=useSignedIn();
  return <MobileNavigation active={active} signedIn={signedIn}/>;
}

export default function SecondaryShell({active,children}:{active:ActiveDestination;children:ReactNode}){
  const signedIn=useSignedIn();
  return <main className="secondary-shell">
    <aside className="secondary-sidebar">
      <a className="secondary-brand" href="/"><span><GraduationCap size={20}/></span><b>Skolo Saka</b></a>
      <nav aria-label="Main navigation">
        <NavigationLinks active={active} signedIn={signedIn}/>
      </nav>
    </aside>
    <section className="secondary-main">
      <header className="secondary-topbar"><a href="/"><GraduationCap size={19}/> Skolo Saka</a></header>
      <div className="secondary-content">{children}</div>
    </section>
    <MobileNavigation active={active} signedIn={signedIn}/>
  </main>;
}
