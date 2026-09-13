'use client';

import { useEffect, useState } from 'react';

export default function PaymentCompletePage(){
  const [message,setMessage]=useState('Confirming your contribution…');
  const [done,setDone]=useState(false);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const reference=params.get('reference')||params.get('trxref');
    if(!reference){setMessage('Payment return received. You can go back to Skolo Saka.');return;}
    fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`)
      .then(r=>r.json()).then(data=>{
        if(data.success){
          setDone(true);
          setMessage(data.kind==='one_off'?'Your contribution was received. Thank you!':'Your monthly contribution is active. Thank you!');
        }else setMessage(data.message||'Payment is still being confirmed.');
      })
      .catch(()=>setMessage('Payment is still being confirmed. Please return to Skolo Saka shortly.'));
  },[]);
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,fontFamily:'system-ui',background:'#f5f8f5',color:'#10231a'}}><section style={{maxWidth:620,width:'100%',background:'#fff',border:'1px solid #dfe9e2',borderRadius:24,padding:34,boxShadow:'0 10px 35px rgba(24,73,49,.08)'}}><div style={{fontWeight:900,color:'#1b5a3b'}}>Skolo Saka</div><div style={{fontSize:44,margin:'18px 0 8px'}}>{done?'✓':'…'}</div><h1 style={{fontSize:32,letterSpacing:'-.03em',margin:'0 0 10px'}}>{message}</h1><p style={{color:'#61736a',lineHeight:1.55}}>View your contribution and manage future monthly payments under Payments.</p><div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:22}}><a href="/payments" style={{display:'inline-block',padding:'12px 16px',borderRadius:11,background:'#163f2c',color:'#fff',fontWeight:800,textDecoration:'none'}}>View my payments</a><a href="/" style={{display:'inline-block',padding:'12px 16px',borderRadius:11,border:'1px solid #cfdad2',color:'#163f2c',fontWeight:800,textDecoration:'none'}}>Return home</a></div></section></main>;
}
