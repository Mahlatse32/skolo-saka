'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, ShieldCheck, Building2, ReceiptText, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import AnalyticsDashboard from './AnalyticsDashboard';

type AdminRole = {
  id: string;
  school_id: string;
  role: 'owner' | 'finance' | 'editor';
  status: 'pending' | 'active' | 'revoked';
  schools: { id:string; name:string; level:string; province:string; town:string|null } | null;
};

type Project = {id:string;school_id:string;title:string;status:string;target_cents:number};
type Expenditure = {id:string;school_id:string;supplier_name:string;description:string;amount_cents:number;status:string};
const money=(c:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(c/100);

export default function AdminPage(){
  const [loading,setLoading]=useState(true);
  const [roles,setRoles]=useState<AdminRole[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const [expenditures,setExpenditures]=useState<Expenditure[]>([]);
  const [message,setMessage]=useState('');
  const [platformAdmin,setPlatformAdmin]=useState(false);

  useEffect(()=>{void load()},[]);
  async function load(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setMessage('Sign in through the main Skolo Saka flow before opening the admin portal.');setLoading(false);return;}
    const [{data:r},{data:platform}]=await Promise.all([
      supabase.from('school_admins').select('*, schools(id,name,level,province,town)').eq('status','active'),
      supabase.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle(),
    ]);
    const adminRoles=(r??[]) as unknown as AdminRole[]; setRoles(adminRoles);
    setPlatformAdmin(Boolean(platform));
    if(!adminRoles.length&&!platform){setMessage('Your account does not currently have an active administration role.');setLoading(false);return;}
    const ids=adminRoles.map(x=>x.school_id);
    if(!ids.length){setLoading(false);return;}
    const [{data:p},{data:e}]=await Promise.all([
      supabase.from('projects').select('id,school_id,title,status,target_cents').in('school_id',ids),
      supabase.from('expenditures').select('id,school_id,supplier_name,description,amount_cents,status').in('school_id',ids),
    ]);
    setProjects((p??[]) as Project[]);setExpenditures((e??[]) as Expenditure[]);setLoading(false);
  }

  return <main style={{minHeight:'100vh',background:'#f5f8f6',padding:'32px 18px'}}>
    <div style={{maxWidth:980,margin:'0 auto'}}>
      <Link href="/" style={{display:'inline-flex',gap:7,alignItems:'center',color:'#146b50',textDecoration:'none',fontWeight:750}}><ArrowLeft size={17}/> Back to Skolo Saka</Link>
      <header style={{display:'flex',alignItems:'center',gap:12,margin:'30px 0'}}><span className="brand-mark"><GraduationCap size={20}/></span><div><span className="eyebrow">Governance</span><h1 style={{margin:'3px 0',fontSize:34}}>Administration and insights</h1></div></header>
      {loading&&<div className="metric">Loading administration access…</div>}
      {!loading&&platformAdmin&&<AnalyticsDashboard/>}
      {!loading&&message&&<div className="metric"><ShieldCheck/><h3>{message}</h3><p style={{color:'#66756e'}}>Administrative access is granted explicitly per school; donor accounts do not automatically receive it.</p></div>}
      {!!roles.length&&<>
        <div className="metric-grid">{roles.map(r=><article className="metric" key={r.id}><small>{r.role.toUpperCase()}</small><strong style={{fontSize:22}}>{r.schools?.name}</strong><em>{r.status} · {r.schools?.province}</em></article>)}</div>
        <div className="readiness-grid"><article><Building2/><h4>Projects</h4><p>{projects.length} project record(s) across your schools. Project changes are protected by school-admin RLS.</p></article><article><ReceiptText/><h4>Expenditure evidence</h4><p>{expenditures.length} approved/paid public expenditure record(s). Every spend can link to receipts, quotes and invoices.</p></article><article><ShieldCheck/><h4>Least privilege</h4><p>Owner, finance and editor roles are separate from donor access and platform administration.</p></article></div>
        <section style={{marginTop:28}}><h2>Project register</h2><div className="projects">{projects.map(p=><article className="project" key={p.id}><div className="project-meta"><span>Project</span><small>{p.status}</small></div><h4>{p.title}</h4><div className="funding"><b>Target</b><span>{money(p.target_cents)}</span></div></article>)}</div></section>
      </>}
    </div>
  </main>
}
