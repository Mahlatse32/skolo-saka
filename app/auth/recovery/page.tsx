'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { saveAccountPassword } from '@/lib/password-client';
import PasswordSetup from '@/app/components/PasswordSetup';

export default function RecoveryComplete(){
  const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[authorized,setAuthorized]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
  useEffect(()=>{
    let active=true;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(active&&event==='PASSWORD_RECOVERY'){setUser(session?.user??null);setAuthorized(Boolean(session?.user));setReady(true);}});
    async function initialize(){
      try{
        const code=new URLSearchParams(window.location.search).get('code');
        if(!code){if(active)setReady(true);return;}
        const {data,error:exchangeError}=await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState({},'','/auth/recovery');
        if(!active)return;
        if(exchangeError||!data.user){setError('This recovery link is invalid or has expired. Request a new link.');setReady(true);return;}
        setUser(data.user);setAuthorized(true);setReady(true);
      }catch{if(active){setError('Could not open this recovery link. Request a new one.');setReady(true);}}
    }
    void initialize();return()=>{active=false;subscription.unsubscribe();};
  },[]);
  async function save(password:string){
    if(busy)return;setBusy(true);setError('');
    try{setUser(await saveAccountPassword(password));setDone(true);}
    catch(e){setError(e instanceof Error?e.message:'Could not save your password.');}
    finally{setBusy(false);}
  }
  if(ready&&authorized&&user&&!done)return <PasswordSetup recovery busy={busy} error={error} onSave={save}/>;
  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><GraduationCap size={22}/></span><b>Skolo Saka</b></div>{!ready?<p>Opening recovery link…</p>:done?<><h1>Password changed</h1><p>Your new password is ready. Other sessions have been signed out.</p><a className="primary full" href="/">Continue to Skolo Saka</a></>:<><h1>Recovery link unavailable</h1><p>{error||'This link may have expired or already been used. Request a new recovery email.'}</p><a className="primary full" href="/auth/recover">Request another link</a><a className="auth-secondary" href="/?reset=phone">Reset with SMS instead</a></>}</section></main>;
}
