'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bell, Building2, Check, ChevronRight, CircleUserRound, GraduationCap, HeartHandshake,
  Home, MapPin, Minus, Plus, Search, Settings, ShieldCheck, Sparkles, Trophy,
  WalletCards, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Project, School } from '@/lib/types';

type View = 'home' | 'schools' | 'projects' | 'profile';
type SchoolLevelFilter = 'all' | 'primary' | 'high' | 'combined';
type DemoMembership = {
  schoolId: string;
  amount: number;
  year: string;
};

type DemoState = {
  onboarded: boolean;
  memberships: DemoMembership[];
};

const STORAGE_KEY = 'skolo_saka_demo_state_v2';
const DEFAULT_STATE: DemoState = { onboarded: false, memberships: [] };
const PROVINCES = ['All provinces','Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];

const money = (cents:number) => new Intl.NumberFormat('en-ZA', {
  style:'currency', currency:'ZAR', maximumFractionDigits:0
}).format(cents/100);

function levelLabel(level: School['level']) {
  if (level === 'primary') return 'Primary School';
  if (level === 'high') return 'High School';
  if (level === 'combined') return 'Combined School';
  return 'School';
}

function initials(name:string) {
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(word => word[0]).join('').toUpperCase();
}

async function fetchAllSchools(): Promise<School[]> {
  const pageSize = 1000;
  const rows: School[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('schools')
      .select('id,name,level,province,municipality,town,verified')
      .order('name')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as School[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function fetchAllProjects(): Promise<Project[]> {
  const pageSize = 1000;
  const rows: Project[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('projects')
      .select('id,school_id,title,description,category,target_cents,status,priority')
      .order('priority')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as Project[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

export default function Page() {
  const [view, setView] = useState<View>('home');
  const [schools, setSchools] = useState<School[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [state, setState] = useState<DemoState>(DEFAULT_STATE);
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('All provinces');
  const [level, setLevel] = useState<SchoolLevelFilter>('all');
  const [selectedSchool, setSelectedSchool] = useState<School|null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setState(JSON.parse(raw) as DemoState); } catch { /* ignore old demo state */ }
    }
    void (async () => {
      setLoading(true);
      try {
        const [schoolRows, projectRows] = await Promise.all([fetchAllSchools(), fetchAllProjects()]);
        setSchools(schoolRows);
        setProjects(projectRows);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not load the school directory.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const membershipsBySchool = useMemo(() => new Map(state.memberships.map(item => [item.schoolId, item])), [state.memberships]);
  const mySchools = useMemo(() => schools.filter(school => membershipsBySchool.has(school.id)), [schools, membershipsBySchool]);
  const mySchoolIds = useMemo(() => new Set(state.memberships.map(item => item.schoolId)), [state.memberships]);
  const myProjects = useMemo(() => projects.filter(project => mySchoolIds.has(project.school_id)), [projects, mySchoolIds]);
  const monthly = state.memberships.reduce((sum, item) => sum + item.amount, 0);

  const filteredSchools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schools.filter(school => {
      const matchesText = !q || `${school.name} ${school.town ?? ''} ${school.municipality ?? ''} ${school.province}`.toLowerCase().includes(q);
      const matchesProvince = province === 'All provinces' || school.province === province;
      const matchesLevel = level === 'all' || school.level === level;
      return matchesText && matchesProvince && matchesLevel;
    });
  }, [schools, query, province, level]);

  function addSchool(school:School) {
    setState(prev => {
      if (prev.memberships.some(item => item.schoolId === school.id)) return prev;
      return {
        ...prev,
        onboarded: true,
        memberships: [...prev.memberships, { schoolId: school.id, amount: 10, year: '' }]
      };
    });
  }

  function removeSchool(schoolId:string) {
    setState(prev => ({
      ...prev,
      memberships: prev.memberships.filter(item => item.schoolId !== schoolId)
    }));
    if (selectedSchool?.id === schoolId) setSelectedSchool(null);
  }

  function updateMembership(schoolId:string, patch:Partial<DemoMembership>) {
    setState(prev => ({
      ...prev,
      memberships: prev.memberships.map(item => item.schoolId === schoolId ? {...item, ...patch} : item)
    }));
  }

  function startFirstTime() {
    setState(prev => ({...prev, onboarded:true}));
    setView('schools');
  }

  function resetDemo() {
    setState(DEFAULT_STATE);
    setQuery('');
    setProvince('All provinces');
    setLevel('all');
    setSelectedSchool(null);
    setView('home');
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <button className="brand side-brand" onClick={() => setView('home')}>
          <span className="brand-mark"><GraduationCap size={20}/></span>
          <span>Skolo Saka</span>
        </button>
        <div className="pilot-pill"><Sparkles size={14}/> Logged-in pilot mode</div>
        <nav className="app-nav">
          <NavButton active={view==='home'} icon={<Home/>} label="Home" onClick={()=>setView('home')}/>
          <NavButton active={view==='schools'} icon={<Building2/>} label="Schools" badge={state.memberships.length || undefined} onClick={()=>setView('schools')}/>
          <NavButton active={view==='projects'} icon={<Trophy/>} label="Projects" badge={myProjects.length || undefined} onClick={()=>setView('projects')}/>
          <NavButton active={view==='profile'} icon={<CircleUserRound/>} label="Profile" onClick={()=>setView('profile')}/>
        </nav>
        <div className="side-summary">
          <small>Your monthly intention</small>
          <strong>R{monthly}</strong>
          <span>{state.memberships.length} {state.memberships.length===1?'school':'schools'}</span>
        </div>
      </aside>

      <section className="app-main">
        <header className="app-topbar">
          <button className="mobile-brand" onClick={()=>setView('home')}><GraduationCap size={20}/> Skolo Saka</button>
          <div className="topbar-spacer"/>
          <button className="round-btn" aria-label="Notifications"><Bell size={18}/></button>
          <div className="user-chip"><span className="avatar">M</span><span><b>Mahlatse</b><small>Pilot account</small></span></div>
        </header>

        {view==='home' && (
          <div className="page-content">
            {!state.onboarded || state.memberships.length===0 ? (
              <section className="first-time-card">
                <div>
                  <span className="eyebrow">Welcome to Skolo Saka</span>
                  <h1>Which schools made you?</h1>
                  <p>Start by finding your primary school, high school, or both. You can change, add or remove schools at any time.</p>
                  <button className="primary" onClick={startFirstTime}>Find my schools <ChevronRight size={18}/></button>
                </div>
                <div className="onboarding-steps">
                  <Step n="1" title="Find your schools" text="Search the national school directory by name, town, province or type."/>
                  <Step n="2" title="Set your link" text="Add your leaving or matric year and choose a monthly amount from R10."/>
                  <Step n="3" title="Follow the impact" text="See projects, updates and eventually every rand collected and spent."/>
                </div>
              </section>
            ) : (
              <>
                <section className="welcome-row">
                  <div><span className="eyebrow">Your Skolo Saka</span><h1>Good to see you.</h1><p>You’re connected to {state.memberships.length} {state.memberships.length===1?'school':'schools'}.</p></div>
                  <button className="outline" onClick={()=>setView('schools')}><Plus size={17}/> Add another school</button>
                </section>
                <section className="metric-grid">
                  <Metric label="My schools" value={String(state.memberships.length)} note="You can remove or add anytime"/>
                  <Metric label="Monthly intention" value={`R${monthly}`} note="No payment is taken in pilot mode"/>
                  <Metric label="Projects to follow" value={String(myProjects.length)} note="Across your selected schools"/>
                </section>
                <SectionHeader title="My schools" action="Manage schools" onClick={()=>setView('schools')}/>
                <div className="my-school-grid">
                  {mySchools.map((school, index) => {
                    const membership = membershipsBySchool.get(school.id)!;
                    return <MySchoolCard key={school.id} school={school} membership={membership} index={index} onRemove={()=>removeSchool(school.id)} onOpen={()=>setSelectedSchool(school)}/>;
                  })}
                </div>
                <SectionHeader title="Projects from my schools" action="See all projects" onClick={()=>setView('projects')}/>
                <ProjectGrid projects={myProjects.slice(0,3)} schools={schools}/>
              </>
            )}
          </div>
        )}

        {view==='schools' && (
          <div className="page-content">
            <section className="page-heading">
              <div><span className="eyebrow">School directory</span><h1>Find the schools that made you.</h1><p>Browse every school currently loaded in Skolo Saka. The directory is built to scale to the full DBE EMIS masterlist.</p></div>
              <div className="directory-count"><strong>{loading ? '…' : schools.length.toLocaleString()}</strong><span>schools available</span></div>
            </section>

            <div className="directory-toolbar">
              <label className="directory-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search school, town, municipality or province"/></label>
              <select value={province} onChange={e=>setProvince(e.target.value)}>{PROVINCES.map(item=><option key={item}>{item}</option>)}</select>
            </div>
            <div className="filter-pills">
              {(['all','primary','high','combined'] as SchoolLevelFilter[]).map(item => (
                <button key={item} className={level===item?'active':''} onClick={()=>setLevel(item)}>{item==='all'?'All schools':item==='primary'?'Primary':item==='high'?'High school':'Combined'}</button>
              ))}
            </div>

            {loadError && <div className="state-message error">{loadError}</div>}
            {loading ? <div className="state-message">Loading the school directory…</div> : (
              <div className="directory-layout">
                <div>
                  <div className="results-row"><b>{filteredSchools.length.toLocaleString()} results</b><span>{query ? `for “${query}”` : 'Use the filters to narrow the directory'}</span></div>
                  <div className="directory-list">
                    {filteredSchools.map(school => {
                      const membership = membershipsBySchool.get(school.id);
                      return (
                        <article className="directory-school" key={school.id}>
                          <button className="school-main" onClick={()=>setSelectedSchool(school)}>
                            <span className="school-badge">{initials(school.name)}</span>
                            <span className="school-copy"><b>{school.name}</b><small>{levelLabel(school.level)} · {school.town || school.municipality || school.province}</small><em><MapPin size={12}/>{school.province}{school.verified ? ' · Verified' : ''}</em></span>
                          </button>
                          {membership ? (
                            <button className="remove-btn" onClick={()=>removeSchool(school.id)}><Minus size={16}/> Remove</button>
                          ) : (
                            <button className="add-btn" onClick={()=>addSchool(school)}><Plus size={16}/> Add</button>
                          )}
                        </article>
                      );
                    })}
                    {!filteredSchools.length && <div className="empty-state"><Search size={28}/><h3>No schools found</h3><p>Try another school name, town or province.</p></div>}
                  </div>
                </div>

                <aside className="my-selection-panel">
                  <div className="panel-title"><div><span className="eyebrow">My schools</span><h3>{state.memberships.length} selected</h3></div><WalletCards size={20}/></div>
                  {!mySchools.length ? <p className="muted">Add a school from the directory. It will appear here immediately.</p> : mySchools.map(school => {
                    const membership = membershipsBySchool.get(school.id)!;
                    return <div className="selection-item" key={school.id}><div><b>{school.name}</b><small>{levelLabel(school.level)}</small></div><button aria-label={`Remove ${school.name}`} onClick={()=>removeSchool(school.id)}><X size={15}/></button><label>Year<input value={membership.year} onChange={e=>updateMembership(school.id,{year:e.target.value.replace(/\D/g,'').slice(0,4)})} placeholder="e.g. 2008"/></label><label>Monthly<select value={membership.amount} onChange={e=>updateMembership(school.id,{amount:Number(e.target.value)})}>{[10,25,50,100,250,500].map(a=><option value={a} key={a}>R{a}</option>)}</select></label></div>;
                  })}
                  <div className="selection-total"><span>Total intention</span><strong>R{monthly}/month</strong></div>
                  <button className="primary full" disabled={!mySchools.length} onClick={()=>setView('home')}><Check size={17}/> Save and view dashboard</button>
                  <small className="fine-print">Pilot mode only — no payment is collected.</small>
                </aside>
              </div>
            )}
          </div>
        )}

        {view==='projects' && (
          <div className="page-content">
            <section className="page-heading"><div><span className="eyebrow">Projects</span><h1>See what schools need.</h1><p>Projects from your schools appear first. You can still browse all active projects in the network.</p></div></section>
            {myProjects.length>0 && <><SectionHeader title="From my schools"/><ProjectGrid projects={myProjects} schools={schools}/></>}
            <SectionHeader title="All projects"/>
            <ProjectGrid projects={projects} schools={schools}/>
            {!projects.length && <div className="empty-state"><Trophy size={28}/><h3>No projects yet</h3><p>Projects submitted by schools will appear here.</p></div>}
          </div>
        )}

        {view==='profile' && (
          <div className="page-content profile-page">
            <section className="page-heading"><div><span className="eyebrow">Profile</span><h1>Your Skolo Saka settings.</h1><p>Authentication is intentionally bypassed while we perfect the product experience.</p></div></section>
            <div className="profile-grid">
              <article className="settings-card"><div className="settings-icon"><CircleUserRound/></div><h3>Pilot identity</h3><p>Mahlatse · Logged-in prototype account</p><span className="status-pill"><Check size={13}/> Active demo session</span></article>
              <article className="settings-card"><div className="settings-icon"><ShieldCheck/></div><h3>Authentication</h3><p>Phone OTP and PIN are parked for now. Navigation and school behaviour can be tested without them.</p></article>
              <article className="settings-card"><div className="settings-icon"><Settings/></div><h3>Reset first-time experience</h3><p>Clear selected schools and return to the first screen.</p><button className="danger-outline" onClick={resetDemo}>Reset pilot account</button></article>
            </div>
          </div>
        )}
      </section>

      <nav className="mobile-nav">
        <NavButton active={view==='home'} icon={<Home/>} label="Home" onClick={()=>setView('home')}/>
        <NavButton active={view==='schools'} icon={<Building2/>} label="Schools" onClick={()=>setView('schools')}/>
        <NavButton active={view==='projects'} icon={<Trophy/>} label="Projects" onClick={()=>setView('projects')}/>
        <NavButton active={view==='profile'} icon={<CircleUserRound/>} label="Profile" onClick={()=>setView('profile')}/>
      </nav>

      {selectedSchool && <SchoolDrawer school={selectedSchool} projects={projects.filter(p=>p.school_id===selectedSchool.id)} membership={membershipsBySchool.get(selectedSchool.id)} onClose={()=>setSelectedSchool(null)} onAdd={()=>addSchool(selectedSchool)} onRemove={()=>removeSchool(selectedSchool.id)} onUpdate={patch=>updateMembership(selectedSchool.id,patch)}/>} 
    </main>
  );
}

function NavButton({active,icon,label,badge,onClick}:{active:boolean;icon:ReactNode;label:string;badge?:number;onClick:()=>void}) {
  return <button className={active?'active':''} onClick={onClick}>{icon}<span>{label}</span>{badge ? <b className="nav-badge">{badge}</b> : null}</button>;
}

function Step({n,title,text}:{n:string;title:string;text:string}) {
  return <div className="step-card"><span>{n}</span><div><b>{title}</b><p>{text}</p></div></div>;
}

function Metric({label,value,note}:{label:string;value:string;note:string}) {
  return <article className="metric"><small>{label}</small><strong>{value}</strong><em>{note}</em></article>;
}

function SectionHeader({title,action,onClick}:{title:string;action?:string;onClick?:()=>void}) {
  return <div className="section-title"><h3>{title}</h3>{action && <button onClick={onClick}>{action} <ChevronRight size={15}/></button>}</div>;
}

function MySchoolCard({school,membership,index,onRemove,onOpen}:{school:School;membership:DemoMembership;index:number;onRemove:()=>void;onOpen:()=>void}) {
  return <article className={`my-school-card ${index===0?'featured':''}`}>
    <button className="school-card-open" onClick={onOpen}>
      <span className="school-badge large">{initials(school.name)}</span>
      <div><small>{levelLabel(school.level)}</small><h3>{school.name}</h3><p>{school.town || school.municipality || school.province}, {school.province}</p></div>
      <ChevronRight size={18}/>
    </button>
    <div className="school-mini-stats"><span><b>R{membership.amount}</b><small>monthly</small></span><span><b>{membership.year || '—'}</b><small>leaving year</small></span><span><b>Pending</b><small>payments</small></span></div>
    <button className="remove-school-link" onClick={onRemove}><Minus size={15}/> Remove school</button>
  </article>;
}

function ProjectGrid({projects,schools}:{projects:Project[];schools:School[]}) {
  const schoolMap = new Map(schools.map(s=>[s.id,s]));
  return <div className="projects-grid">{projects.map(project=>{
    const school = schoolMap.get(project.school_id);
    return <article className="project-card" key={project.id}><div className="project-top"><span className="project-icon">{project.category?.toLowerCase().includes('sport')?'⚽':project.category?.toLowerCase().includes('computer')?'💻':'🏫'}</span><span className="status-pill">{project.status}</span></div><small className="project-school">{school?.name || 'School project'}</small><h3>{project.title}</h3><p>{project.description || 'Project details will be published by the school.'}</p><div className="project-bottom"><b>Target {money(project.target_cents)}</b><span>Funding not live</span></div></article>;
  })}</div>;
}

function SchoolDrawer({school,projects,membership,onClose,onAdd,onRemove,onUpdate}:{school:School;projects:Project[];membership?:DemoMembership;onClose:()=>void;onAdd:()=>void;onRemove:()=>void;onUpdate:(patch:Partial<DemoMembership>)=>void}) {
  return <div className="drawer-backdrop" onClick={onClose}><aside className="school-drawer" onClick={e=>e.stopPropagation()}><button className="drawer-close" onClick={onClose}><X/></button><span className="school-badge drawer-badge">{initials(school.name)}</span><span className="eyebrow">{levelLabel(school.level)}</span><h2>{school.name}</h2><p className="drawer-location"><MapPin size={15}/>{school.town || school.municipality || school.province}, {school.province}</p>{school.verified && <span className="verified-chip"><ShieldCheck size={14}/> Verified school record</span>}<div className="drawer-section"><h4>Your relationship</h4>{membership ? <div className="drawer-controls"><label>Leaving / matric year<input value={membership.year} onChange={e=>onUpdate({year:e.target.value.replace(/\D/g,'').slice(0,4)})} placeholder="e.g. 2008"/></label><label>Monthly amount<select value={membership.amount} onChange={e=>onUpdate({amount:Number(e.target.value)})}>{[10,25,50,100,250,500].map(a=><option key={a} value={a}>R{a}</option>)}</select></label><button className="danger-outline full" onClick={onRemove}><Minus size={16}/> Remove from my schools</button></div> : <button className="primary full" onClick={onAdd}><Plus size={17}/> Add to my schools</button>}</div><div className="drawer-section"><h4>Projects</h4>{projects.length ? projects.map(project=><div className="drawer-project" key={project.id}><div><b>{project.title}</b><small>{project.status} · Target {money(project.target_cents)}</small></div><ChevronRight size={16}/></div>) : <p className="muted">No public projects from this school yet.</p>}</div><div className="drawer-note"><HeartHandshake size={18}/><span>This is the kind of school profile alumni will eventually use to follow projects, finances, updates and classmates.</span></div></aside></div>;
}
