'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Building2, Check, ChevronLeft, ChevronRight, CircleUserRound, GraduationCap,
  HeartHandshake, Home, LogOut, MapPin, Minus, Phone, Plus, Search, ShieldCheck,
  Trophy, WalletCards, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Commitment, Membership, Profile, Project, School } from '@/lib/types';

type View = 'home' | 'schools' | 'projects' | 'profile';
type SchoolLevelFilter = 'all' | 'primary' | 'high' | 'combined';
type AuthStep = 'login' | 'register' | 'otp' | 'create-pin';
type UserMembership = Membership & { schools?: School };

type ProfileDraft = { first_name: string; last_name: string; email: string };

const PROVINCES = ['All provinces','Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];
const GRADES = Array.from({length:12},(_,i)=>i+1);

const money = (cents:number) => new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(cents/100);

function levelLabel(level: School['level']) {
  if (level === 'primary') return 'Primary School';
  if (level === 'high') return 'High School';
  if (level === 'combined') return 'Combined School';
  return 'School';
}
function initials(name:string) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
function normalizeSaPhone(value:string) {
  const digits=value.replace(/\D/g,'');
  if(digits.startsWith('27')) return `+${digits}`;
  if(digits.startsWith('0')) return `+27${digits.slice(1)}`;
  return `+27${digits}`;
}
async function pinPassword(phone:string,pin:string){
  const source=new TextEncoder().encode(`skolo-saka-auth-v1:${normalizeSaPhone(phone)}:${pin}:south-africa`);
  const digest=await crypto.subtle.digest('SHA-256',source);
  const hex=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  return `Ss!${hex}`;
}
async function fetchAllSchools():Promise<School[]>{
  const rows:School[]=[]; const pageSize=1000;
  for(let from=0;;from+=pageSize){
    const {data,error}=await supabase.from('schools').select('id,name,level,province,municipality,town,verified').order('name').range(from,from+pageSize-1);
    if(error) throw error; const batch=(data??[]) as School[]; rows.push(...batch); if(batch.length<pageSize) break;
  }
  return rows;
}
async function fetchAllProjects():Promise<Project[]>{
  const rows:Project[]=[]; const pageSize=1000;
  for(let from=0;;from+=pageSize){
    const {data,error}=await supabase.from('projects').select('id,school_id,title,description,category,target_cents,status,priority').order('priority').range(from,from+pageSize-1);
    if(error) throw error; const batch=(data??[]) as Project[]; rows.push(...batch); if(batch.length<pageSize) break;
  }
  return rows;
}

export default function Page(){
  const [user,setUser]=useState<User|null>(null);
  const [authStep,setAuthStep]=useState<AuthStep>('login');
  const [phone,setPhone]=useState('');
  const [pin,setPin]=useState('');
  const [otp,setOtp]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [authError,setAuthError]=useState('');
  const [authMessage,setAuthMessage]=useState('');

  const [view,setView]=useState<View>('home');
  const [schools,setSchools]=useState<School[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const [memberships,setMemberships]=useState<UserMembership[]>([]);
  const [commitments,setCommitments]=useState<Commitment[]>([]);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [profileDraft,setProfileDraft]=useState<ProfileDraft>({first_name:'',last_name:'',email:''});
  const [profileSaving,setProfileSaving]=useState(false);
  const [profileSaved,setProfileSaved]=useState(false);
  const [query,setQuery]=useState('');
  const [province,setProvince]=useState('All provinces');
  const [level,setLevel]=useState<SchoolLevelFilter>('all');
  const [selectedSchool,setSelectedSchool]=useState<School|null>(null);
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [savingSchool,setSavingSchool]=useState<string|null>(null);

  async function loadApp(activeUser:User){
    setLoading(true); setLoadError('');
    try{
      const [schoolRows,projectRows,{data:m,error:mErr},{data:c,error:cErr},{data:p,error:pErr}]=await Promise.all([
        fetchAllSchools(), fetchAllProjects(),
        supabase.from('school_memberships').select('id,school_id,graduation_year,start_year,end_year,grade_left,verified,schools(id,name,level,province,municipality,town,verified)').eq('user_id',activeUser.id),
        supabase.from('commitments').select('id,school_id,amount_cents,frequency,status,payment_provider').eq('user_id',activeUser.id),
        supabase.from('profiles').select('id,phone,first_name,last_name,email').eq('id',activeUser.id).maybeSingle()
      ]);
      if(mErr) throw mErr; if(cErr) throw cErr; if(pErr) throw pErr;
      const profileRow=(p??{id:activeUser.id,phone:activeUser.phone??null,first_name:null,last_name:null,email:null}) as Profile;
      setSchools(schoolRows); setProjects(projectRows); setMemberships((m??[]) as unknown as UserMembership[]); setCommitments((c??[]) as Commitment[]); setProfile(profileRow);
      setProfileDraft({first_name:profileRow.first_name??'',last_name:profileRow.last_name??'',email:profileRow.email??''});
    }catch(error){ setLoadError(error instanceof Error?error.message:'Could not load Skolo Saka.'); }
    finally{ setLoading(false); }
  }

  async function signIn(e?:FormEvent){
    e?.preventDefault();
    if(pin.length!==4) return;
    setAuthBusy(true); setAuthError(''); setAuthMessage('');
    const normalized=normalizeSaPhone(phone);
    const password=await pinPassword(normalized,pin);
    const {data,error}=await supabase.auth.signInWithPassword({phone:normalized,password});
    setAuthBusy(false);
    if(error||!data.user){
      setAuthError('Couldn’t sign in. Verify by SMS to register or reset your PIN.');
      return;
    }
    setPhone(normalized); setPin(''); setUser(data.user); setView('home');
    await loadApp(data.user);
  }

  async function sendOtp(e?:FormEvent){
    e?.preventDefault();
    setAuthBusy(true); setAuthError(''); setAuthMessage('');
    const normalized=normalizeSaPhone(phone);
    const {error}=await supabase.auth.signInWithOtp({phone:normalized,options:{shouldCreateUser:true}});
    setAuthBusy(false);
    if(error){ setAuthError(error.message); return; }
    setPhone(normalized); setOtp(''); setAuthStep('otp'); setAuthMessage(`Code sent to ${normalized}`);
  }

  async function verifyOtp(){
    setAuthBusy(true); setAuthError('');
    const normalized=normalizeSaPhone(phone);
    const {data,error}=await supabase.auth.verifyOtp({phone:normalized,token:otp,type:'sms'});
    setAuthBusy(false);
    if(error||!data.user){ setAuthError(error?.message||'Could not verify this number.'); return; }
    setUser(data.user); setOtp(''); setPin(''); setAuthStep('create-pin');
  }

  async function createPin(){
    if(pin.length!==4) return;
    setAuthBusy(true); setAuthError('');
    const password=await pinPassword(phone,pin);
    const {data,error}=await supabase.auth.updateUser({password});
    setAuthBusy(false);
    if(error||!data.user){ setAuthError(error?.message||'Could not save your PIN.'); return; }
    setPin(''); setUser(data.user); setAuthStep('login'); setView('home');
    await loadApp(data.user);
  }

  async function signOut(){
    await supabase.auth.signOut();
    setUser(null); setView('home'); setPhone(''); setPin(''); setOtp(''); setAuthError(''); setAuthMessage(''); setAuthStep('login');
    setSchools([]); setProjects([]); setMemberships([]); setCommitments([]); setProfile(null);
  }

  async function saveProfile(e?:FormEvent){
    e?.preventDefault(); if(!user) return;
    setProfileSaving(true); setProfileSaved(false); setLoadError('');
    const first=profileDraft.first_name.trim(); const last=profileDraft.last_name.trim(); const email=profileDraft.email.trim()||null;
    const {data,error}=await supabase.from('profiles').update({first_name:first||null,last_name:last||null,email,full_name:[first,last].filter(Boolean).join(' ')||null,updated_at:new Date().toISOString()}).eq('id',user.id).select('id,phone,first_name,last_name,email').single();
    setProfileSaving(false);
    if(error){ setLoadError(error.message); return; }
    setProfile(data as Profile); setProfileSaved(true); setTimeout(()=>setProfileSaved(false),1800);
  }

  async function loadPrivate(userId:string){
    const [{data:m,error:mErr},{data:c,error:cErr}]=await Promise.all([
      supabase.from('school_memberships').select('id,school_id,graduation_year,start_year,end_year,grade_left,verified,schools(id,name,level,province,municipality,town,verified)').eq('user_id',userId),
      supabase.from('commitments').select('id,school_id,amount_cents,frequency,status,payment_provider').eq('user_id',userId)
    ]);
    if(mErr){setLoadError(mErr.message);return;} if(cErr){setLoadError(cErr.message);return;}
    setMemberships((m??[]) as unknown as UserMembership[]); setCommitments((c??[]) as Commitment[]);
  }

  async function addSchool(school:School,year:number|null,grade:number|null){
    if(!user) return; setSavingSchool(school.id); setLoadError('');
    const {error:mErr}=await supabase.from('school_memberships').upsert({user_id:user.id,school_id:school.id,role:'alumnus',graduation_year:year,grade_left:grade,verified:false},{onConflict:'user_id,school_id,role'});
    if(mErr){setSavingSchool(null);setLoadError(mErr.message);return;}
    const existing=commitments.find(c=>c.school_id===school.id);
    const result=existing
      ? await supabase.from('commitments').update({status:'pending',cancelled_at:null}).eq('id',existing.id).eq('user_id',user.id)
      : await supabase.from('commitments').insert({user_id:user.id,school_id:school.id,amount_cents:1000,currency:'ZAR',frequency:'monthly',status:'pending'});
    if(result.error){setSavingSchool(null);setLoadError(result.error.message);return;}
    await loadPrivate(user.id); setSavingSchool(null); setSelectedSchool(null);
  }

  async function removeSchool(schoolId:string){
    if(!user) return; setSavingSchool(schoolId); setLoadError('');
    const {error:mErr}=await supabase.from('school_memberships').delete().eq('user_id',user.id).eq('school_id',schoolId);
    if(mErr){setSavingSchool(null);setLoadError(mErr.message);return;}
    const {error:cErr}=await supabase.from('commitments').update({status:'cancelled',cancelled_at:new Date().toISOString()}).eq('user_id',user.id).eq('school_id',schoolId);
    if(cErr){setSavingSchool(null);setLoadError(cErr.message);return;}
    await loadPrivate(user.id); setSelectedSchool(null); setSavingSchool(null);
  }

  async function updateMembership(schoolId:string,year:number|null,grade:number|null){
    if(!user) return;
    setMemberships(prev=>prev.map(m=>m.school_id===schoolId?{...m,graduation_year:year,grade_left:grade}:m));
    const {error}=await supabase.from('school_memberships').update({graduation_year:year,grade_left:grade}).eq('user_id',user.id).eq('school_id',schoolId);
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
  const displayName=[profile?.first_name,profile?.last_name].filter(Boolean).join(' ')||user?.phone||'Alumnus';

  if(!user){
    if(authStep==='otp') return <OtpGate phone={phone} otp={otp} busy={authBusy} error={authError} message={authMessage} setOtp={setOtp} onVerify={verifyOtp} onBack={()=>{setAuthStep('register');setAuthError('');}}/>;
    if(authStep==='create-pin') return <PinCreate pin={pin} busy={authBusy} error={authError} setPin={setPin} onSave={createPin}/>;
    return <AuthGate mode={authStep} phone={phone} pin={pin} busy={authBusy} error={authError} setPhone={setPhone} setPin={setPin} onLogin={signIn} onRegister={sendOtp} onMode={mode=>{setAuthStep(mode);setAuthError('');setPin('');}}/>;
  }

  return <main className="app-shell">
    <aside className="app-sidebar">
      <button className="brand side-brand" onClick={()=>setView('home')}><span className="brand-mark"><GraduationCap size={20}/></span><span>Skolo Saka</span></button>
      <nav className="app-nav"><NavButton active={view==='home'} icon={<Home/>} label="Home" onClick={()=>setView('home')}/><NavButton active={view==='schools'} icon={<Building2/>} label="Schools" badge={memberships.length||undefined} onClick={()=>setView('schools')}/><NavButton active={view==='projects'} icon={<Trophy/>} label="Projects" badge={myProjects.length||undefined} onClick={()=>setView('projects')}/><NavButton active={view==='profile'} icon={<CircleUserRound/>} label="Profile" onClick={()=>setView('profile')}/></nav>
      <div className="side-summary"><small>Monthly</small><strong>R{monthly}</strong><span>{memberships.length} {memberships.length===1?'school':'schools'}</span></div>
    </aside>

    <section className="app-main">
      <header className="app-topbar"><button className="mobile-brand" onClick={()=>setView('home')}><GraduationCap size={20}/> Skolo Saka</button><div className="topbar-spacer"/><button className="user-chip" onClick={()=>setView('profile')}><span className="avatar">{displayName[0]?.toUpperCase()}</span><span><b>{displayName}</b><small>{user.phone}</small></span></button></header>
      {loadError&&<div className="global-error">{loadError}</div>}

      {view==='home'&&<div className="page-content">{loading?<div className="state-message">Loading…</div>:memberships.length===0?<section className="first-time-card"><div><span className="eyebrow">Welcome</span><h1>Which schools made you?</h1><p>Add your school and the year and grade you left.</p><button className="primary" onClick={()=>setView('schools')}>Find my schools <ChevronRight size={18}/></button></div></section>:<><section className="welcome-row"><div><span className="eyebrow">Your account</span><h1>{profile?.first_name?`Hi, ${profile.first_name}.`:'Good to see you.'}</h1><p>{memberships.length} {memberships.length===1?'school':'schools'} connected.</p></div><button className="outline" onClick={()=>setView('schools')}><Plus size={17}/> Add school</button></section><section className="metric-grid"><Metric label="Schools" value={String(memberships.length)} note="Connected"/><Metric label="Monthly" value={`R${monthly}`} note="Payments not live"/><Metric label="Projects" value={String(myProjects.length)} note="Following"/></section><SectionHeader title="My schools" action="Manage" onClick={()=>setView('schools')}/><div className="my-school-grid">{mySchools.map((s,i)=>{const m=membershipMap.get(s.id)!;const c=commitmentMap.get(s.id);return <MySchoolCard key={s.id} school={s} year={m.graduation_year} grade={m.grade_left} amount={(c?.amount_cents||1000)/100} index={i} onRemove={()=>removeSchool(s.id)} onOpen={()=>setSelectedSchool(s)}/>;})}</div></>}</div>}

      {view==='schools'&&<div className="page-content"><section className="page-heading"><div><span className="eyebrow">Schools</span><h1>Find your school.</h1></div><div className="directory-count"><strong>{loading?'…':schools.length.toLocaleString()}</strong><span>available</span></div></section><div className="directory-toolbar"><label className="directory-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search school or location"/></label><select value={province} onChange={e=>setProvince(e.target.value)}>{PROVINCES.map(p=><option key={p}>{p}</option>)}</select></div><div className="filter-pills">{(['all','primary','high','combined'] as SchoolLevelFilter[]).map(item=><button key={item} className={level===item?'active':''} onClick={()=>setLevel(item)}>{item==='all'?'All':item==='primary'?'Primary':item==='high'?'High':'Combined'}</button>)}</div>{loading?<div className="state-message">Loading…</div>:<div className="directory-layout"><div><div className="results-row"><b>{filteredSchools.length.toLocaleString()} results</b></div><div className="directory-list">{filteredSchools.map(s=>{const m=membershipMap.get(s.id);return <article className="directory-school" key={s.id}><button className="school-main" onClick={()=>setSelectedSchool(s)}><span className="school-badge">{initials(s.name)}</span><span className="school-copy"><b>{s.name}</b><small>{levelLabel(s.level)} · {s.town||s.municipality||s.province}</small><em><MapPin size={12}/>{s.province}{s.verified?' · Verified':''}</em></span></button>{m?<button className="remove-btn" disabled={savingSchool===s.id} onClick={()=>removeSchool(s.id)}><Minus size={16}/> Remove</button>:<button className="add-btn" onClick={()=>setSelectedSchool(s)}><Plus size={16}/> Add</button>}</article>;})}</div></div><aside className="my-selection-panel"><div className="panel-title"><div><span className="eyebrow">My schools</span><h3>{memberships.length} selected</h3></div><WalletCards size={20}/></div>{!mySchools.length?<p className="muted">Add a school from the directory.</p>:mySchools.map(s=>{const m=membershipMap.get(s.id)!;const c=commitmentMap.get(s.id);return <div className="selection-item" key={s.id}><div><b>{s.name}</b><small>{m.graduation_year||'Year not set'} · {m.grade_left?`Grade ${m.grade_left}`:'Grade not set'}</small></div><button aria-label={`Remove ${s.name}`} onClick={()=>removeSchool(s.id)}><X size={15}/></button><label>Monthly<select value={(c?.amount_cents||1000)/100} onChange={e=>updateAmount(s.id,Number(e.target.value))}>{[10,25,50,100,250,500].map(a=><option value={a} key={a}>R{a}</option>)}</select></label></div>;})}<div className="selection-total"><span>Total</span><strong>R{monthly}/month</strong></div></aside></div>}</div>}

      {view==='projects'&&<div className="page-content"><section className="page-heading"><div><span className="eyebrow">Projects</span><h1>School projects.</h1></div></section>{myProjects.length>0&&<><SectionHeader title="My schools"/><ProjectGrid projects={myProjects} schools={schools}/></>}<SectionHeader title="All projects"/><ProjectGrid projects={projects} schools={schools}/></div>}

      {view==='profile'&&<div className="page-content profile-page"><section className="page-heading"><div><span className="eyebrow">Profile</span><h1>Your details.</h1><p>Your phone number is your account. Everything else is optional.</p></div></section><div className="profile-grid"><form className="settings-card profile-form" onSubmit={saveProfile}><div className="settings-icon"><CircleUserRound/></div><h3>Personal details</h3><div className="form-grid"><label className="field">Name<input value={profileDraft.first_name} onChange={e=>setProfileDraft(v=>({...v,first_name:e.target.value}))} placeholder="Name"/></label><label className="field">Surname<input value={profileDraft.last_name} onChange={e=>setProfileDraft(v=>({...v,last_name:e.target.value}))} placeholder="Surname"/></label><label className="field field-full">Email<input type="email" value={profileDraft.email} onChange={e=>setProfileDraft(v=>({...v,email:e.target.value}))} placeholder="name@example.com"/></label></div><button className="primary" disabled={profileSaving}>{profileSaving?'Saving…':profileSaved?'Saved':'Save profile'}</button></form><article className="settings-card"><div className="settings-icon"><Phone/></div><h3>Phone</h3><p>{user.phone}</p><span className="status-pill"><Check size={13}/> Verified</span></article><article className="settings-card"><div className="settings-icon"><LogOut/></div><h3>Sign out</h3><p>You’ll sign in again with your phone number and PIN.</p><button className="danger-outline" onClick={signOut}>Sign out</button></article></div></div>}
    </section>

    <nav className="mobile-nav"><NavButton active={view==='home'} icon={<Home/>} label="Home" onClick={()=>setView('home')}/><NavButton active={view==='schools'} icon={<Building2/>} label="Schools" onClick={()=>setView('schools')}/><NavButton active={view==='projects'} icon={<Trophy/>} label="Projects" onClick={()=>setView('projects')}/><NavButton active={view==='profile'} icon={<CircleUserRound/>} label="Profile" onClick={()=>setView('profile')}/></nav>
    {selectedSchool&&<SchoolDrawer school={selectedSchool} membership={membershipMap.get(selectedSchool.id)} commitment={commitmentMap.get(selectedSchool.id)} saving={savingSchool===selectedSchool.id} onClose={()=>setSelectedSchool(null)} onAdd={(year,grade)=>addSchool(selectedSchool,year,grade)} onRemove={()=>removeSchool(selectedSchool.id)} onUpdate={(year,grade)=>updateMembership(selectedSchool.id,year,grade)} onAmount={amount=>updateAmount(selectedSchool.id,amount)}/>} 
  </main>;
}

function AuthGate({mode,phone,pin,busy,error,setPhone,setPin,onLogin,onRegister,onMode}:{mode:'login'|'register';phone:string;pin:string;busy:boolean;error:string;setPhone:(v:string)=>void;setPin:(v:string)=>void;onLogin:(e?:FormEvent)=>void;onRegister:(e?:FormEvent)=>void;onMode:(m:'login'|'register')=>void}){
  if(mode==='register') return <main className="auth-shell"><section className="auth-card"><Brand/><button className="auth-back" onClick={()=>onMode('login')}><ChevronLeft size={17}/> Sign in</button><h1>Create account</h1><p>Enter your phone number. That’s all we need to register.</p><form onSubmit={onRegister}><PhoneField phone={phone} setPhone={setPhone}/>{error&&<div className="message error">{error}</div>}<button className="primary full" disabled={busy||phone.replace(/\D/g,'').length<9}>{busy?'Sending…':'Continue with SMS'} <ChevronRight size={18}/></button></form></section></main>;
  return <main className="auth-shell"><section className="auth-card"><Brand/><h1>Sign in</h1><form onSubmit={onLogin}><PhoneField phone={phone} setPhone={setPhone}/><label>4-digit PIN</label><input className="pin-input" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••"/>{error&&<div className="message error">{error}</div>}<button className="primary full" disabled={busy||pin.length!==4||phone.replace(/\D/g,'').length<9}>{busy?'Signing in…':'Sign in'} <ChevronRight size={18}/></button></form><button className="auth-switch" onClick={()=>onMode('register')}>Register or reset PIN</button></section></main>;
}
function PhoneField({phone,setPhone}:{phone:string;setPhone:(v:string)=>void}){return <><label>Mobile number</label><div className="auth-phone"><span>+27</span><input autoFocus inputMode="numeric" autoComplete="tel" value={phone.replace(/^\+27/,'')} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="82 123 4567"/></div></>}
function OtpGate({phone,otp,busy,error,message,setOtp,onVerify,onBack}:{phone:string;otp:string;busy:boolean;error:string;message:string;setOtp:(v:string)=>void;onVerify:()=>void;onBack:()=>void}){return <main className="auth-shell"><section className="auth-card"><Brand/><button className="auth-back" onClick={onBack}><ChevronLeft size={17}/> Change number</button><h1>Enter SMS code</h1><p>{message||phone}</p><input className="otp-single" autoFocus inputMode="numeric" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456"/>{error&&<div className="message error">{error}</div>}<button className="primary full" disabled={busy||otp.length!==6} onClick={onVerify}>{busy?'Checking…':'Verify'} <ChevronRight size={18}/></button></section></main>}
function PinCreate({pin,busy,error,setPin,onSave}:{pin:string;busy:boolean;error:string;setPin:(v:string)=>void;onSave:()=>void}){return <main className="auth-shell"><section className="auth-card"><Brand/><h1>Create your PIN</h1><p>You’ll use this 4-digit PIN with your phone number next time.</p><input className="pin-input" autoFocus type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••"/>{error&&<div className="message error">{error}</div>}<button className="primary full" disabled={busy||pin.length!==4} onClick={onSave}>{busy?'Saving…':'Continue'} <ChevronRight size={18}/></button></section></main>}
function Brand(){return <div className="auth-brand"><span className="brand-mark"><GraduationCap size={22}/></span><b>Skolo Saka</b></div>}
function NavButton({active,icon,label,badge,onClick}:{active:boolean;icon:ReactNode;label:string;badge?:number;onClick:()=>void}){return <button className={active?'active':''} onClick={onClick}>{icon}<span>{label}</span>{badge?<b className="nav-badge">{badge}</b>:null}</button>}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <article className="metric"><small>{label}</small><strong>{value}</strong><em>{note}</em></article>}
function SectionHeader({title,action,onClick}:{title:string;action?:string;onClick?:()=>void}){return <div className="section-title"><h3>{title}</h3>{action&&<button onClick={onClick}>{action}<ChevronRight size={15}/></button>}</div>}
function MySchoolCard({school,year,grade,amount,index,onRemove,onOpen}:{school:School;year:number|null;grade:number|null;amount:number;index:number;onRemove:()=>void;onOpen:()=>void}){return <article className={`my-school-card ${index===0?'featured':''}`}><button className="school-card-open" onClick={onOpen}><span className="school-badge large">{initials(school.name)}</span><div><small>{levelLabel(school.level)}</small><h3>{school.name}</h3><p>{school.town||school.municipality||school.province}</p></div><ChevronRight size={18}/></button><div className="school-mini-stats"><span><b>R{amount}</b><small>monthly</small></span><span><b>{year||'—'}</b><small>year left</small></span><span><b>{grade?`Grade ${grade}`:'—'}</b><small>grade left</small></span></div><button className="remove-school-link" onClick={onRemove}><Minus size={15}/> Remove school</button></article>}
function ProjectGrid({projects,schools}:{projects:Project[];schools:School[]}){const sm=new Map(schools.map(s=>[s.id,s]));return <div className="projects-grid">{projects.length?projects.map(p=><article className="project-card" key={p.id}><div className="project-top"><span className="project-icon">{p.category?.toLowerCase().includes('sport')?'⚽':'🏫'}</span><span className="status-pill">{p.status}</span></div><small className="project-school">{sm.get(p.school_id)?.name||'School project'}</small><h3>{p.title}</h3><p>{p.description||'Project details will be published by the school.'}</p><div className="project-bottom"><b>Target {money(p.target_cents)}</b><span>Funding not live</span></div></article>):<div className="empty-state"><Trophy size={28}/><h3>No projects yet</h3></div>}</div>}
function SchoolDrawer({school,membership,commitment,saving,onClose,onAdd,onRemove,onUpdate,onAmount}:{school:School;membership?:UserMembership;commitment?:Commitment;saving:boolean;onClose:()=>void;onAdd:(year:number|null,grade:number|null)=>void;onRemove:()=>void;onUpdate:(year:number|null,grade:number|null)=>void;onAmount:(amount:number)=>void}){
  const [year,setYear]=useState(membership?.graduation_year?.toString()||'');
  const [grade,setGrade]=useState(membership?.grade_left?.toString()||'');
  const yearValue=year?Number(year):null; const gradeValue=grade?Number(grade):null;
  return <div className="drawer-backdrop" onClick={onClose}><aside className="school-drawer" onClick={e=>e.stopPropagation()}><button className="drawer-close" onClick={onClose}><X/></button><span className="school-badge drawer-badge">{initials(school.name)}</span><span className="eyebrow">{levelLabel(school.level)}</span><h2>{school.name}</h2><p className="drawer-location"><MapPin size={15}/>{school.town||school.municipality||school.province}, {school.province}</p><div className="drawer-section"><h4>Your school details</h4><div className="drawer-controls"><label>Year you left<input inputMode="numeric" value={year} onChange={e=>setYear(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="e.g. 2012"/></label><label>Grade when you left<select value={grade} onChange={e=>setGrade(e.target.value)}><option value="">Select grade</option>{GRADES.map(g=><option key={g} value={g}>Grade {g}</option>)}</select></label>{membership&&<label>Monthly amount<select value={(commitment?.amount_cents||1000)/100} onChange={e=>onAmount(Number(e.target.value))}>{[10,25,50,100,250,500].map(a=><option key={a} value={a}>R{a}</option>)}</select></label>}{membership?<><button className="primary full" onClick={()=>onUpdate(yearValue,gradeValue)}><Check size={16}/> Save details</button><button className="danger-outline full" onClick={onRemove}><Minus size={16}/> Remove school</button></>:<button className="primary full" disabled={saving} onClick={()=>onAdd(yearValue,gradeValue)}>{saving?'Adding…':'Add school'} <ChevronRight size={17}/></button>}</div></div><div className="drawer-note"><HeartHandshake size={18}/><span>Year and grade help us reconnect classmates and school cohorts later.</span></div></aside></div>
}
