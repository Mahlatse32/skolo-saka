'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

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
    if(mErr){setMessage(mErr.message);return;}
    const rows=(m||[]) as unknown as Membership[]; setMemberships(rows); const ids=rows.map(x=>x.school_id);
    if(!ids.length){setProjects([]);setMessage('Add a school first to see its projects.');return;}
    const {data:p,error:pErr}=await supabase.from('projects').select('id,school_id,title,description,category,target_cents,status,priority,updated_at,schools(id,name,level,province,town,municipality)').in('school_id',ids).order('priority',{ascending:false}).order('updated_at',{ascending:false});
    if(pErr){setMessage(pErr.message);return;} setProjects((p||[]) as unknown as Project[]);setMessage('');
  }
  const schools=useMemo(()=>memberships.map(m=>Array.isArray(m.schools)?m.schools[0]:m.schools).filter((x):x is School=>Boolean(x)),[memberships]);
  const filtered=school==='all'?projects:projects.filter(p=>p.school_id===school);
  return <main style={{maxWidth:1040,margin:'0 auto',padding:'36px 22px 80px',fontFamily:'system-ui',color:'#10271c'}}>
    <a href="/" style={{fontWeight:800}}>← Skolo Saka</a>
    <header style={{margin:'24px 0'}}><span style={{fontWeight:900,textTransform:'uppercase',letterSpacing:'.08em',fontSize:12,color:'#397554'}}>Projects</span><h1 style={{fontSize:42,margin:'8px 0'}}>Projects from your schools</h1><p style={{fontSize:18,color:'#64766d'}}>Only projects belonging to schools connected to your account are shown here.</p></header>
    {schools.length>0&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:22}}><button onClick={()=>setSchool('all')} style={pill(school==='all')}>All schools</button>{schools.map(s=><button key={s.id} onClick={()=>setSchool(s.id)} style={pill(school===s.id)}>{s.name}</button>)}</div>}
    {message&&<p>{message}</p>}
    <div style={{display:'grid',gap:14}}>{filtered.map(p=>{const s=Array.isArray(p.schools)?p.schools[0]:p.schools;return <article key={p.id} style={{border:'1px solid #d9e4dd',borderRadius:18,padding:22,background:'#fff'}}><div style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'flex-start'}}><div><div style={{fontSize:13,fontWeight:800,color:'#397554'}}>{s?.name||'School'}</div><h2 style={{margin:'6px 0 8px'}}>{p.title}</h2><p style={{color:'#64766d',maxWidth:700}}>{p.description||'No project description yet.'}</p><div style={{fontSize:14,color:'#64766d'}}>{p.category||'School project'} · {p.status.replaceAll('_',' ')}</div></div><div style={{textAlign:'right',minWidth:160}}><b>Target</b><div style={{fontSize:24,fontWeight:900}}>{money(p.target_cents)}</div></div></div><div style={{marginTop:16}}><a href={`/school/${p.school_id}`} style={{fontWeight:900,color:'#163f2c'}}>View school money & transparency →</a></div></article>})}</div>
    {!message&&!filtered.length&&<p>No public projects for this school yet.</p>}
  </main>;
}
function pill(active:boolean):React.CSSProperties{return {border:active?'1px solid #163f2c':'1px solid #d9e4dd',background:active?'#163f2c':'#fff',color:active?'#fff':'#163f2c',borderRadius:999,padding:'10px 14px',fontWeight:800,cursor:'pointer'}}
