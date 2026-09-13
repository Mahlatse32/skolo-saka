'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function normalizeSaPhone(value:string){const digits=value.replace(/\D/g,'');if(digits.startsWith('27'))return `+${digits}`;if(digits.startsWith('0'))return `+27${digits.slice(1)}`;return `+27${digits}`;}
async function pinPassword(phone:string,pin:string){const source=new TextEncoder().encode(`skolo-saka-auth-v1:${normalizeSaPhone(phone)}:${pin}:south-africa`);const digest=await crypto.subtle.digest('SHA-256',source);const hex=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');return `Ss!${hex}`;}

export default function RecoveryComplete(){
  const [user,setUser]=useState<User|null>(null);const [ready,setReady]=useState(false);const [pin,setPin]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);
  useEffect(()=>{void supabase.auth.getSession().then(({data})=>{setUser(data.session?.user??null);setReady(true);});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user??null);setReady(true);});return()=>subscription.unsubscribe();},[]);
  async function save(){if(pin.length!==4||pin!==confirm)return; if(!user?.phone){setError('This account has no phone number attached. Contact support before changing the PIN.');return;}setBusy(true);setError('');const password=await pinPassword(user.phone,pin);const {error}=await supabase.auth.updateUser({password});setBusy(false);if(error){setError(error.message);return;}setDone(true);setPin('');setConfirm('');}
  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><GraduationCap size={22}/></span><b>Skolo Saka</b></div>{!ready?<p>Opening recovery link…</p>:done?<><h1>PIN changed</h1><p>Your new PIN is ready. You are securely signed in.</p><a className="primary full" href="/">Continue to Skolo Saka</a></>:!user?<><h1>Recovery link unavailable</h1><p>This link may have expired or already been used. Request a new recovery email.</p><a className="primary full" href="/auth/recover">Request another link</a></>:<><h1>Create a new PIN</h1><p>Your recovery email has been accepted. Choose the 4-digit PIN you want to use with your phone number.</p><label>New 4-digit PIN</label><input className="pin-input" type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••"/><label>Confirm PIN</label><input className="pin-input" type="password" inputMode="numeric" value={confirm} onChange={e=>setConfirm(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••"/>{confirm&&pin!==confirm&&<div className="message error">PINs do not match.</div>}{error&&<div className="message error">{error}</div>}<button className="primary full" disabled={busy||pin.length!==4||confirm.length!==4||pin!==confirm} onClick={save}>{busy?'Saving…':'Save new PIN'}</button></>}</section></main>;
}
