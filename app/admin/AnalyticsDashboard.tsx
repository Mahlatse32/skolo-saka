'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Eye, MousePointerClick, RefreshCw, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './analytics.module.css';

type Count = number | string;
type AnalyticsData = {
  days:number;
  generatedAt:string;
  totals:{registered_users:Count;new_users:Count;unique_visitors:Count;sessions:Count;page_views:Count;actions:Count;active_users:Count};
  daily:Array<{day:string;visitors:Count;page_views:Count;actions:Count}>;
  hours:Array<{hour:Count;sessions:Count;events:Count}>;
  topPages:Array<{page_path:string;views:Count;visitors:Count}>;
  topActions:Array<{event_name:string;total:Count;visitors:Count}>;
  funnel:Array<{position:Count;label:string;visitors:Count}>;
};

const number = (value:Count|undefined) => Number(value || 0);
const compact = new Intl.NumberFormat('en-ZA', { notation:'compact', maximumFractionDigits:1 });
const label = (value:string) => value.replaceAll('_',' ').replace(/\b\w/g, letter => letter.toUpperCase());

export default function AnalyticsDashboard(){
  const [days,setDays]=useState(30);
  const [data,setData]=useState<AnalyticsData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  async function load(){
    setLoading(true);setError('');
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw new Error('Sign in to view analytics.');
      const response=await fetch(`/api/admin/analytics?days=${days}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Could not load analytics.');
      setData(body as AnalyticsData);
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not load analytics.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[days]);

  const maxDaily=useMemo(()=>Math.max(1,...(data?.daily||[]).map(row=>number(row.visitors))),[data]);
  const maxHour=useMemo(()=>Math.max(1,...(data?.hours||[]).map(row=>number(row.sessions))),[data]);
  const peak=useMemo(()=>[...(data?.hours||[])].sort((a,b)=>number(b.sessions)-number(a.sessions))[0],[data]);
  const funnelBase=number(data?.funnel?.[0]?.visitors);

  return <section className={styles.dashboard}>
    <div className={styles.heading}><div><span className="eyebrow">Platform analytics</span><h2>How people use Skolo Saka</h2><p>Traffic and product actions shown in South African time. PINs, OTPs, card details, phone numbers and email addresses are never recorded here.</p></div><div className={styles.controls}><select aria-label="Analytics period" value={days} onChange={event=>setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select><button onClick={()=>void load()} disabled={loading} aria-label="Refresh analytics"><RefreshCw size={16}/>{loading?'Refreshing':'Refresh'}</button></div></div>
    {error&&<div className={styles.error}>{error}</div>}
    {!data&&loading?<div className={styles.loading}>Building your dashboard…</div>:data&&<>
      <div className={styles.metrics}>
        <Metric icon={<Users/>} title="Registered users" value={number(data.totals.registered_users)} note={`+${number(data.totals.new_users)} in this period`}/>
        <Metric icon={<Eye/>} title="Unique visitors" value={number(data.totals.unique_visitors)} note={`${number(data.totals.sessions)} sessions`}/>
        <Metric icon={<Activity/>} title="Active users" value={number(data.totals.active_users)} note="Signed-in visitors"/>
        <Metric icon={<MousePointerClick/>} title="Page views" value={number(data.totals.page_views)} note={`${number(data.totals.actions)} recorded actions`}/>
        <Metric icon={<Clock3/>} title="Busiest hour" value={peak?`${String(number(peak.hour)).padStart(2,'0')}:00`:'—'} note={peak?`${number(peak.sessions)} sessions`:'No activity yet'}/>
      </div>
      <div className={styles.grid}>
        <article className={`${styles.panel} ${styles.wide}`}><div className={styles.panelHead}><div><h3>Daily visitors</h3><p>Unique browsers per day</p></div><strong>{compact.format(number(data.totals.unique_visitors))}</strong></div><div className={styles.dailyChart}>{data.daily.map(row=><div className={styles.day} key={row.day} title={`${row.day}: ${number(row.visitors)} visitors, ${number(row.page_views)} views`}><span style={{height:`${Math.max(3,number(row.visitors)/maxDaily*100)}%`}}/><small>{new Date(`${row.day}T12:00:00`).toLocaleDateString('en-ZA',{day:'numeric',month:'short'})}</small></div>)}</div></article>
        <article className={styles.panel}><div className={styles.panelHead}><div><h3>Rush hours</h3><p>Sessions by hour</p></div></div><div className={styles.hourGrid}>{data.hours.map(row=><div key={String(row.hour)} title={`${String(number(row.hour)).padStart(2,'0')}:00 — ${number(row.sessions)} sessions`} style={{'--strength':Math.max(.06,number(row.sessions)/maxHour)} as React.CSSProperties}><span>{String(number(row.hour)).padStart(2,'0')}</span><b>{number(row.sessions)}</b></div>)}</div></article>
        <article className={styles.panel}><div className={styles.panelHead}><div><h3>Conversion journey</h3><p>Unique visitors reaching each stage</p></div></div><div className={styles.funnel}>{data.funnel.map(row=>{const value=number(row.visitors);const percent=funnelBase?Math.round(value/funnelBase*100):0;return <div key={row.label}><div><span>{row.label}</span><b>{value.toLocaleString('en-ZA')} · {percent}%</b></div><i><span style={{width:`${percent}%`}}/></i></div>})}</div></article>
        <article className={styles.panel}><div className={styles.panelHead}><div><h3>Top pages</h3><p>Most-viewed destinations</p></div></div><Ranked rows={data.topPages.map(row=>({name:row.page_path,value:number(row.views),note:`${number(row.visitors)} visitors`}))}/></article>
        <article className={styles.panel}><div className={styles.panelHead}><div><h3>Top actions</h3><p>What visitors do most</p></div></div><Ranked rows={data.topActions.map(row=>({name:label(row.event_name),value:number(row.total),note:`${number(row.visitors)} visitors`}))}/></article>
      </div>
      <p className={styles.updated}>Updated {new Date(data.generatedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</p>
    </>}
  </section>;
}

function Metric({icon,title,value,note}:{icon:React.ReactNode;title:string;value:number|string;note:string}){return <article className={styles.metric}><span>{icon}</span><small>{title}</small><strong>{typeof value==='number'?value.toLocaleString('en-ZA'):value}</strong><em>{note}</em></article>}
function Ranked({rows}:{rows:Array<{name:string;value:number;note:string}>}){return <div className={styles.ranked}>{rows.length?rows.map((row,index)=><div key={`${row.name}-${index}`}><span className={styles.rank}>{index+1}</span><div><b>{row.name}</b><small>{row.note}</small></div><strong>{row.value.toLocaleString('en-ZA')}</strong></div>):<p className={styles.empty}>No activity recorded yet.</p>}</div>}
