'use client';

import { FormEvent, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RecoverAccount(){
  const [email,setEmail]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [sent,setSent]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/auth/recovery`});setBusy(false);if(error){setError(error.message);return;}setSent(true);}
  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><GraduationCap size={22}/></span><b>Skolo Saka</b></div><a className="auth-back" href="/">← Sign in</a><h1>Recover your account</h1>{sent?<><p>Check <b>{email}</b> for a secure recovery link. After opening it, you can choose a new PIN.</p><div className="message">For security, only a verified email attached to your Skolo Saka account can complete recovery.</div></>:<form onSubmit={submit}><p>Enter the verified recovery email on your account.</p><label>Email address</label><input type="email" autoFocus required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/>{error&&<div className="message error">{error}</div>}<button className="primary full" disabled={busy||!email.trim()}>{busy?'Sending…':'Send recovery link'}</button></form>}</section></main>;
}
