'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, MailCheck, WalletCards } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type SchoolRef={id:string;name:string}; type MembershipRow={schools:SchoolRef|SchoolRef[]|null};

export default function PaymentQuickLink(){
  const [user,setUser]=useState<User|null>(null); const [sideTarget,setSideTarget]=useState<Element|null>(null); const [mobileTarget,setMobileTarget]=useState<Element|null>(null); const [profileTarget,setProfileTarget]=useState<Element|null>(null); const [authTarget,setAuthTarget]=useState<Element|null>(null); const [schoolMap,setSchoolMap]=useState<Map<string,string>>(new Map()); const [profileEmail,setProfileEmail]=useState(''); const [securityMessage,setSecurityMessage]=useState(''); const [securityError,setSecurityError]=useState(''); const [securityBusy,setSecurityBusy]=useState(false);
  const visible=Boolean(user);

  useEffect(()=>{
    let active=true;
    async function syncSession(){const {data}=await supabase.auth.getSession(); if(!active)return; const current=data.session?.user??null; setUser(current); if(current){const [{data:rows},{data:profile}]=await Promise.all([supabase.from('school_memberships').select('schools(id,name)').eq('user_id',current.id),supabase.from('profiles').select('email').eq('id',current.id).maybeSingle()]); const next=new Map<string,string>(); ((rows||[]) as unknown as MembershipRow[]).forEach(row=>{const school=Array.isArray(row.schools)?row.schools[0]:row.schools;if(school)next.set(school.name.trim().toLowerCase(),school.id);}); if(active){setSchoolMap(next);setProfileEmail(profile?.email||current.email||'');}}}
    void syncSession(); const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(active){setUser(session?.user??null);if(session)void syncSession();}}); return()=>{active=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{const findTargets=()=>{setSideTarget(document.querySelector('.app-sidebar .app-nav'));setMobileTarget(document.querySelector('.mobile-nav'));setProfileTarget(document.querySelector('.profile-grid'));setAuthTarget(document.querySelector('.auth-card'));};findTargets();const observer=new MutationObserver(findTargets);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[]);

  useEffect(()=>{if(!visible||window.location.pathname!=='/')return;const capture=(event:MouseEvent)=>{const target=event.target as HTMLElement|null;const schoolButton=target?.closest('.my-school-card .school-card-open');if(schoolButton){const name=schoolButton.querySelector('h3')?.textContent?.trim().toLowerCase();const id=name?schoolMap.get(name):undefined;if(id){event.preventDefault();event.stopPropagation();window.location.href=`/school/${id}`;return;}}
    const button=target?.closest('button');if(!button)return;const text=(button.textContent||'').trim().toLowerCase();const isLegacySchoolAction=text==='schools'||text==='add school'||text==='manage'||text.includes('find my schools');if(isLegacySchoolAction){event.preventDefault();event.stopPropagation();window.location.href='/schools';}};document.addEventListener('click',capture,true);return()=>document.removeEventListener('click',capture,true);},[visible,schoolMap]);

  async function verifyEmail(){setSecurityBusy(true);setSecurityError('');setSecurityMessage('');const email=profileEmail.trim();if(!email){setSecurityBusy(false);setSecurityError('Add and save an email address in Personal details first.');return;}const redirect=`${window.location.origin}/`;const {error}=await supabase.auth.updateUser({email},{emailRedirectTo:redirect});setSecurityBusy(false);if(error){setSecurityError(error.message);return;}setSecurityMessage(`Verification email sent to ${email}. Open the link in that inbox to verify it.`);}

  const desktopItems=useMemo(()=><><button onClick={()=>{window.location.href='/schools';}}><Building2/><span>Schools</span></button><button onClick={()=>{window.location.href='/payments';}}><WalletCards/><span>Payments</span></button></>,[]);
  const mobileItems=useMemo(()=><><button onClick={()=>{window.location.href='/schools';}}><Building2/><span>Schools</span></button><button onClick={()=>{window.location.href='/payments';}}><WalletCards/><span>Payments</span></button></>,[]);
  const emailVerified=Boolean(user?.email_confirmed_at&&user.email&&user.email.toLowerCase()===profileEmail.trim().toLowerCase());
  const securityCard=visible?<article className="settings-card"><div className="settings-icon"><MailCheck/></div><h3>Account recovery</h3><p className="security-status">{emailVerified?`${user?.email} is verified and can be used to recover your account.`:profileEmail?`${profileEmail} is not yet verified for account recovery.`:'Add an email address so you can recover your account if you lose access to your phone or PIN.'}</p>{emailVerified?<span className="status-pill">✓ Email verified</span>:<button className="outline security-action" disabled={securityBusy} onClick={verifyEmail}>{securityBusy?'Sending…':'Verify recovery email'}</button>}{securityMessage&&<div className="security-success">{securityMessage}</div>}{securityError&&<div className="security-error">{securityError}</div>}</article>:null;
  const recoveryLink=!visible&&authTarget?<button className="account-recovery-link" onClick={()=>{window.location.href='/auth/recover';}}>Recover account with email</button>:null;

  return <>{visible&&sideTarget?createPortal(desktopItems,sideTarget):null}{visible&&mobileTarget?createPortal(mobileItems,mobileTarget):null}{visible&&profileTarget?createPortal(securityCard,profileTarget):null}{authTarget&&recoveryLink?createPortal(recoveryLink,authTarget):null}</>;
}
