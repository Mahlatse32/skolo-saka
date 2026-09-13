import { NextRequest, NextResponse } from 'next/server';
import { paystackRequest, serverSupabase } from '@/lib/paystack-server';

type InitializeResponse = { status:boolean; data:{ authorization_url:string; access_code:string; reference:string } };
type PlanResponse = { status:boolean; data:{ plan_code:string } };

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error:'Sign in first.' }, { status:401 });
    const supabase = serverSupabase(token);
    const { data:{ user }, error:userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error:'Your session has expired.' }, { status:401 });
    const { commitmentId } = await request.json();
    const { data:commitment, error } = await supabase.from('commitments').select('id,user_id,school_id,amount_cents,currency,status,payment_plan_code,schools(name)').eq('id',commitmentId).eq('user_id',user.id).single();
    if (error || !commitment) return NextResponse.json({ error:'Contribution not found.' }, { status:404 });
    const { data:profile } = await supabase.from('profiles').select('email').eq('id',user.id).maybeSingle();
    const email = profile?.email?.trim() || user.email?.trim();
    if (!email) return NextResponse.json({ error:'Add your email address in Profile before setting up payment.' }, { status:400 });
    const school = Array.isArray(commitment.schools) ? commitment.schools[0] : commitment.schools;
    let planCode=commitment.payment_plan_code as string|null;
    if(!planCode){
      const plan=await paystackRequest<PlanResponse>('/plan',{method:'POST',body:JSON.stringify({name:`Skolo Saka – ${school?.name||'School'} – R${Number(commitment.amount_cents)/100}/month`,amount:Number(commitment.amount_cents),interval:'monthly',currency:'ZAR',description:'Monthly Skolo Saka school contribution',send_invoices:true,send_sms:false})});
      planCode=plan.data.plan_code;
    }
    const origin=process.env.NEXT_APP_URL||request.nextUrl.origin;
    const initialized=await paystackRequest<InitializeResponse>('/transaction/initialize',{method:'POST',body:JSON.stringify({email,amount:Number(commitment.amount_cents),currency:'ZAR',plan:planCode,callback_url:`${origin}/payment/complete`,metadata:{commitment_id:commitment.id,user_id:user.id,school_id:commitment.school_id,source:'skolo_saka'}})});
    const {error:updateError}=await supabase.from('commitments').update({payment_provider:'paystack',payment_plan_code:planCode,provider_reference:initialized.data.reference,updated_at:new Date().toISOString()}).eq('id',commitment.id).eq('user_id',user.id);
    if(updateError) throw updateError;
    return NextResponse.json({authorizationUrl:initialized.data.authorization_url,reference:initialized.data.reference});
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : 'Could not start payment.' }, { status:500 });
  }
}
