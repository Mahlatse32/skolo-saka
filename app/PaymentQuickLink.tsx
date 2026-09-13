'use client';

import { useEffect, useState } from 'react';
import { WalletCards } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PaymentQuickLink(){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    let active=true;
    const path=window.location.pathname;
    if(path.startsWith('/payments')||path.startsWith('/payment/')) return;
    void supabase.auth.getSession().then(({data})=>{
      if(active) setVisible(Boolean(data.session));
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(active) setVisible(Boolean(session));
    });
    return()=>{active=false;subscription.unsubscribe();};
  },[]);
  if(!visible) return null;
  return <a href="/payments" aria-label="Manage payments" style={{position:'fixed',right:18,bottom:84,zIndex:60,display:'inline-flex',alignItems:'center',gap:8,padding:'11px 14px',borderRadius:999,background:'#163f2c',color:'#fff',textDecoration:'none',fontWeight:800,fontFamily:'system-ui',boxShadow:'0 10px 28px rgba(22,63,44,.24)',border:'1px solid rgba(255,255,255,.15)'}}><WalletCards size={17}/><span>Payments</span></a>;
}
