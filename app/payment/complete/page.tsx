'use client';

import { useEffect, useState } from 'react';

export default function PaymentCompletePage(){
  const [message,setMessage]=useState('Confirming your contribution…');
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const reference=params.get('reference')||params.get('trxref');
    if(!reference){setMessage('Payment return received. You can go back to Skolo Saka.');return;}
    fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`)
      .then(r=>r.json()).then(data=>setMessage(data.success?'Your monthly contribution is active. Thank you!':data.message||'Payment is still being confirmed.'))
      .catch(()=>setMessage('Payment is still being confirmed. Please return to Skolo Saka shortly.'));
  },[]);
  return <main style={{maxWidth:560,margin:'80px auto',padding:24,fontFamily:'system-ui'}}><h1>Skolo Saka</h1><h2>{message}</h2><p><a href="/">Return to Skolo Saka</a></p></main>;
}
