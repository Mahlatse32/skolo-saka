'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type MoneyRow={amount_cents:number;occurred_at:string;rank?:number};
type Spend={id:string;project_id:string|null;supplier_name:string|null;description:string;amount_cents:number;invoice_number:string|null;paid_at:string|null;status:string;created_at:string};
type Project={id:string;title:string;description:string|null;category:string|null;target_cents:number;status:string;raised_cents:number;spent_cents:number;updated_at:string};
type Data={school:{id:string;name:string;level:string;province:string;municipality:string|null;town:string|null;verified:boolean};totals:{contributions_cents:number;spending_cents:number;approved_spending_cents:number;balance_cents:number;contribution_count:number;project_count:number};top_contributions:MoneyRow[];latest_contributions:MoneyRow[];spending:Spend[];projects:Project[]};

const money=(c:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(c/100);
const date=(v:string|null)=>v?new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium'}).format(new Date(v)):'Pending';
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();

export default function SchoolTransparencyPage({params}:{params:Promise<{id:string}>}){
  const [id,setId]=useState(''); const [data,setData]=useState<Data|null>(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
  useEffect(()=>{void params.then(p=>setId(p.id));},[params]);
  useEffect(()=>{if(!id)return;void supabase.rpc('get_school_transparency',{p_school_id:id}).then(({data,error})=>{if(error)setError(error.message);else setData(data as Data);setLoading(false);});},[id]);
  const allActivity=useMemo(()=>[...(data?.top_contributions||[]).map(x=>({...x,top:true})),...(data?.latest_contributions||[]).map(x=>({...x,top:false}))],[data]);
  if(loading)return <main style={shell}><p>Loading school…</p></main>;
  if(error||!data?.school)return <main style={shell}><a href="/">← Skolo Saka</a><h1>School unavailable</h1><p>{error||'School not found.'}</p></main>;
  return <main style={shell}>
    <nav style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}><a href="/" style={{fontWeight:800}}>← Home</a><a href="/my-schools" style={{fontWeight:800}}>My schools</a><a href="/projects" style={{fontWeight:800}}>Projects</a><a href="/payments" style={{fontWeight:800}}>Payments</a></nav>
    <header style={{...hero,margin:'24px 0 28px'}}>
      <div style={badgePlaceholder} aria-label="School badge placeholder">{initials(data.school.name)}</div>
      <div><span style={eyebrow}>School home</span><h1 style={{fontSize:42,margin:'8px 0'}}>{data.school.name}</h1><p style={{fontSize:18,color:'#4b5f55',margin:'0 0 8px'}}>{data.school.town||data.school.municipality||data.school.province} · {data.school.verified?'Verified school':'School'}</p><p style={muted}>This is the school’s permanent home on Skolo Saka. Badges, event photos, media and school updates can be added here later without changing the financial record below.</p></div>
    </header>
    <section style={metrics}>
      <Metric label="Total contributed" value={money(data.totals.contributions_cents)} note={`${data.totals.contribution_count} successful contributions`}/>
      <Metric label="Paid out" value={money(data.totals.spending_cents)} note="Verified paid expenditure"/>
      <Metric label="Available balance" value={money(data.totals.balance_cents)} note="Contributions minus paid spending"/>
      <Metric label="Projects" value={String(data.totals.project_count)} note="Current visible projects"/>
    </section>
    <section style={card}><h2>Projects</h2><p style={muted}>Every currently visible project for this school.</p>{data.projects.length===0?<p>No active public projects yet.</p>:<div style={{display:'grid',gap:12}}>{data.projects.map(p=><article key={p.id} style={row}><div><b>{p.title}</b><div style={muted}>{p.category||'School project'} · {p.status.replaceAll('_',' ')}</div></div><div style={{textAlign:'right'}}><b>{money(p.raised_cents)} raised</b><div style={muted}>Target {money(p.target_cents)} · Spent {money(p.spent_cents)}</div></div></article>)}</div>}</section>
    <section style={card}><h2>Contribution activity</h2><p style={muted}>Top 5 contributions are shown first. Everyone else follows by latest contribution. Contributors remain anonymous by default.</p>{allActivity.length===0?<p>No successful contributions recorded yet.</p>:<div>{allActivity.map((c,i)=><div key={`${c.occurred_at}-${i}`} style={row}><div><b>{'top' in c&&c.top?`Top ${c.rank} contribution`:'Contribution'}</b><div style={muted}>{date(c.occurred_at)}</div></div><strong>{money(c.amount_cents)}</strong></div>)}</div>}</section>
    <section style={card}><h2>Money spent</h2><p style={muted}>Approved and paid expenditure is public. Paid totals above only include money actually paid.</p>{data.spending.length===0?<p>No approved expenditure recorded yet.</p>:<div>{data.spending.map(s=><div key={s.id} style={row}><div><b>{s.description}</b><div style={muted}>{s.supplier_name||'Supplier not listed'} · {s.status} · {date(s.paid_at||s.created_at)}{s.invoice_number?` · Invoice ${s.invoice_number}`:''}</div></div><strong>{money(s.amount_cents)}</strong></div>)}</div>}</section>
  </main>;
}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <article style={{...card,margin:0}}><small style={muted}>{label}</small><div style={{fontSize:30,fontWeight:900,margin:'8px 0'}}>{value}</div><small style={muted}>{note}</small></article>}
const shell:React.CSSProperties={maxWidth:1080,margin:'0 auto',padding:'36px 22px 80px',fontFamily:'system-ui',color:'#10271c'};
const hero:React.CSSProperties={display:'flex',gap:22,alignItems:'center'};
const badgePlaceholder:React.CSSProperties={width:92,height:92,borderRadius:24,display:'grid',placeItems:'center',background:'#e8f2ec',border:'1px solid #d6e5dc',fontSize:30,fontWeight:900,color:'#163f2c',flex:'0 0 auto'};
const metrics:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14,marginBottom:18};
const card:React.CSSProperties={border:'1px solid #d9e4dd',borderRadius:18,padding:22,background:'#fff',margin:'18px 0',boxShadow:'0 8px 28px rgba(16,39,28,.04)'};
const row:React.CSSProperties={display:'flex',justifyContent:'space-between',gap:18,alignItems:'center',padding:'14px 0',borderBottom:'1px solid #edf2ef'};
const muted:React.CSSProperties={color:'#64766d',fontSize:14}; const eyebrow:React.CSSProperties={fontWeight:900,textTransform:'uppercase',letterSpacing:'.08em',fontSize:12,color:'#397554'};
