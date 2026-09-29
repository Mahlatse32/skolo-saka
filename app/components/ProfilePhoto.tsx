'use client';
import {useEffect,useState,type ChangeEvent} from 'react';
import {Camera,UserRound} from 'lucide-react';
import {supabase} from '@/lib/supabase';
export default function ProfilePhoto(){
 const [url,setUrl]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function request(method='GET',body?:FormData){const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Sign in to change your photo.');const r=await fetch('/api/profile/photo',{method,headers:{Authorization:`Bearer ${session.access_token}`},body});const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not save your photo.');return data;}
 useEffect(()=>{let active=true;void request().then(d=>{if(active)setUrl(d.url);}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[]);
 async function upload(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value='';if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3*1024*1024){setMessage('Choose a JPG, PNG or WebP image up to 3 MB.');return;}setBusy(true);setMessage('');try{const form=new FormData();form.append('photo',file);const data=await request('POST',form);setUrl(data.url);setMessage('Photo saved. A school admin must approve it before it appears on your public player profile.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="profile-photo" aria-label="Profile picture"><div className="profile-photo-preview">{url?<img src={url} alt="Your profile picture"/>:<UserRound size={40} aria-hidden="true"/>}</div><div><h3>Profile picture</h3><label className="photo-upload"><Camera size={16}/>{busy?'Uploading…':'Choose photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={upload}/></label><p>JPG, PNG or WebP · up to 3 MB. Private until approved for your player profile.</p>{message&&<p role="status">{message}</p>}</div></section>;
}
