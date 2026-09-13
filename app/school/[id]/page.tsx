'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SecondaryShell from '../../SecondaryShell';

type MoneyRow={amount_cents:number;occurred_at:string;rank?:number};
type Spend={id:string;project_id:string|null;supplier_name:string|null;description:string;amount_cents:number;invoice_number:string|null;paid_at:string|null;status:string;created_at:string};
type Project={id:string;title:string;description:string|null;category:string|null;target_cents:number;status:string;raised_cents:number;spent_cents:number;updated_at:string};
type Data={school:{id:string;name:string;level:string;province:string;municipality:string|null;town:string|null;verified:boolean};totals:{contributions_cents:number;spending_cents:number;approved_spending_cents:number;balance_cents:number;contribution_count:number;project_count:number};top_contributions:MoneyRow[];latest_contributions:MoneyRow[];spending:Spend[];projects:Project[]};
const money=(c:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(c/100);
const date=(v:string|null)=>v?new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium'}).format(new Date(v)):'Pending';
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();

export default function SchoolPage({params}:{params:Promise<{id:string}>}){
  const [id,setId]=useState(''); const [data,setData]=useState<Data|null>(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
  useEffect(()=>{void params.then(p=>setId(p.id));},[params]);
  useEffect(()=>{if(!id)return;void supabase.rpc('get_school_transparency',{p_school_id:id}).then(({data,error})=>{if(error)setError(error.message);else setData(data as Data);setLoading(false);});},[id]);
  const allActivity=useMemo(()=>[...(data?.top_contributions||[]).map(x=>({...x,top:true})),...(data?.latest_contributions||[]).map(x=>({...x,top:false}))],[data]);
  if(loading)return <SecondaryShell active="schools"><div className="secondary-card">Loading school…</div></SecondaryShell>;
  if(error||!data?.school)return <SecondaryShell active="schools"><div className="secondary-card"><h1>School unavailable</h1><p>{error||'School not found.'}</p></div></SecondaryShell>;
  return <SecondaryShell active="schools">
    <header className="secondary-hero"><div className="secondary-badge">{initials(data.school.name)}</div><div><span className="secondary-eyebrow">School home</span><h1 className="secondary-title">{data.school.name}</h1><p className="secondary-lead">{data.school.town||data.school.municipality||data.school.province} · {data.school.verified?'Verified school':'School'}</p></div></header>
    <section className="secondary-metrics"><Metric label="Total contributed" value={money(data.totals.contributions_cents)} note={`${data.totals.contribution_count} successful contribution${data.totals.contribution_count===1?'':'s'}`}/><Metric label="Paid out" value={money(data.totals.spending_cents)} note="Verified paid expenditure"/><Metric label="Available balance" value={money(data.totals.balance_cents)} note="Contributions minus paid spending"/><Metric label="Projects" value={String(data.totals.project_count)} note="Current visible projects"/></section>
    <section className="secondary-card"><h2>Projects</h2><p className="secondary-muted">Projects and priorities published for this school.</p>{data.projects.length===0?<p>No active public projects yet.</p>:<div className="secondary-list">{data.projects.map(p=><article key={p.id} className="secondary-row"><div><b>{p.title}</b><div className="secondary-muted">{p.category||'School project'} · {p.status.replaceAll('_',' ')}</div></div><div style={{textAlign:'right'}}><b>{money(p.raised_cents)} raised</b><div className="secondary-muted">Target {money(p.target_cents)} · Spent {money(p.spent_cents)}</div></div></article>)}</div>}</section>
    <section className="secondary-card"><h2>Contribution activity</h2><p className="secondary-muted">Top contributions first, then the latest activity. Contributors stay anonymous by default.</p>{allActivity.length===0?<p>No successful contributions recorded yet.</p>:<div className="secondary-list">{allActivity.map((c,i)=><div key={`${c.occurred_at}-${i}`} className="secondary-row"><div><b>{'top' in c&&c.top?`Top ${c.rank} contribution`:'Contribution'}</b><div className="secondary-muted">{date(c.occurred_at)}</div></div><strong>{money(c.amount_cents)}</strong></div>)}</div>}</section>
    <section className="secondary-card"><h2>Money spent</h2><p className="secondary-muted">Approved and paid expenditure is public. The balance above only subtracts money actually paid.</p>{data.spending.length===0?<p>No approved expenditure recorded yet.</p>:<div className="secondary-list">{data.spending.map(s=><div key={s.id} className="secondary-row"><div><b>{s.description}</b><div className="secondary-muted">{s.supplier_name||'Supplier not listed'} · {s.status} · {date(s.paid_at||s.created_at)}{s.invoice_number?` · Invoice ${s.invoice_number}`:''}</div></div><strong>{money(s.amount_cents)}</strong></div>)}</div>}</section>
  </SecondaryShell>;
}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <article className="secondary-card secondary-metric"><small>{label}</small><strong>{value}</strong><small>{note}</small></article>}
