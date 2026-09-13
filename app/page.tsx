'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Bell, Building2, Check, ChevronLeft, ChevronRight, CircleUserRound, GraduationCap,
  HeartHandshake, Home, LogOut, MapPin, Minus, Phone, Plus, Search, ShieldCheck,
  Trophy, WalletCards, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Commitment, Membership, Project, School } from '@/lib/types';

type View = 'home' | 'schools' | 'projects' | 'profile';
type SchoolLevelFilter = 'all' | 'primary' | 'high' | 'combined';
type AuthStep = 'phone' | 'otp' | 'pin';
type UserMembership = Membership & { schools?: School };

const PROVINCES = ['All provinces','Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];
const TRUSTED_PHONE_KEY = 'skolo_saka_trusted_phone';
const TRUSTED_PIN_KEY = 'skolo_saka_pin_hash';

const money = (cents:number) => new Intl.NumberFormat('en-ZA', {style:'currency', currency:'ZAR', maximumFractionDigits:0}).format(cents/100);

function levelLabel(level: School['level']) {
  if (level === 'primary') return 'Primary School';
  if (level === 'high') return 'High School';
  if (level === 'combined') return 'Combined School';
  return 'School';
}
function initials(name:string) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
function normalizeSaPhone(value:string) {
  const digits = value.replace(/\D/g,'');
  if (digits.startsWith('27')) return `+${digits}`;
  if (digits.startsWith('0')) return `+27${digits.slice(1)}`;
  return `+27${digits}`;
}
async function pinDigest(phone:string,pin:string){
  const bytes = new TextEncoder().encode(`skolo-saka:${phone}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}

async function fetchAllSchools(): Promise<School[]> {
  const pageSize = 1000; const rows: School[] = [];
  for (let from=0;;from+=pageSize) {
    const {data,error}=await supabase.from('schools').select('id,name,level,province,municipality,town,verified').order('name').range(from,from+pageSize-1);
    if(error) throw error; const batch=(data??[]) as School[]; rows.push(...batch); if(batch.length<pageSize) break;
  }
  return rows;
}
async function fetchAllProjects(): Promise<Project[]> {
  const pageSize = 1000; const rows: Project[] = [];
  for (let from=0;;from+=pageSize) {
    const {data,error}=await supabase.from('projects').select('id,school_id,title,description,category,target_cents,status,priority').order('priority').range(from,from+pageSize-1);
    if(error) throw error; const batch=(data??[]) as Project[]; rows.push(...batch); if(batch.length<pageSize) break;
  }
  return rows;
}

export default function Page(){
  const [user,setUser]=useState<User|null>(null);
  const [authReady,setAuthReady]=useState(false);
  const [authStep,setAuthStep]=useState<AuthStep>('phone');
  const [phone,setPhone]=useState('');
  const [otp,setOtp]=useState('');
  const [pin,setPin]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [authMessage,setAuthMessage]=useState('');
  const [authError,setAuthError]=useState('');

  const [view,setView]=useState<View>('home');
  const [schools,setSchools]=useState<School[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const [memberships,setMemberships]=useState<UserMembership[]>([]);
  const [commitments,setCommitments]=useState<Commitment[]>([]);
  const [query,setQuery]=useState('');
  const [province,setProvince]=useState('All provinces');
  const [level,setLevel]=useState<SchoolLevelFilter>('all');
  const [selectedSchool,setSelectedSchool]=useState<School|null>(null);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [savingSchool,setSavingSchool]=useState<string|null>(null);

  useEffect(()=>{
    void supabase.auth.getSession().then(({data})=>{
      const sessionUser=data.session?.user??null;
      setUser(sessionUser);
      if(sessionUser){
        const trustedPhone=localStorage.getItem(TRUSTED_PHONE_KEY);
        const trustedPin=localStorage.getItem(TRUSTED_PIN_KEY);
        if(trustedPhone&&trustedPin&&normalizeSaPhone(trustedPhone)===normalizeSaPhone(sessionUser.phone||'')){
          setPhone(trustedPhone);
          setAuthStep('pin');
        }
      } else {
        const trustedPhone=localStorage.getItem(TRUSTED_PHONE_KEY);
        const trustedPin=localStorage.getItem(TRUSTED_PIN_KEY);
        if(trustedPhone&&trustedPin){
          setPhone(trustedPhone);
          setAuthStep('pin');
        }
      }
      setAuthReady(true);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{ setUser(session?.user??null); setAuthReady(true); });
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!user){ setMemberships([]); setCommitments([]); return; }
    void loadApp(user.id);
  },[user]);

  async function loadApp(userId:string){
    setLoading(true); setLoadError('');
    try{
      const [schoolRows,projectRows,{data:m,error:mErr},{data:c,error:cErr}] = await Promise.all([
        fetchAllSchools(), fetchAllProjects(),
        supabase.from('school_memberships').select('id,school_id,graduation_year,start_year,end_year,verified,schools(id,name,level,province,municipality,town,verified)').eq('user_id',userId),
        supabase.from('commitments').select('id,school_id,amount_cents,frequency,status,payment_provider').eq('user_id',userId)
      ]);
      if(mErr) throw mErr; if(cErr) throw cErr;
      setSchools(schoolRows); setProjects(projectRows); setMemberships((m??[]) as unknown as UserMembership[]); setCommitments((c??[]) as Commitment[]);
    }catch(error){ setLoadError(error instanceof Error?error.message:'Could not load Skolo Saka.'); }
    finally{ setLoading(false); }
  }

  async function sendOtp(e?:FormEvent){
    e?.preventDefault(); setAuthBusy(true); setAuthError(''); setAuthMessage('');
    const normalized=normalizeSaPhone(phone);
    const {error}=await supabase.auth.signInWithOtp({phone:normalized,options:{shouldCreateUser:true}});
    setAuthBusy(false);
    if(error){ setAuthError(error.message); return; }
    setPhone(normalized); setAuthMessage(`We sent a 6-digit code to ${normalized}.`); setAuthStep('otp');
  }

  async function verifyOtp(){
    setAuthBusy(true); setAuthError('');
    const normalized=normalizeSaPhone(phone);
    const {data,error}=await supabase.auth.verifyOtp({phone:normalized,token:otp,type:'sms'});
    setAuthBusy(false);
    if(error){ setAuthError(error.message); return; }
    if(!data.user){ setAuthError('Verification succeeded but no user session was returned.'); return; }
    setUser(data.user); setAuthStep('pin'); setOtp('');
  }

  async function saveTrustedPin(){
    if(pin.length!==4) return;
    const normalized=normalizeSaPhone(user?.phone||phone);
    const hash=await pinDigest(normalized,pin);
    localStorage.setItem(TRUSTED_PHONE_KEY,normalized); localStorage.setItem(TRUSTED_PIN_KEY,hash);
    setPhone(normalized); setPin(''); setAuthStep('phone'); setView('home');
  }

  async function unlockWithPin(){
    if(pin.length!==4) return;
    setAuthBusy(true); setAuthError('');
    const trustedPhone=localStorage.getItem(TRUSTED_PHONE_KEY);
    const trustedHash=localStorage.getItem(TRUSTED_PIN_KEY);
    if(!trustedPhone||!trustedHash){
      setAuthBusy(false); setAuthStep('phone'); setAuthError('Enter your phone number to continue.'); return;
    }
    const enteredHash=await pinDigest(trustedPhone,pin);
    if(enteredHash!==trustedHash){
      setAuthBusy(false); setAuthError('Incorrect PIN.'); return;
    }
    const {data}=await supabase.auth.getSession();
    if(!data.session?.user){
      setAuthBusy(false); setAuthStep('phone'); setPhone(trustedPhone); setAuthError('Your secure session expired. Verify by SMS once, then your PIN will work again on this device.'); return;
    }
    setUser(data.session.user); setPhone(trustedPhone); setPin(''); setAuthStep('phone'); setView('home'); setAuthBusy(false);
  }

  async function signOut(){
    await supabase.auth.signOut();
    setUser(null); setView('home'); setOtp(''); setPin('');
    const trustedPhone=localStorage.getItem(TRUSTED_PHONE_KEY);
    const trustedPin=localStorage.getItem(TRUSTED_PIN_KEY);
    if(trustedPhone&&trustedPin){ setPhone(trustedPhone); setAuthStep('pin'); }
    else { setPhone(''); setAuthStep('phone'); }
  }

  async function addSchool(school:School){
    if(!user) return; setSavingSchool(school.id); setLoadError('');
    const {error:mErr}=await supabase.from('school_memberships').upsert({user_id:user.id,school_id:school.id,role:'alumnus',verified:false},{onConflict:'user_id,school_id,role'});
    if(mErr){setSavingSchool(null);setLoadError(mErr.message);return;}
    const existing=commitments.find(c=>c.school_id===school.id);
    if(existing){
      const {error}=await supabase.from('commitments').update({status:'pending',cancelled_at:null}).eq('id',existing.id).eq('user_id',user.id);
      if(error){setSavingSchool(null);setLoadError(error.message);return;}
    }else{
      const {error}=await supabase.from('commitments').insert({user_id:user.id,school_id:school.id,amount_cents:1000,currency:'ZAR',frequency:'monthly',status:'pending'});
      if(error){setSavingSchool(null);setLoadError(error.message);return;}
    }
    await loadPrivate(user.id); setSavingSchool(null);
  }

  async function removeSchool(schoolId:string){
    if(!user) return; setSavingSchool(schoolId); setLoadError('');
    const {error:mErr}=await supabase.from('school_memberships').delete().eq('user_id',user.id).eq('school_id',schoolId);
    if(mErr){setSavingSchool(null);setLoadError(mErr.message);return;}
    const {error:cErr}=await supabase.from('commitments').update({status:'cancelled',cancelled_at:new Date().toISOString()}).eq('user_id',user.id).eq('school_id',schoolId);
    if(cErr){setSavingSchool(null);setLoadError(cErr.message);return;}
    await loadPrivate(user.id); if(selectedSchool?.id===schoolId)setSelectedSchool(null); setSavingSchool(null);
  }

  async function loadPrivate(userId:string){
    const [{data:m,error:mErr},{data:c,error:cErr}]=await Promise.all([
      supabase.from('school_memberships').select('id,school_id,graduation_year,start_year,end_year,verified,schools(id,name,level,province,municipality,town,verified)').eq('user_id',userId),
      supabase.from('commitments').select('id,school_id,amount_cents,frequency,status,payment_provider').eq('user_id',userId)
    ]);
    if(mErr){setLoadError(mErr.message);return;} if(cErr){setLoadError(cErr.message);return;}
    setMemberships((m??[]) as unknown as UserMembership[]); setCommitments((c??[]) as Commitment[]);
  }

  async function updateYear(schoolId:string,year:string){
    if(!user) return;
    setMemberships(prev=>prev.map(m=>m.school_id===schoolId?{...m,graduation_year:year?Number(year):null}:m));
    const {error}=await supabase.from('school_memberships').update({graduation_year:year?Number(year):null}).eq('user_id',user.id).eq('school_id',schoolId);
    if(error)setLoadError(error.message);
  }

  async function updateAmount(schoolId:string,amount:number){
    if(!user) return;
    setCommitments(prev=>prev.map(c=>c.school_id===schoolId?{...c,amount_cents:amount*100}:c));
    const existing=commitments.find(c=>c.school_id===schoolId);
    const result=existing
      ? await supabase.from('commitments').update({amount_cents:amount*100}).eq('id',existing.id).eq('user_id',user.id)
      : await supabase.from('commitments').insert({user_id:user.id,school_id:schoolId,amount_cents:amount*100,currency:'ZAR',frequency:'monthly',status:'pending'});
    if(result.error)setLoadError(result.error.message);
  }

  const membershipMap=useMemo(()=>new Map(memberships.map(m=>[m.school_id,m])),[memberships]);
  const commitmentMap=useMemo(()=>new Map(commitments.filter(c=>c.status!=='cancelled').map(c=>[c.school_id,c])),[commitments]);
  const mySchools=useMemo(()=>schools.filter(s=>membershipMap.has(s.id)),[schools,membershipMap]);
  const mySchoolIds=useMemo(()=>new Set(memberships.map(m=>m.school_id)),[memberships]);
  const myProjects=useMemo(()=>projects.filter(p=>mySchoolIds.has(p.school_id)),[projects,mySchoolIds]);
  const monthly=commitments.filter(c=>c.status!=='cancelled').reduce((sum,c)=>sum+c.amount_cents,0)/100;
  const filteredSchools=useMemo(()=>{const q=query.trim().toLowerCase();return schools.filter(s=>(!q||`${s.name} ${s.town??''} ${s.municipality??''} ${s.province}`.toLowerCase().includes(q))&&(province==='All provinces'||s.province===province)&&(level==='all'||s.level===level));},[schools,query,province,level]);

  if(!authReady) return <main className="auth-shell"><div className="auth-card"><span className="brand-mark"><GraduationCap size={22}/></span><h2>Opening Skolo Saka…</h2></div></main>;
  if(authStep==='pin') return <PinGate pin={pin} busy={authBusy} error={authError} setPin={setPin} onUnlock={unlockWithPin} onSms={()=>{setAuthStep('phone');setAuthError('');setPin('');}}/>;
  if(!user || authStep==='otp') return <AuthGate step={authStep==='otp'?'otp':'phone'} phone={phone} otp={otp} busy={authBusy} message={authMessage} error={authError} setPhone={setPhone} setOtp={setOtp} onSend={sendOtp} onVerify={verifyOtp} onBack={()=>{setAuthStep('phone');setAuthError('');setOtp('');}}/>;

  const displayName=user.user_metadata?.full_name || user.phone || 'Alumnus';

  return <main className="app-shell">
    <aside className="app-sidebar">
      <button className="brand side-brand" onClick={()=>setView('home')}><span className="brand-mark"><GraduationCap size={20}/></span><span>Skolo Saka</span></button>
      <div className="pilot-pill"><ShieldCheck size={14}/> Signed in</div>
      <nav className="app-nav"><NavButton active={view==='home'} icon={<Home/>} label="Home" onClick={()=>setView('home')}/><NavButton active={view==='schools'} icon={<Building2/>} label="Schools" badge={memberships.length||undefined} onClick={()=>setView('schools')}/><NavButton active={view==='projects'} icon={<Trophy/>} label="Projects" badge={myProjects.length||undefined} onClick={()=>setView('projects')}/><NavButton active={view==='profile'} icon={<CircleUserRound/>} label="Profile" onClick={()=>setView('profile')}/></nav>
      <div className="side-summary"><small>Monthly</small><strong>R{monthly}</strong><span>{memberships.length} {memberships.length===1?'school':'schools'}</span></div>
    </aside>

    <section className="app-main">
      <header className="app-topbar"><button className="mobile-brand" onClick={()=>setView('home')}><GraduationCap size={20}/> Skolo Saka</button><div className="topbar-spacer"/><button className="round-btn" aria-label="Notifications"><Bell size={18}/></button><div className="user-chip"><span className="avatar">{displayName[0]?.toUpperCase()}</span><span><b>{displayName}</b><small>{user.phone}</small></span></div></header>

      {loadError&&<div className="global-error">{loadError}</div>}
      {view==='home'&&<div className="page-content">{loading?<div className="state-message">Loading…</div>:memberships.length===0?<section className="first-time-card"><div><span className="eyebrow">Welcome</span><h1>Which schools made you?</h1><p>Add your primary school, high school, or both.</p><button className="primary" onClick={()=>setView('schools')}>Find my schools <ChevronRight size={18}/></button></div><div className="onboarding-steps"><Step n="1" title="Find your schools" text="Search by school name or location."/><Step n="2" title="Set your contribution" text="Choose a monthly amount from R10."/><Step n="3" title="Follow the impact" text="See projects and updates from your schools."/></div></section>:<><section className="welcome-row"><div><span className="eyebrow">Your account</span><h1>Good to see you.</h1><p>{memberships.length} {memberships.length===1?'school':'schools'} connected.</p></div><button className="outline" onClick={()=>setView('schools')}><Plus size={17}/> Add school</button></section><section className="metric-grid"><Metric label="Schools" value={String(memberships.length)} note="Connected"/><Metric label="Monthly" value={`R${monthly}`} note="Payments not live"/><Metric label="Projects" value={String(myProjects.length)} note="Following"/></section><SectionHeader title="My schools" action="Manage" onClick={()=>setView('schools')}/><div className="my-school-grid">{mySchools.map((s,i)=>{const m=membershipMap.get(s.id)!;const c=commitmentMap.get(s.id);return <MySchoolCard key={s.id} school={s} year={m.graduation_year?.toString()||''} amount={(c?.amount_cents||1000)/100} index={i} onRemove={()=>removeSchool(s.id)} onOpen={()=>setSelectedSchool(s)}/>;})}</div><SectionHeader title="Projects" action="See all" onClick={()=>setView('projects')}/><ProjectGrid projects={myProjects.slice(0,3)} schools={schools}/></>}</div>}

      {view==='schools'&&<div className="page-content"><section className="page-heading"><div><span className="eyebrow">Schools</span><h1>Find your school.</h1></div><div className="directory-count"><strong>{loading?'…':schools.length.toLocaleString()}</strong><span>available</span></div></section><div className="directory-toolbar"><label className="directory-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search school or location"/></label><select value={province} onChange={e=>setProvince(e.target.value)}>{PROVINCES.map(p=><option key={p}>{p}</option>)}</select></div><div className="filter-pills">{(['all','primary','high','combined'] as SchoolLevelFilter[]).map(item=><button key={item} className={level===item?'active':''} onClick={()=>setLevel(item)}>{item==='all'?'All':item==='primary'?'Primary':item==='high'?'High':'Combined'}</button>)}</div>{loading?<div className="state-message">Loading…</div>:<div className="directory-layout"><div><div className="results-row"><b>{filteredSchools.length.toLocaleString()} results</b></div><div className="directory-list">{filteredSchools.map(s=>{const m=membershipMap.get(s.id);return <article className="directory-school" key={s.id}><button className="school-main" onClick={()=>setSelectedSchool(s)}><span className="school-badge">{initials(s.name)}</span><span className="school-copy"><b>{s.name}</b><small>{levelLabel(s.level)} · {s.town||s.municipality||s.province}</small><em><MapPin size={12}/>{s.province}{s.verified?' · Verified':''}</em></span></button>{m?<button className="remove-btn" disabled={savingSchool===s.id} onClick={()=>removeSchool(s.id)}><Minus size={16}/> Remove</button>:<button className="add-btn" disabled={savingSchool===s.id} onClick={()=>addSchool(s)}><Plus size={16}/> Add</button>}</article>;})}{!filteredSchools.length&&<div className="empty-state"><Search size={28}/><h3>No schools found</h3><p>Try another search.</p></div>}</div></div><aside className="my-selection-panel"><div className="panel-title"><div><span className="eyebrow">My schools</span><h3>{memberships.length} selected</h3></div><WalletCards size={20}/></div>{!mySchools.length?<p className="muted">Add a school from the directory.</p>:mySchools.map(s=>{const m=membershipMap.get(s.id)!;const c=commitmentMap.get(s.id);return <div className="selection-item" key={s.id}><div><b>{s.name}</b><small>{levelLabel(s.level)}</small></div><button aria-label={`Remove ${s.name}`} onClick={()=>removeSchool(s.id)}><X size={15}/></button><label>Year<input value={m.graduation_year?.toString()||''} onChange={e=>updateYear(s.id,e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="2008"/></label><label>Monthly<select value={(c?.amount_cents||1000)/100} onChange={e=>updateAmount(s.id,Number(e.target.value))}>{[10,25,50,100,250,500].map(a=><option value={a} key={a}>R{a}</option>)}</select></label></div>;})}<div className="selection-total"><span>Total</span><strong>R{monthly}/month</strong></div><button className="primary full" disabled={!mySchools.length} onClick={()=>setView('home')}><Check size={17}/> Done</button></aside></div>}</div>}

      {view==='projects'&&<div className="page-content"><section className="page-heading"><div><span className="eyebrow">Projects</span><h1>School projects.</h1></div></section>{myProjects.length>0&&<><SectionHeader title="My schools"/><ProjectGrid projects={myProjects} schools={schools}/></>}<SectionHeader title="All projects"/><ProjectGrid projects={projects} schools={schools}/></div>}

      {view==='profile'&&<div className="page-content profile-page"><section className="page-heading"><div><span className="eyebrow">Profile</span><h1>Account.</h1></div></section><div className="profile-grid"><article className="settings-card"><div className="settings-icon"><Phone/></div><h3>Phone</h3><p>{user.phone}</p><span className="status-pill"><Check size={13}/> Verified</span></article><article className="settings-card"><div className="settings-icon"><ShieldCheck/></div><h3>PIN</h3><p>Use your 4-digit PIN on this trusted device. SMS is only needed when the secure session expires or on a new device.</p></article><article className="settings-card"><div className="settings-icon"><LogOut/></div><h3>Sign out</h3><button className="danger-outline" onClick={signOut}>Sign out</button></article></div></div>}
    </section>

    <nav className="mobile-nav"><NavButton active={view==='home'} icon={<Home/>} label="Home" onClick={()=>setView('home')}/><NavButton active={view==='schools'} icon={<Building2/>} label="Schools" onClick={()=>setView('schools')}/><NavButton active={view==='projects'} icon={<Trophy/>} label="Projects" onClick={()=>setView('projects')}/><NavButton active={view==='profile'} icon={<CircleUserRound/>} label="Profile" onClick={()=>setView('profile')}/></nav>
    {selectedSchool&&<SchoolDrawer school={selectedSchool} projects={projects.filter(p=>p.school_id===selectedSchool.id)} membership={membershipMap.get(selectedSchool.id)} commitment={commitmentMap.get(selectedSchool.id)} onClose={()=>setSelectedSchool(null)} onAdd={()=>addSchool(selectedSchool)} onRemove={()=>removeSchool(selectedSchool.id)} onYear={year=>updateYear(selectedSchool.id,year)} onAmount={amount=>updateAmount(selectedSchool.id,amount)}/>} 
  </main>;
}

function AuthGate({step,phone,otp,busy,message,error,setPhone,setOtp,onSend,onVerify,onBack}:{step:'phone'|'otp';phone:string;otp:string;busy:boolean;message:string;error:string;setPhone:(v:string)=>void;setOtp:(v:string)=>void;onSend:(e?:FormEvent)=>void;onVerify:()=>void;onBack:()=>void}){
  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><GraduationCap size={22}/></span><b>Skolo Saka</b></div>{step==='phone'?<form onSubmit={onSend}><h1>Continue with your phone</h1><label>Mobile number</label><div className="auth-phone"><span>+27</span><input autoFocus inputMode="numeric" value={phone.replace(/^\+27/,'')} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="82 123 4567"/></div>{error&&<div className="message error">{error}</div>}<button className="primary full" disabled={busy||phone.replace(/\D/g,'').length<9}>{busy?'Sending…':'Continue'} <ChevronRight size={18}/></button></form>:<div><button className="auth-back" onClick={onBack}><ChevronLeft size={17}/> Change number</button><h1>Enter the code</h1><p>{message||`Code sent to ${phone}`}</p><input className="otp-single" autoFocus inputMode="numeric" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456"/>{error&&<div className="message error">{error}</div>}<button className="primary full" disabled={busy||otp.length!==6} onClick={onVerify}>{busy?'Checking…':'Verify'} <ChevronRight size={18}/></button></div>}</section></main>;
}
function PinGate({pin,busy,error,setPin,onUnlock,onSms}:{pin:string;busy:boolean;error:string;setPin:(v:string)=>void;onUnlock:()=>void;onSms:()=>void}){return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><GraduationCap size={22}/></span><b>Skolo Saka</b></div><h1>Enter your PIN</h1><input className="pin-input" autoFocus type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••"/>{error&&<div className="message error">{error}</div>}<button className="primary full" disabled={busy||pin.length!==4} onClick={onUnlock}>{busy?'Checking…':'Sign in'} <ChevronRight size={18}/></button><button className="auth-secondary" onClick={onSms}>Use SMS instead</button></section></main>}
function NavButton({active,icon,label,badge,onClick}:{active:boolean;icon:ReactNode;label:string;badge?:number;onClick:()=>void}){return <button className={active?'active':''} onClick={onClick}>{icon}<span>{label}</span>{badge?<b className="nav-badge">{badge}</b>:null}</button>}
function Step({n,title,text}:{n:string;title:string;text:string}){return <div className="step-card"><span>{n}</span><div><b>{title}</b><p>{text}</p></div></div>}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <article className="metric"><small>{label}</small><strong>{value}</strong><em>{note}</em></article>}
function SectionHeader({title,action,onClick}:{title:string;action?:string;onClick?:()=>void}){return <div className="section-title"><h3>{title}</h3>{action&&<button onClick={onClick}>{action}<ChevronRight size={15}/></button>}</div>}
function MySchoolCard({school,year,amount,index,onRemove,onOpen}:{school:School;year:string;amount:number;index:number;onRemove:()=>void;onOpen:()=>void}){return <article className={`my-school-card ${index===0?'featured':''}`}><button className="school-card-open" onClick={onOpen}><span className="school-badge large">{initials(school.name)}</span><div><small>{levelLabel(school.level)}</small><h3>{school.name}</h3><p>{school.town||school.municipality||school.province}, {school.province}</p></div><ChevronRight size={18}/></button><div className="school-mini-stats"><span><b>R{amount}</b><small>monthly</small></span><span><b>{year||'—'}</b><small>year</small></span><span><b>Pending</b><small>payment</small></span></div><button className="remove-school-link" onClick={onRemove}><Minus size={15}/> Remove</button></article>}
function ProjectGrid({projects,schools}:{projects:Project[];schools:School[]}){const sm=new Map(schools.map(s=>[s.id,s]));return <div className="projects-grid">{projects.map(p=><article className="project-card" key={p.id}><div className="project-top"><span className="project-icon">{p.category?.toLowerCase().includes('sport')?'⚽':p.category?.toLowerCase().includes('computer')?'💻':'🏫'}</span><span className="status-pill">{p.status}</span></div><small className="project-school">{sm.get(p.school_id)?.name||'School project'}</small><h3>{p.title}</h3><p>{p.description||'Project details will be published by the school.'}</p><div className="project-bottom"><b>Target {money(p.target_cents)}</b><span>Funding not live</span></div></article>)}</div>}
function SchoolDrawer({school,projects,membership,commitment,onClose,onAdd,onRemove,onYear,onAmount}:{school:School;projects:Project[];membership?:UserMembership;commitment?:Commitment;onClose:()=>void;onAdd:()=>void;onRemove:()=>void;onYear:(year:string)=>void;onAmount:(amount:number)=>void}){return <div className="drawer-backdrop" onClick={onClose}><aside className="school-drawer" onClick={e=>e.stopPropagation()}><button className="drawer-close" onClick={onClose}><X/></button><span className="school-badge drawer-badge">{initials(school.name)}</span><span className="eyebrow">{levelLabel(school.level)}</span><h2>{school.name}</h2><p className="drawer-location"><MapPin size={15}/>{school.town||school.municipality||school.province}, {school.province}</p>{school.verified&&<span className="verified-chip"><ShieldCheck size={14}/> Verified</span>}<div className="drawer-section"><h4>Your relationship</h4>{membership?<div className="drawer-controls"><label>Leaving / matric year<input value={membership.graduation_year?.toString()||''} onChange={e=>onYear(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="2008"/></label><label>Monthly amount<select value={(commitment?.amount_cents||1000)/100} onChange={e=>onAmount(Number(e.target.value))}>{[10,25,50,100,250,500].map(a=><option key={a} value={a}>R{a}</option>)}</select></label><button className="danger-outline full" onClick={onRemove}><Minus size={16}/> Remove</button></div>:<button className="primary full" onClick={onAdd}><Plus size={17}/> Add</button>}</div><div className="drawer-section"><h4>Projects</h4>{projects.length?projects.map(p=><div className="drawer-project" key={p.id}><div><b>{p.title}</b><small>{p.status} · Target {money(p.target_cents)}</small></div><ChevronRight size={16}/></div>):<p className="muted">No projects yet.</p>}</div><div className="drawer-note"><HeartHandshake size={18}/><span>Follow this school’s projects and updates.</span></div></aside></div>}
