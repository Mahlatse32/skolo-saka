import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase, verifyPaystackSignature } from '@/lib/paystack-server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyPaystackSignature(rawBody, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error:'Invalid signature' }, { status:401 });
  }
  try {
    const event = JSON.parse(rawBody);
    const data = event?.data || {};
    const metadata = data?.metadata || {};
    const commitmentId = metadata.commitment_id as string | undefined;
    if (!commitmentId) return NextResponse.json({ received:true });
    const db = adminSupabase();
    const { data:commitment } = await db.from('commitments').select('id,user_id,school_id,amount_cents,currency').eq('id',commitmentId).maybeSingle();
    if (!commitment) return NextResponse.json({ received:true });

    if (event.event === 'charge.success') {
      const reference = String(data.reference || '');
      const amount = Number(data.amount || 0);
      if (!reference || amount !== Number(commitment.amount_cents) || String(data.currency || '').toUpperCase() !== String(commitment.currency).toUpperCase()) {
        return NextResponse.json({ received:true });
      }
      await db.from('commitments').update({
        status:'active', payment_provider:'paystack', provider_reference:reference,
        started_at:new Date(data.paid_at || Date.now()).toISOString(), cancelled_at:null, updated_at:new Date().toISOString()
      }).eq('id',commitment.id);
      await db.from('ledger_transactions').upsert({
        user_id:commitment.user_id, school_id:commitment.school_id, commitment_id:commitment.id,
        type:'contribution', amount_cents:amount, currency:data.currency || 'ZAR', external_reference:reference,
        metadata:{ provider:'paystack', event:'charge.success', transaction_id:data.id, channel:data.channel || null },
        occurred_at:new Date(data.paid_at || Date.now()).toISOString()
      }, { onConflict:'external_reference' });
    }

    if (event.event === 'subscription.disable') {
      await db.from('commitments').update({ status:'cancelled', cancelled_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq('id',commitment.id);
    }
    return NextResponse.json({ received:true });
  } catch {
    return NextResponse.json({ received:true });
  }
}
