'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SecondaryShell from '../SecondaryShell';

type School={id:string;name:string;level:string;province:string;town:string|null;municipality:string|null;verified:boolean};
type Membership={school_id:string;schools:School|School[]|null};
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();

export default function MySchoolsTransparency(){
  const [schools,setSchools]=useState<School[]>([]); const [message,setMessage]=useState('Loading your schools…');
  useEffect(()=>{void load();},[]);
  async function load(){
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setMessage('Sign in to Skolo Saka first.');return;}
    const {data,error}=await supabase.from('school_memberships').select('school_id,schools(id,name,level,province,town,municipality,verified)').eq('user_id',user.id);
    if(error){setMessage(error.message);return;}
    const rows=(data||[]) as unknown as Membership[];
    setSchools(rows.map(r=>Array.isArray(r.schools)?r.schools[0]:r.schools).filter((x):x is School=>Boolean(x))); setMessage('');
  }
  return <SecondaryShell active="schools">
    <header><span className="secondary-eyebrow">My schools</span><h1 className="secondary-title">The schools that made you.</h1><p className="secondary-lead">Open a school to see its projects, contributions, available balance and public spending record.</p></header>
    {message&&<div className="secondary-card" style={{marginTop:24}}>{message}</div>}
    <div className="school-home-list" style={{marginTop:28}}>{schools.map(s=><a className="school-home-link" key={s.id} href={`/school/${s.id}`}><div className="school-home-copy"><div className="secondary-badge">{initials(s.name)}</div><div><h2>{s.name}</h2><div className="secondary-muted">{s.town||s.municipality||s.province} · {s.verified?'Verified school':'School'}</div></div></div><span className="school-open">Open school →</span></a>)}</div>
    {!message&&!schools.length&&<div className="secondary-card" style={{marginTop:24}}>You have not added a school yet.</div>}
  </SecondaryShell>;
}
