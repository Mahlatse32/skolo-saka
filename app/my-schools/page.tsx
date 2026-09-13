'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type School={id:string;name:string;level:string;province:string;town:string|null;municipality:string|null;verified:boolean};
type Membership={school_id:string;schools:School|School[]|null};

export default function MySchoolsTransparency(){
  const [schools,setSchools]=useState<School[]>([]); const [message,setMessage]=useState('Loading your schools…');
  useEffect(()=>{void load();},[]);
  async function load(){
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setMessage('Sign in to Skolo Saka first.');return;}
    const {data,error}=await supabase.from('school_memberships').select('school_id,schools(id,name,level,province,town,municipality,verified)').eq('user_id',user.id);
    if(error){setMessage(error.message);return;}
    const rows=(data||[]) as unknown as Membership[];
    setSchools(rows.map(r=>Array.isArray(r.schools)?r.schools[0]:r.schools).filter((x):x is School=>Boolean(x)));
    setMessage('');
  }
  return <main style={{maxWidth:920,margin:'0 auto',padding:'36px 22px 80px',fontFamily:'system-ui',color:'#10271c'}}>
    <a href="/" style={{fontWeight:800}}>← Skolo Saka</a>
    <header style={{margin:'24px 0'}}><span style={{fontWeight:900,textTransform:'uppercase',letterSpacing:'.08em',fontSize:12,color:'#397554'}}>My schools</span><h1 style={{fontSize:42,margin:'8px 0'}}>The schools that made you</h1><p style={{fontSize:18,color:'#64766d'}}>Each school has its own home. Open it to see contributions, balance, spending and projects. School badges, event media and community updates can live there as we add them.</p></header>
    {message&&<p>{message}</p>}
    <div style={{display:'grid',gap:14}}>{schools.map(s=><a key={s.id} href={`/school/${s.id}`} style={{border:'1px solid #d9e4dd',borderRadius:18,padding:22,background:'#fff',textDecoration:'none',color:'inherit',display:'flex',justifyContent:'space-between',gap:20,alignItems:'center'}}><div style={{display:'flex',alignItems:'center',gap:16}}><div style={{width:54,height:54,borderRadius:16,display:'grid',placeItems:'center',background:'#edf5f0',fontWeight:900,color:'#163f2c'}}>{s.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</div><div><h2 style={{margin:'0 0 6px'}}>{s.name}</h2><div style={{color:'#64766d'}}>{s.town||s.municipality||s.province} · {s.verified?'Verified school':'School'}</div></div></div><strong style={{color:'#163f2c'}}>Open school →</strong></a>)}</div>
    {!message&&!schools.length&&<p>Add a school first.</p>}
  </main>;
}
