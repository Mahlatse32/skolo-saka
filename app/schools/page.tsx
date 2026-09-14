'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, MapPin, Plus, Search, ShieldCheck, X } from 'lucide-react';
import SecondaryShell from '../SecondaryShell';
import { supabase } from '@/lib/supabase';
import styles from './schools.module.css';
import mergedStyles from './merged-schools.module.css';

type Level = 'all' | 'primary' | 'high' | 'combined';
type School = { id:string; name:string; level:string; province:string; municipality:string|null; town:string|null; verified:boolean };
type Membership = { school_id:string; graduation_year:number|null; grade_left:number|null; schools:School|School[]|null };

const PAGE_SIZE = 30;
const PROVINCES = ['All provinces','Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];
const GRADES = Array.from({length:12},(_,i)=>i+1);

function clean(value:string){ return value.trim().replace(/[,%()_*]/g,' ').replace(/\s+/g,' '); }
function initials(name:string){ return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
function levelLabel(level:string){ return level==='primary'?'Primary school':level==='high'?'High school':level==='combined'?'Combined school':'School'; }

export default function SchoolsPage(){
  const [query,setQuery]=useState('');
  const [debouncedQuery,setDebouncedQuery]=useState('');
  const [area,setArea]=useState('');
  const [debouncedArea,setDebouncedArea]=useState('');
  const [province,setProvince]=useState('All provinces');
  const [level,setLevel]=useState<Level>('all');
  const [verifiedOnly,setVerifiedOnly]=useState(false);
  const [page,setPage]=useState(0);
  const [rows,setRows]=useState<School[]>([]);
  const [count,setCount]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [memberships,setMemberships]=useState<Membership[]>([]);
  const [picker,setPicker]=useState<School|null>(null);
  const [year,setYear]=useState('');
  const [grade,setGrade]=useState('');
  const [saving,setSaving]=useState(false);
  const requestSeq=useRef(0);

  useEffect(()=>{ const t=setTimeout(()=>{setPage(0);setDebouncedQuery(clean(query));},300); return()=>clearTimeout(t); },[query]);
  useEffect(()=>{ const t=setTimeout(()=>{setPage(0);setDebouncedArea(clean(area));},300); return()=>clearTimeout(t); },[area]);
  useEffect(()=>{ setPage(0); },[province,level,verifiedOnly]);

  useEffect(()=>{ void loadMemberships(); },[]);
  useEffect(()=>{ void loadSchools(); },[debouncedQuery,debouncedArea,province,level,verifiedOnly,page]);

  async function loadMemberships(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {data}=await supabase.from('school_memberships').select('school_id,graduation_year,grade_left,schools(id,name,level,province,municipality,town,verified)').eq('user_id',user.id);
    setMemberships((data||[]) as unknown as Membership[]);
  }

  async function loadSchools(){
    const seq=++requestSeq.current;
    setLoading(true); setError('');
    try{
      const {data,error}=await supabase.rpc('search_school_directory', {
        p_query: debouncedQuery,
        p_area: debouncedArea,
        p_province: province === 'All provinces' ? null : province,
        p_level: level === 'all' ? null : level,
        p_verified_only: verifiedOnly,
        p_page: page,
      });
      if(error)throw error;
      if(seq!==requestSeq.current)return;
      setRows((data?.items || []) as School[]); setCount(Number(data?.total || 0));
    }catch(e){ if(seq===requestSeq.current)setError(e instanceof Error?e.message:'Could not search schools.'); }
    finally{ if(seq===requestSeq.current)setLoading(false); }
  }

  const memberIds=useMemo(()=>new Set(memberships.map(m=>m.school_id)),[memberships]);
  const mySchools=useMemo(()=>memberships.map(m=>{
    const school=Array.isArray(m.schools)?m.schools[0]:m.schools;
    return school?{...m,school}:null;
  }).filter((item):item is Membership & {school:School}=>Boolean(item)),[memberships]);
  const totalPages=Math.max(1,Math.ceil(count/PAGE_SIZE));
  const from=count? page*PAGE_SIZE+1:0;
  const to=Math.min((page+1)*PAGE_SIZE,count);
  const hasFilters=Boolean(query||area||province!=='All provinces'||level!=='all'||verifiedOnly);

  function clearFilters(){ setQuery('');setArea('');setProvince('All provinces');setLevel('all');setVerifiedOnly(false);setPage(0); }

  async function addSchool(){
    if(!picker)return;
    setSaving(true);setError('');
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setError('Sign in first.');setSaving(false);return;}
    const {error}=await supabase.from('school_memberships').upsert({user_id:user.id,school_id:picker.id,role:'alumnus',graduation_year:year?Number(year):null,grade_left:grade?Number(grade):null,verified:false},{onConflict:'user_id,school_id,role'});
    if(error){setError(error.message);setSaving(false);return;}
    await loadMemberships();
    setPicker(null);setYear('');setGrade('');setSaving(false);
  }

  return <SecondaryShell active="schools">
    <section className={styles.heading}>
      <div><span className={styles.eyebrow}>Schools</span><h1>The schools that made you.</h1><p>Open one of your schools or search the national directory to add another.</p></div>
    </section>

    <section className={mergedStyles.mine} aria-labelledby="my-schools-heading">
      <div className={mergedStyles.sectionHeading}><div><span className={styles.eyebrow}>My schools</span><h2 id="my-schools-heading">Your schools ({mySchools.length})</h2></div></div>
      {mySchools.length?<div className={mergedStyles.mineGrid}>{mySchools.map(({school,graduation_year,grade_left})=><a className={mergedStyles.mineCard} key={school.id} href={`/school/${school.id}`}><div className={styles.badge}>{initials(school.name)}</div><div><h3>{school.name}</h3><p>{school.town||school.municipality||school.province}</p><small>{graduation_year||'Year not set'} · {grade_left?`Grade ${grade_left}`:'Grade not set'}{school.verified?' · Verified':''}</small></div><ChevronRight size={18}/></a>)}</div>:<div className={mergedStyles.emptyMine}>You have not added a school yet. Find it in the directory below.</div>}
    </section>

    <div className={mergedStyles.directoryHeading}><span className={styles.eyebrow}>School directory</span><h2>Find another school</h2><p>Search by school name, town or municipality, then narrow it by province, school type and verification.</p></div>

    <section className={styles.filters}>
      <label className={styles.search}><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="School name, town or municipality"/><span>{query&&<button onClick={()=>setQuery('')} aria-label="Clear search"><X size={15}/></button>}</span></label>
      <select value={province} onChange={e=>setProvince(e.target.value)} aria-label="Province">{PROVINCES.map(p=><option key={p}>{p}</option>)}</select>
      <label className={styles.area}><MapPin size={17}/><input value={area} onChange={e=>setArea(e.target.value)} placeholder="Town / municipality"/></label>
      <label className={styles.verified}><input type="checkbox" checked={verifiedOnly} onChange={e=>setVerifiedOnly(e.target.checked)}/><ShieldCheck size={16}/> Verified only</label>
    </section>

    <div className={styles.levels}>{(['all','primary','high','combined'] as Level[]).map(v=><button key={v} className={level===v?styles.active:''} onClick={()=>setLevel(v)}>{v==='all'?'All schools':v==='primary'?'Primary':v==='high'?'High school':'Combined'}</button>)}{hasFilters&&<button className={styles.clear} onClick={clearFilters}>Clear all</button>}</div>

    <div className={styles.resultMeta}><div><b>{loading?'Searching…':`${count.toLocaleString()} ${count===1?'result':'results'}`}</b>{!loading&&count>0&&<span>Showing {from.toLocaleString()}–{to.toLocaleString()}</span>}</div><span>School-name matches appear first, followed by location matches. Multiple search words are all required.</span></div>

    {error&&<div className={styles.error}>{error}</div>}
    {loading?<div className={styles.loading}>Searching the national school directory…</div>:rows.length===0?<div className={styles.empty}><h3>No schools matched</h3><p>Try fewer words, remove a location filter or clear the province.</p>{hasFilters&&<button onClick={clearFilters}>Clear filters</button>}</div>:<div className={styles.list}>{rows.map(s=><article className={styles.school} key={s.id}><div className={styles.badge}>{initials(s.name)}</div><div className={styles.copy}><h3>{s.name}</h3><div>{levelLabel(s.level)} · {s.town||s.municipality||'Location not listed'}</div><small><MapPin size={12}/>{s.province}{s.municipality?` · ${s.municipality}`:''}{s.verified?' · Verified':''}</small></div>{memberIds.has(s.id)?<a className={styles.open} href={`/school/${s.id}`}><Check size={16}/> Open school</a>:<button className={styles.add} onClick={()=>{setPicker(s);setYear('');setGrade('');}}><Plus size={16}/> Add</button>}</article>)}</div>}

    {count>PAGE_SIZE&&<div className={styles.pagination}><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ChevronLeft size={16}/> Previous</button><span>Page {page+1} of {totalPages}</span><button disabled={page+1>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))}>Next <ChevronRight size={16}/></button></div>}

    {picker&&<div className={styles.backdrop} onClick={()=>setPicker(null)}><section className={styles.modal} onClick={e=>e.stopPropagation()}><button className={styles.close} onClick={()=>setPicker(null)}><X/></button><div className={styles.badgeLarge}>{initials(picker.name)}</div><span className={styles.eyebrow}>{levelLabel(picker.level)}</span><h2>{picker.name}</h2><p>{picker.town||picker.municipality||picker.province}, {picker.province}</p><div className={styles.form}><label>Year you left<input value={year} inputMode="numeric" onChange={e=>setYear(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="e.g. 2012"/></label><label>Grade when you left<select value={grade} onChange={e=>setGrade(e.target.value)}><option value="">Select grade</option>{GRADES.map(g=><option key={g} value={g}>Grade {g}</option>)}</select></label><button onClick={addSchool} disabled={saving}>{saving?'Adding school…':'Add to my schools'}</button></div><small className={styles.note}>Payment setup is separate. Adding a school here does not create a debit or subscription.</small></section></div>}
  </SecondaryShell>;
}
