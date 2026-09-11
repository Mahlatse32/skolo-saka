'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Check, ChevronLeft, GraduationCap, HeartHandshake, Home, Search,
  ShieldCheck, Users, WalletCards, Bell, Plus, Trophy, LogOut, LockKeyhole,
  Smartphone, Building2, ReceiptText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Commitment, Membership, Project, School } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

type Screen = 'welcome' | 'phone' | 'otp' | 'pin' | 'unlock' | 'schools' | 'amount' | 'success' | 'dashboard';
const money = (cents:number) => new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(cents/100);
const schoolType = (level:School['level']) => level === 'primary' ? 'Primary School' : level === 'high' ? 'High School' : 'Combined School';

async function pinDigest(phone:string,pin:string){
  const bytes = new TextEncoder().encode(`skolo-saka:${phone}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}

export default function Page(){
  const [screen,setScreen]=useState<Screen>('welcome');
  const [user,setUser]=useState<User|null>(null);
  const [phone,setPhone]=useState('');
  const [otp,setOtp]=useState('');
  const [pin,setPin]=useState('');
  const [query,setQuery]=useState('');
  const [schools,setSchools]=useState<School[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const [memberships,setMemberships]=useState<Membership[]>([]);
  const [commitments,setCommitments]=useState<Commitment[]>([]);
  const [selected,setSelected]=useState<School[]>([]);
  const [amounts,setAmounts]=useState<Record<string,number>>({});
  const [years,setYears]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    void loadPublic();
    void supabase.auth.getSession().then(({data})=>{
      if(data.session?.user){ setUser(data.session.user); void loadPrivate(data.session.user.id); }
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setUser(session?.user ?? null);
      if(session?.user) void loadPrivate(session.user.id);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  async function loadPublic(){
    const [{data:s},{data:p}] = await Promise.all([
      supabase.from('schools').select('*').order('name'),
      supabase.from('projects').select('*').order('priority').order('created_at',{ascending:false}),
    ]);
    setSchools((s ?? []) as School[]); setProjects((p ?? []) as Project[]);
  }

  async function loadPrivate(userId:string){
    const [{data:m},{data:c}] = await Promise.all([
      supabase.from('school_memberships').select('*, schools(*)').eq('user_id',userId),
      supabase.from('commitments').select('*').eq('user_id',userId).order('created_at'),
    ]);
    setMemberships((m ?? []) as unknown as Membership[]); setCommitments((c ?? []) as Commitment[]);
  }

  const filtered=useMemo(()=>schools.filter(s=>`${s.name} ${s.town ?? ''} ${s.province} ${schoolType(s.level)}`.toLowerCase().includes(query.toLowerCase())),[schools,query]);
  const total=selected.reduce((sum,s)=>sum+(amounts[s.id]||10),0);
  const activeMonthly=commitments.filter(c=>c.status==='active').reduce((sum,c)=>sum+c.amount_cents,0);
  const pendingMonthly=commitments.filter(c=>c.status==='pending').reduce((sum,c)=>sum+c.amount_cents,0);

  function resetMessages(){setError('');setNotice('');}
  function toggleSchool(s:School){setSelected(prev=>prev.some(x=>x.id===s.id)?prev.filter(x=>x.id!==s.id):[...prev,s]);}

  async function requestOtp(e?:FormEvent){ e?.preventDefault(); resetMessages(); setBusy(true);
    const normalized = `+27${phone.replace(/^0/,'')}`;
    const {error}=await supabase.auth.signInWithOtp({phone:normalized,options:{shouldCreateUser:true}});
    setBusy(false);
    if(error){ setError(`SMS verification is not available yet: ${error.message}. You can still explore the public pilot below.`); return; }
    setNotice(`Code sent to ${normalized}`); setScreen('otp');
  }

  async function verifyOtp(){ resetMessages(); setBusy(true); const normalized=`+27${phone.replace(/^0/,'')}`;
    const {data,error}=await supabase.auth.verifyOtp({phone:normalized,token:otp,type:'sms'}); setBusy(false);
    if(error){setError(error.message);return;}
    if(data.user){setUser(data.user);setScreen('pin');}
  }

  async function savePin(){ if(pin.length!==4) return; resetMessages();
    const normalized=`+27${phone.replace(/^0/,'')}`; const hash=await pinDigest(normalized,pin);
    localStorage.setItem('skolo_saka_trusted_phone',normalized);
    localStorage.setItem('skolo_saka_pin_hash',hash);
    setPin(''); setScreen('schools');
  }

  async function trustedUnlock(){ resetMessages(); const storedPhone=localStorage.getItem('skolo_saka_trusted_phone')||'';
    const storedHash=localStorage.getItem('skolo_saka_pin_hash')||''; const hash=await pinDigest(storedPhone,pin);
    const {data}=await supabase.auth.getSession();
    if(!storedPhone || hash!==storedHash){setError('Incorrect PIN.');return;}
    if(!data.session){ setPhone(storedPhone.replace('+27','')); setPin(''); setNotice('This device needs phone verification again.'); setScreen('phone'); return; }
    setUser(data.session.user); await loadPrivate(data.session.user.id); setPin(''); setScreen('dashboard');
  }

  async function saveSchoolsAndCommitments(){ if(!user) return; resetMessages(); setBusy(true);
    const membershipRows=selected.map(s=>({user_id:user.id,school_id:s.id,role:'alumnus',graduation_year:years[s.id]?Number(years[s.id]):null,verified:false}));
    const {error:mErr}=await supabase.from('school_memberships').upsert(membershipRows,{onConflict:'user_id,school_id',ignoreDuplicates:true});
    if(mErr){setBusy(false);setError(mErr.message);return;}
    const commitmentRows=selected.map(s=>({user_id:user.id,school_id:s.id,amount_cents:(amounts[s.id]||10)*100,currency:'ZAR',frequency:'monthly',status:'pending'}));
    const {error:cErr}=await supabase.from('commitments').insert(commitmentRows);
    setBusy(false); if(cErr){setError(cErr.message);return;}
    await loadPrivate(user.id); setScreen('success');
  }

  async function signOut(){ await supabase.auth.signOut(); setUser(null); setMemberships([]); setCommitments([]); setScreen('welcome'); }
  function demo(){setScreen('dashboard');}

  return <main className="site-shell">
    <header className="topbar">
      <button className="brand" onClick={()=>setScreen('welcome')}><span className="brand-mark"><GraduationCap size={20}/></span><span>Skolo Saka</span></button>
      <span className="tag">R10 a month. For the school that made you.</span>
      {user && <button className="top-signout" onClick={signOut}><LogOut size={16}/> Sign out</button>}
    </header>

    {screen==='welcome' && <>
      <section className="hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">A lifelong alumni contribution network</span>
          <h1>Your school helped make you. <em>Keep making it better.</em></h1>
          <p>Join former learners contributing from just R10 a month to the primary and high schools that shaped them.</p>
          <div className="hero-actions"><button className="primary" onClick={()=>{resetMessages();setScreen('phone')}}>Join Skolo Saka <ArrowRight size={18}/></button><button className="ghost" onClick={()=>setScreen('unlock')}><LockKeyhole size={17}/> Trusted device login</button></div>
          <button className="demo-link" onClick={demo}>Explore the public pilot without signing in →</button>
          <div className="trust-row"><span><ShieldCheck size={17}/> Transparent</span><span><HeartHandshake size={17}/> Alumni-powered</span><span><Trophy size={17}/> Visible impact</span></div>
        </div>
        <div className="impact-card">
          <span className="mini-label">The compounding idea</span><div className="impact-number">R600,000</div><p>5,000 alumni × R10 × 12 months</p>
          {schools.slice(0,2).map(s=><div className="project-preview" key={s.id}><span>{s.level==='primary'?'📚':'🎓'}</span><div><b>{s.name}</b><small>{schoolType(s.level)} · {s.town || s.province}</small></div><strong>Join</strong></div>)}
          <div className="people-strip"><Users size={17}/><b>{schools.length}</b> pilot schools loaded from the live database</div>
        </div>
      </section>
      <section className="public-projects"><div className="section-title"><div><span className="eyebrow">Pilot priorities</span><h2>What communities can build together</h2></div></div><div className="projects">{projects.slice(0,3).map(p=><article className="project" key={p.id}><div className="project-icon">{p.category==='Sport'?'⚽':'💻'}</div><div className="project-meta"><span>{p.category||'Project'}</span><small>{p.status}</small></div><h4>{p.title}</h4><p>{p.description}</p><div className="funding"><b>Target {money(p.target_cents)}</b><span>Collections not live yet</span></div></article>)}</div></section>
    </>}

    {screen!=='welcome' && screen!=='dashboard' && <section className="flow-wrap"><div className="phone-frame">
      <div className="flow-top"><button className="icon-btn" onClick={()=>setScreen('welcome')}><ChevronLeft/></button><div className="flow-logo"><span className="brand-mark small"><GraduationCap size={16}/></span>Skolo Saka</div><span className="step-pill">Secure</span></div>
      {(error||notice) && <div className={error?'message error':'message'}>{error||notice}</div>}
      {screen==='phone' && <form className="flow-content" onSubmit={requestOtp}><span className="eyebrow">Phone verification</span><h2>Start with your number</h2><p>We use SMS once to prove the number belongs to you. Returning on a trusted device is unlocked with your PIN.</p><label>South African mobile number</label><div className="input-row"><span>🇿🇦 +27</span><input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,9))} placeholder="82 123 4567" inputMode="numeric"/></div><button className="primary full" disabled={busy||phone.length<9}>{busy?'Sending…':'Send code'} <ArrowRight size={18}/></button><button type="button" className="text-btn" onClick={demo}>Explore public pilot instead</button></form>}
      {screen==='otp' && <div className="flow-content"><span className="eyebrow">Verify</span><h2>Check your messages</h2><p>Enter the 6-digit SMS code.</p><input className="otp-single" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" inputMode="numeric"/><button className="primary full" disabled={busy||otp.length!==6} onClick={verifyOtp}>Verify number <ArrowRight size={18}/></button></div>}
      {screen==='pin' && <div className="flow-content"><span className="eyebrow">Trusted device</span><h2>Create a 4-digit PIN</h2><p>Your PIN stays on this device. It unlocks an existing secure session; it does not replace phone verification on a new device.</p><input className="pin-input" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••" inputMode="numeric" type="password"/><button className="primary full" disabled={pin.length!==4} onClick={savePin}>Continue <ArrowRight size={18}/></button></div>}
      {screen==='unlock' && <div className="flow-content"><span className="eyebrow">Welcome back</span><h2>Enter your PIN</h2><p>Fast login on this trusted device.</p><input className="pin-input" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••" inputMode="numeric" type="password"/><button className="primary full" disabled={pin.length!==4} onClick={trustedUnlock}>Unlock <ArrowRight size={18}/></button><button className="text-btn" onClick={()=>setScreen('phone')}>Use SMS instead</button></div>}
      {screen==='schools' && <div className="flow-content school-flow"><span className="eyebrow">Your story</span><h2>Which schools made you?</h2><p>Add your primary school, high school, or both.</p><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search school or area"/></div><div className="school-list">{filtered.map(s=><button key={s.id} className={`school-row ${selected.some(x=>x.id===s.id)?'selected':''}`} onClick={()=>toggleSchool(s)}><span className="school-badge">{s.name.split(' ').slice(0,2).map(x=>x[0]).join('')}</span><span><b>{s.name}</b><small>{schoolType(s.level)} · {s.town || s.province}</small></span><span className="check">{selected.some(x=>x.id===s.id)?<Check size={16}/>:<Plus size={16}/>}</span></button>)}</div><button className="primary full" onClick={()=>setScreen('amount')} disabled={!selected.length}>Continue <ArrowRight size={18}/></button></div>}
      {screen==='amount' && <div className="flow-content"><span className="eyebrow">Lifetime commitment</span><h2>Choose your monthly amount</h2><p>R10 is the starting point. Payment collection is only activated after a real payment provider is connected.</p>{selected.map(s=><div className="amount-card" key={s.id}><div><span className="school-badge small-badge">{s.name[0]}</span><b>{s.name}</b></div><input className="year-input" value={years[s.id]||''} onChange={e=>setYears(v=>({...v,[s.id]:e.target.value.replace(/\D/g,'').slice(0,4)}))} placeholder="Matric/leaving year (optional)"/><div className="amount-options">{[10,25,50,100].map(a=><button key={a} className={(amounts[s.id]||10)===a?'active':''} onClick={()=>setAmounts(v=>({...v,[s.id]:a}))}>R{a}</button>)}</div></div>)}<div className="total-card"><span>Total intended monthly commitment</span><strong>R{total}/month</strong></div><button className="primary full" disabled={busy} onClick={saveSchoolsAndCommitments}>{busy?'Saving…':'Save commitment'} <ArrowRight size={18}/></button><small className="secure"><ShieldCheck size={14}/> Saved as pending until a real payment mandate is approved.</small></div>}
      {screen==='success' && <div className="flow-content success"><span className="success-icon"><Check/></span><span className="eyebrow">Profile created</span><h2>Your schools are connected.</h2><p>Your monthly commitment is saved as <b>pending</b>. No money has been collected.</p><button className="primary full" onClick={()=>setScreen('dashboard')}>Go to dashboard <ArrowRight size={18}/></button></div>}
    </div></section>}

    {screen==='dashboard' && <Dashboard user={user} schools={schools} projects={projects} memberships={memberships} commitments={commitments} activeMonthly={activeMonthly} pendingMonthly={pendingMonthly} onJoin={()=>user?setScreen('schools'):setScreen('phone')} />}

    <footer><span>Skolo Saka</span><p>Built for transparent, long-term alumni support of South African schools.</p></footer>
  </main>
}

function Dashboard({user,schools,projects,memberships,commitments,activeMonthly,pendingMonthly,onJoin}:{user:User|null;schools:School[];projects:Project[];memberships:Membership[];commitments:Commitment[];activeMonthly:number;pendingMonthly:number;onJoin:()=>void}){
  const memberSchools = memberships.map(m=>(m as Membership & {schools?:School}).schools).filter(Boolean) as School[];
  const visibleSchools = memberSchools.length ? memberSchools : schools.slice(0,2);
  return <section className="dashboard-shell">
    <aside className="sidebar"><div className="brand side-brand"><span className="brand-mark"><GraduationCap size={20}/></span><span>Skolo Saka</span></div><nav><button className="active"><Home/>Home</button><button><GraduationCap/>My schools</button><button><WalletCards/>Contributions</button><button><Users/>Alumni</button><button><Bell/>Updates</button></nav><div className="side-profile"><span className="avatar">SS</span><div><b>{user?'Alumnus':'Public pilot'}</b><small>{user?.phone || 'Explore mode'}</small></div></div></aside>
    <div className="dash-main"><div className="dash-header"><div><span className="eyebrow">Skolo Saka dashboard</span><h2>{user?'Welcome back 👋🏾':'Public pilot dashboard'}</h2><p>{user?'Your school relationships and commitments are stored in the live database.':'Explore the live school and project data before joining.'}</p></div><button className="outline" onClick={onJoin}><Plus size={17}/> {user?'Add school':'Join'}</button></div>
      <div className="metric-grid"><div className="metric"><small>Active monthly collection</small><strong>{money(activeMonthly)}</strong><em>{activeMonthly? 'Provider-confirmed commitments':'No payment provider connected yet'}</em></div><div className="metric"><small>Pending monthly intent</small><strong>{money(pendingMonthly)}</strong><em>{commitments.filter(c=>c.status==='pending').length} pending commitment(s)</em></div><div className="metric"><small>Your schools</small><strong>{user?memberSchools.length:schools.length}</strong><em>{user?'Connected alumni relationships':'Pilot database'}</em></div></div>
      <div className="section-title"><div><h3>{user?'Your schools':'Pilot schools'}</h3><p>Primary and high schools are first-class entities.</p></div><button className="text-btn" onClick={onJoin}><Plus size={16}/> Add school</button></div>
      <div className="school-cards">{visibleSchools.map((s,i)=><article className={`big-school ${i%2?'dark':''}`} key={s.id}><div className="school-card-head"><span className="school-badge large">{s.name.split(' ').slice(0,2).map(x=>x[0]).join('')}</span><div><small>{schoolType(s.level)}</small><h3>{s.name}</h3><p>{s.town || s.province}, {s.province}</p></div></div><div className="school-stats"><span><b>{s.verified?'Verified':'Pending'}</b><small>school status</small></span><span><b>{projects.filter(p=>p.school_id===s.id).length}</b><small>visible projects</small></span><span><b>{money(commitments.find(c=>c.school_id===s.id)?.amount_cents || 0)}</b><small>your monthly intent</small></span></div></article>)}</div>
      <div className="section-title"><div><h3>Current priorities</h3><p>Targets are live; raised amounts remain zero until verified payments hit the ledger.</p></div></div>
      <div className="projects">{projects.slice(0,6).map(p=><article className="project" key={p.id}><div className="project-icon">{p.category==='Sport'?'⚽':'💻'}</div><div className="project-meta"><span>{p.category||'Project'}</span><small>{p.status}</small></div><h4>{p.title}</h4><p>{p.description}</p><div className="progress"><i style={{width:'0%'}}/></div><div className="funding"><b>R0 verified</b><span>Target {money(p.target_cents)}</span></div></article>)}</div>
      <div className="readiness-grid"><article><Smartphone/><h4>Phone identity</h4><p>Supabase phone OTP is wired. It activates once an SMS provider is configured.</p></article><article><ReceiptText/><h4>Money trail</h4><p>Commitments, payment attempts, ledger entries, expenditures and public evidence are separate auditable records.</p></article><article><Building2/><h4>School governance</h4><p>Membership roles support alumni and school administrators without sharing passwords or mutable balances.</p></article></div>
    </div>
  </section>
}
