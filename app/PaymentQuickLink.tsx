'use client';

import { useEffect, useState } from 'react';
import { Landmark, Trophy, WalletCards } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PaymentQuickLink(){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    let active=true;
    const path=window.location.pathname;
    if(path.startsWith('/payments')||path.startsWith('/payment/')) return;
    void supabase.auth.getSession().then(({data})=>{if(active)setVisible(Boolean(data.session));});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(active)setVisible(Boolean(session));});
    return()=>{active=false;subscription.unsubscribe();};
  },[]);
  if(!visible) return null;
  const base:React.CSSProperties={display:'inline-flex',alignItems:'center',gap:7,padding:'10px 13px',borderRadius:999,background:'#163f2c',color:'#fff',textDecoration:'none',fontWeight:800,fontFamily:'system-ui',boxShadow:'0 10px 28px rgba(22,63,44,.2)',border:'1px solid rgba(255,255,255,.15)',fontSize:14};
  return <div style={{position:'fixed',right:18,bottom:84,zIndex:60,display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end',maxWidth:430}}>
    <a href="/projects" aria-label="View school projects" style={base}><Trophy size={16}/><span>Projects</span></a>
    <a href="/projects" aria-label="View school finances" style={base}><Landmark size={16}/><span>School money</span></a>
    <a href="/payments" aria-label="Manage payments" style={base}><WalletCards size={16}/><span>Payments</span></a>
  </div>;
}
