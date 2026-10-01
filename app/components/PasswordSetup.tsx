'use client';

import { useState, type FormEvent } from 'react';
import { GraduationCap } from 'lucide-react';
import { passwordError } from '@/lib/password-auth';

export default function PasswordSetup({busy,error,onSave,recovery=false}:{busy:boolean;error:string;onSave:(password:string)=>void;recovery?:boolean}){
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const validation=passwordError(password);
  function submit(event:FormEvent){event.preventDefault();if(!busy&&!validation&&password===confirm)onSave(password);}
  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span className="brand-mark"><GraduationCap size={22}/></span><b>Skolo Saka</b></div>
    <h1>{recovery?'Choose a new password':'Create your password'}</h1>
    <p>Use at least 12 characters. A few unrelated words make a memorable password.</p>
    <form onSubmit={submit}>
      <label htmlFor="new-password">Password</label><input id="new-password" className="password-input" type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required/>
      <label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" className="password-input" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/>
      {confirm&&password!==confirm&&<p role="alert" className="message error">Passwords do not match.</p>}
      {password&&validation&&<p className="message">{validation}</p>}
      {error&&<p role="alert" className="message error">{error}</p>}
      <button className="primary full" disabled={busy||Boolean(validation)||password!==confirm}>{busy?'Saving…':'Save password'}</button>
    </form>
    <a className="auth-secondary" href="/">Back to sign in</a>
  </section></main>;
}
