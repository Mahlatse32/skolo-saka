'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SecondaryShell from '../SecondaryShell';

type School={id:string;name:string;level:string;province:string;town:string|null;municipality:string|null};
type Membership={school_id:string;schools:School|School[]|null};
type Project={id:string;school_id:string;title:string;description:string|null;category:string|null;target_cents:number;status:string;priority:number;updated_at:string;schools:School|School[]|null};
const money=(c:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(c/100);

export default function ProjectsPage(){
  const [memberships,setMemberships]=useState<Membership[]>([]); const [projects,setProjects]=useState<Project[]>([]); const [school,setSchool]=useState('all'); const [message,setMessage]=useState('Loading your school projects…');
  useEffect(()=>{void load();},[]);
  async function load(){
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setMessage('Sign in to Skolo Saka first.');return;}
    const {data:m,error:mErr}=await supabase.from('school_memberships').select('school_id,schools(id,name,level,province,town,municipality)').eq('user_id',user.id);
    if(mErr){setMessage(mErr.message);return;} const rows=(m||[]) as unknown as Membership[]; setMemberships(rows); const ids=rows.map(x=>x.school_id);
    if(!ids.length){setProjects([]);setMessage('Add a school first to see its projects.');return;}
    const {data:p,error:pErr}=await supabase.from('projects').select('id,school_id,title,description,category,target_cents,status,priority,updated_at,schools(id,name,level,province,town,municipality)').in('school_id',ids).order('priority',{ascending:false}).order('updated_at',{ascending:false});
    if(pErr){setMessage(pErr.message);return;} setProjects((p||[]) as unknown as Project[]);setMessage('');
  }
  const schools=useMemo(()=>memberships.map(m=>Array.isArray(m.schools)?m.schools[0]:m.schools).filter((x):x is School=>Boolean(x)),[memberships]);
  const filtered=school==='all'?projects:projects.filter(p=>p.school_id===school);
  return <SecondaryShell active="projects">
    <header><span className="secondary-eyebrow">Projects</span><h1 className="secondary-title">Projects from your schools.</h1><p className="secondary-lead">See what each school is working toward and open the school home for its complete contribution and spending record.</p></header>
    {schools.length>0&&<div className="project-filter"><button className={school==='all'?'active':''} onClick={()=>setSchool('all')}>All schools</button>{schools.map(s=><button className={school===s.id?'active':''} key={s.id} onClick={()=>setSchool(s.id)}>{s.name}</button>)}</div>}
    {message&&<div className="secondary-card" style={{marginTop:24}}>{message}</div>}
    <div className="secondary-list" style={{marginTop:24}}>{filtered.map(p=>{const s=Array.isArray(p.schools)?p.schools[0]:p.schools;return <article key={p.id} className="secondary-card"><div className="secondary-row"><div><div className="secondary-eyebrow">{s?.name||'School'}</div><h2 style={{margin:'7px 0'}}>{p.title}</h2><p className="secondary-muted">{p.description||'No project description yet.'}</p><div className="secondary-muted">{p.category||'School project'} · {p.status.replaceAll('_',' ')}</div></div><div style={{textAlign:'right',minWidth:140}}><span className="secondary-muted">Target</span><div style={{fontSize:24,fontWeight:900}}>{money(p.target_cents)}</div></div></div><a className="school-open" href={`/school/${p.school_id}`}>Open school →</a></article>})}</div>
    {!message&&!filtered.length&&<div className="secondary-card" style={{marginTop:24}}>No public projects for this school yet.</div>}
  </SecondaryShell>;
}
