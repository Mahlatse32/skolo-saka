import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase, verifyPaystackSignature } from '@/lib/paystack-server';

export const runtime='nodejs';

function planCode(data:any){return String(data?.plan?.plan_code||data?.plan?.planCode||data?.plan_code||'');}
function subscriptionCode(data:any){return String(data?.subscription_code||data?.subscription?.subscription_code||'');}

export async function POST(request:NextRequest){
  const rawBody=await request.text();
  if(!verifyPaystackSignature(rawBody,request.headers.get('x-paystack-signature'))) return NextResponse.json({error:'Invalid signature'},{status:401});
  try{
    const event=JSON.parse(rawBody); const data=event?.data||{}; const metadata=data?.metadata||{}; const db=adminSupabase();
    let commitmentId=String(metadata.commitment_id||'');
    let commitment:any=null;
    if(commitmentId){const result=await db.from('commitments').select('id,user_id,school_id,amount_cents,currency').eq('id',commitmentId).maybeSingle();if(result.error) throw result.error;commitment=result.data;}
    if(!commitment&&subscriptionCode(data)){const result=await db.from('commitments').select('id,user_id,school_id,amount_cents,currency').eq('payment_subscription_code',subscriptionCode(data)).maybeSingle();if(result.error) throw result.error;commitment=result.data;}
    if(!commitment&&planCode(data)){const result=await db.from('commitments').select('id,user_id,school_id,amount_cents,currency').eq('payment_plan_code',planCode(data)).maybeSingle();if(result.error) throw result.error;commitment=result.data;}
    if(!commitment) return NextResponse.json({received:true});

    if(event.event==='subscription.create'){
      const {error}=await db.from('commitments').update({payment_provider:'paystack',payment_subscription_code:subscriptionCode(data)||null,status:'active',started_at:new Date().toISOString(),cancelled_at:null,updated_at:new Date().toISOString()}).eq('id',commitment.id);
      if(error) throw error;
    }
    if(event.event==='charge.success'){
      const reference=String(data.reference||''); const amount=Number(data.amount||0); const currency=String(data.currency||'').toUpperCase();
      if(reference&&amount===Number(commitment.amount_cents)&&currency===String(commitment.currency).toUpperCase()){
        const {error:updateError}=await db.from('commitments').update({status:'active',payment_provider:'paystack',provider_reference:reference,payment_subscription_code:subscriptionCode(data)||undefined,started_at:new Date(data.paid_at||Date.now()).toISOString(),cancelled_at:null,updated_at:new Date().toISOString()}).eq('id',commitment.id);
        if(updateError) throw updateError;
        const {error:ledgerError}=await db.from('ledger_transactions').upsert({user_id:commitment.user_id,school_id:commitment.school_id,commitment_id:commitment.id,type:'contribution',amount_cents:amount,currency:data.currency||'ZAR',external_reference:reference,metadata:{provider:'paystack',event:'charge.success',transaction_id:data.id,channel:data.channel||null,subscription_code:subscriptionCode(data)||null},occurred_at:new Date(data.paid_at||Date.now()).toISOString()},{onConflict:'external_reference'});
        if(ledgerError) throw ledgerError;
      }
    }
    if(event.event==='subscription.disable'||event.event==='subscription.not_renew'){
      const {error}=await db.from('commitments').update({status:'cancelled',cancelled_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',commitment.id);
      if(error) throw error;
    }
    return NextResponse.json({received:true});
  }catch(error){
    console.error('Paystack webhook failed',error);
    return NextResponse.json({error:'Webhook processing failed'},{status:500});
  }
}
