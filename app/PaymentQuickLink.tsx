'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Landmark, WalletCards } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type SchoolRef={id:string;name:string};
type MembershipRow={schools:SchoolRef|SchoolRef[]|null};

export default function PaymentQuickLink(){
  const [visible,setVisible]=useState(false);
  const [sideTarget,setSideTarget]=useState<Element|null>(null);
  const [mobileTarget,setMobileTarget]=useState<Element|null>(null);
  const [schoolMap,setSchoolMap]=useState<Map<string,string>>(new Map());

  useEffect(()=>{
    let active=true;
    async function syncSession(){
      const {data}=await supabase.auth.getSession();
      if(!active)return;
      const signedIn=Boolean(data.session);
      setVisible(signedIn);
      if(signedIn){
        const user=data.session?.user;
        if(user){
          const {data:rows}=await supabase.from('school_memberships').select('schools(id,name)').eq('user_id',user.id);
          const next=new Map<string,string>();
          ((rows||[]) as unknown as MembershipRow[]).forEach(row=>{
            const school=Array.isArray(row.schools)?row.schools[0]:row.schools;
            if(school)next.set(school.name.trim().toLowerCase(),school.id);
          });
          if(active)setSchoolMap(next);
        }
      }
    }
    void syncSession();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!active)return;
      setVisible(Boolean(session));
      if(session)void syncSession();
    });
    return()=>{active=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    if(!visible)return;
    const findTargets=()=>{
      setSideTarget(document.querySelector('.app-sidebar .app-nav'));
      setMobileTarget(document.querySelector('.mobile-nav'));
    };
    findTargets();
    const observer=new MutationObserver(findTargets);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[visible]);

  useEffect(()=>{
    if(!visible||window.location.pathname!=='/')return;
    const openSchool=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      const button=target?.closest('.my-school-card .school-card-open');
      if(!button)return;
      const name=button.querySelector('h3')?.textContent?.trim().toLowerCase();
      if(!name)return;
      const id=schoolMap.get(name);
      if(!id)return;
      event.preventDefault();
      event.stopPropagation();
      window.location.href=`/school/${id}`;
    };
    document.addEventListener('click',openSchool,true);
    return()=>document.removeEventListener('click',openSchool,true);
  },[visible,schoolMap]);

  const desktopItems=useMemo(()=><>
    <button onClick={()=>{window.location.href='/my-schools';}}><Landmark/><span>My schools</span></button>
    <button onClick={()=>{window.location.href='/payments';}}><WalletCards/><span>Payments</span></button>
  </>,[]);
  const mobileItems=useMemo(()=><>
    <button onClick={()=>{window.location.href='/my-schools';}}><Landmark/><span>Schools</span></button>
    <button onClick={()=>{window.location.href='/payments';}}><WalletCards/><span>Payments</span></button>
  </>,[]);

  if(!visible)return null;
  return <>
    {sideTarget?createPortal(desktopItems,sideTarget):null}
    {mobileTarget?createPortal(mobileItems,mobileTarget):null}
  </>;
}
