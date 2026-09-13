'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Row={id:string;school_id:string;amount_cents:number;status:string;payment_provider:string|null;schools:{name:string}|{name:string}[]|null};

export default function PaymentsPage(){
  const [rows,setRows]=useState<Row[]>([]); const [busy,setBusy]=useState<string|null>(null); const [message,setMessage]=useState('');
  useEffect(()=>{void load();},[]);
  async function load(){
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setMessage('Sign in to Skolo Saka first.');return;}
    const {data,error}=await supabase.from('commitments').select('id,school_id,amount_cents,status,payment_provider,schools(name)').eq('user_id',user.id).neq('status','cancelled');
    if(error){setMessage(error.message);return;} setRows((data||[]) as unknown as Row[]);
  }
  async function setup(id:string){
    setBusy(id);setMessage('');
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){setMessage('Your session expired. Sign in again.');setBusy(null);return;}
    const response=await fetch('/api/paystack/initialize',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({commitmentId:id})});
    const data=await response.json(); setBusy(null);
    if(!response.ok){setMessage(data.error||'Could not start Paystack.');return;}
    window.location.assign(data.authorizationUrl);
  }
  return <main style={{maxWidth:760,margin:'48px auto',padding:24,fontFamily:'system-ui'}}><a href="/">← Skolo Saka</a><h1>Monthly contributions</h1><p>Set up your secure recurring contribution. Payment details are handled by Paystack and are never stored by Skolo Saka.</p>{message&&<p><b>{message}</b></p>}<div style={{display:'grid',gap:12}}>{rows.map(row=>{const school=Array.isArray(row.schools)?row.schools[0]:row.schools;return <section key={row.id} style={{border:'1px solid #ddd',borderRadius:16,padding:20}}><h3 style={{marginTop:0}}>{school?.name||'Your school'}</h3><p><b>R{row.amount_cents/100}/month</b> · {row.status==='active'?'Active':'Not yet activated'}</p>{row.status==='active'?<span>✓ Recurring payment active</span>:<button onClick={()=>setup(row.id)} disabled={busy===row.id} style={{padding:'12px 18px',borderRadius:10,cursor:'pointer'}}>{busy===row.id?'Opening Paystack…':'Set up monthly payment'}</button>}</section>})}</div>{!rows.length&&!message&&<p>No school contributions yet. Add a school first.</p>}</main>;
}
