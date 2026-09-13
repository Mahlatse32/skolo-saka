import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase, verifyPaystackSignature } from '@/lib/paystack-server';
import { fetchInstruction, instructionAllocations, recordInstructionCharge } from '@/lib/payment-instructions-server';

export const runtime = 'nodejs';

function planCode(data: any) { return String(data?.plan?.plan_code || data?.plan?.planCode || data?.plan_code || ''); }
function subscriptionCode(data: any) { return String(data?.subscription_code || data?.subscription?.subscription_code || ''); }
function emailToken(data: any) { return String(data?.email_token || data?.subscription?.email_token || ''); }
function nextPaymentDate(data: any) { return data?.next_payment_date || data?.subscription?.next_payment_date || null; }

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyPaystackSignature(rawBody, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);
    const data = event?.data || {};
    const metadata = data?.metadata || {};
    const db = adminSupabase();

    let instruction: any = null;
    const instructionId = String(metadata.payment_instruction_id || '');
    if (instructionId) instruction = await fetchInstruction(db, instructionId);
    if (!instruction && subscriptionCode(data)) {
      const result = await db.from('payment_instructions')
        .select('id,user_id,kind,cadence,term_months,amount_cents,currency,status,provider_plan_code,provider_subscription_code,provider_email_token,provider_reference')
        .eq('provider_subscription_code', subscriptionCode(data)).maybeSingle();
      if (result.error) throw result.error;
      instruction = result.data;
    }
    if (!instruction && planCode(data)) {
      const result = await db.from('payment_instructions')
        .select('id,user_id,kind,cadence,term_months,amount_cents,currency,status,provider_plan_code,provider_subscription_code,provider_email_token,provider_reference')
        .eq('provider_plan_code', planCode(data)).maybeSingle();
      if (result.error) throw result.error;
      instruction = result.data;
    }

    if (instruction) {
      if (event.event === 'subscription.create') {
        const code = subscriptionCode(data) || null;
        const token = emailToken(data) || null;
        const now = new Date().toISOString();
        const { error } = await db.from('payment_instructions').update({
          provider_subscription_code: code,
          provider_email_token: token,
          next_payment_at: nextPaymentDate(data),
          status: 'active',
          started_at: instruction.started_at || now,
          cancelled_at: null,
          updated_at: now,
        }).eq('id', instruction.id);
        if (error) throw error;
        const allocations = await instructionAllocations(db, instruction.id);
        for (const allocation of allocations) {
          if (!allocation.commitment_id) continue;
          const { error: commitmentError } = await db.from('commitments').update({
            status: 'active',
            payment_provider: 'paystack',
            payment_instruction_id: instruction.id,
            payment_plan_code: instruction.provider_plan_code,
            payment_subscription_code: code,
            cancelled_at: null,
            updated_at: now,
          }).eq('id', allocation.commitment_id).eq('user_id', instruction.user_id);
          if (commitmentError) throw commitmentError;
        }
      }

      if (event.event === 'charge.success') {
        const reference = String(data.reference || data?.transaction?.reference || '');
        const amount = Number(data.amount || data?.transaction?.amount || 0);
        const currency = String(data.currency || data?.transaction?.currency || '').toUpperCase();
        await recordInstructionCharge({
          db,
          instruction,
          reference,
          amount,
          currency,
          paidAt: data.paid_at || data?.transaction?.paid_at || data?.created_at || null,
          transactionId: data.id || data?.transaction?.id || null,
          channel: data.channel || data?.authorization?.channel || null,
        });
        const code = subscriptionCode(data);
        if (instruction.kind === 'recurring' && code) {
          const token = emailToken(data) || instruction.provider_email_token || null;
          const { error } = await db.from('payment_instructions').update({
            provider_subscription_code: code,
            provider_email_token: token,
            next_payment_at: nextPaymentDate(data),
            updated_at: new Date().toISOString(),
          }).eq('id', instruction.id);
          if (error) throw error;
        }
      }

      if (event.event === 'subscription.not_renew') {
        const { error } = await db.from('payment_instructions').update({
          status: 'non_renewing',
          cancelled_at: new Date().toISOString(),
          next_payment_at: nextPaymentDate(data),
          updated_at: new Date().toISOString(),
        }).eq('id', instruction.id);
        if (error) throw error;
      }

      if (event.event === 'subscription.disable') {
        const completed = String(data?.status || '').toLowerCase() === 'complete';
        const now = new Date().toISOString();
        const { error } = await db.from('payment_instructions').update({
          status: completed ? 'completed' : 'cancelled',
          cancelled_at: completed ? instruction.cancelled_at : now,
          completed_at: completed ? now : null,
          next_payment_at: null,
          updated_at: now,
        }).eq('id', instruction.id);
        if (error) throw error;
        const allocations = await instructionAllocations(db, instruction.id);
        for (const allocation of allocations) {
          if (!allocation.commitment_id) continue;
          const { error: commitmentError } = await db.from('commitments').update({
            status: 'cancelled', cancelled_at: now, updated_at: now,
          }).eq('id', allocation.commitment_id).eq('user_id', instruction.user_id);
          if (commitmentError) throw commitmentError;
        }
      }

      return NextResponse.json({ received: true });
    }

    // Backward compatibility for the initial one-school-per-subscription implementation.
    const commitmentId = String(metadata.commitment_id || '');
    let commitment: any = null;
    if (commitmentId) {
      const result = await db.from('commitments').select('id,user_id,school_id,amount_cents,currency').eq('id', commitmentId).maybeSingle();
      if (result.error) throw result.error;
      commitment = result.data;
    }
    if (!commitment && subscriptionCode(data)) {
      const result = await db.from('commitments').select('id,user_id,school_id,amount_cents,currency').eq('payment_subscription_code', subscriptionCode(data)).maybeSingle();
      if (result.error) throw result.error;
      commitment = result.data;
    }
    if (!commitment && planCode(data)) {
      const result = await db.from('commitments').select('id,user_id,school_id,amount_cents,currency').eq('payment_plan_code', planCode(data)).maybeSingle();
      if (result.error) throw result.error;
      commitment = result.data;
    }
    if (!commitment) return NextResponse.json({ received: true });

    if (event.event === 'subscription.create') {
      const { error } = await db.from('commitments').update({
        payment_provider: 'paystack', payment_subscription_code: subscriptionCode(data) || null,
        status: 'active', started_at: new Date().toISOString(), cancelled_at: null, updated_at: new Date().toISOString(),
      }).eq('id', commitment.id);
      if (error) throw error;
    }
    if (event.event === 'charge.success') {
      const reference = String(data.reference || '');
      const amount = Number(data.amount || 0);
      const currency = String(data.currency || '').toUpperCase();
      if (reference && amount === Number(commitment.amount_cents) && currency === String(commitment.currency).toUpperCase()) {
        const { error: updateError } = await db.from('commitments').update({
          status: 'active', payment_provider: 'paystack', provider_reference: reference,
          payment_subscription_code: subscriptionCode(data) || undefined,
          started_at: new Date(data.paid_at || Date.now()).toISOString(), cancelled_at: null, updated_at: new Date().toISOString(),
        }).eq('id', commitment.id);
        if (updateError) throw updateError;
        const { error: ledgerError } = await db.from('ledger_transactions').upsert({
          user_id: commitment.user_id, school_id: commitment.school_id, commitment_id: commitment.id,
          type: 'contribution', amount_cents: amount, currency: data.currency || 'ZAR', external_reference: reference,
          metadata: { provider: 'paystack', event: 'charge.success', transaction_id: data.id, channel: data.channel || null, subscription_code: subscriptionCode(data) || null },
          occurred_at: new Date(data.paid_at || Date.now()).toISOString(),
        }, { onConflict: 'external_reference' });
        if (ledgerError) throw ledgerError;
      }
    }
    if (event.event === 'subscription.disable' || event.event === 'subscription.not_renew') {
      const { error } = await db.from('commitments').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', commitment.id);
      if (error) throw error;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Paystack webhook failed', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
