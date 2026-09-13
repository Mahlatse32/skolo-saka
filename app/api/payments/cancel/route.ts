import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/paystack-server';
import { authenticatedUser, disablePaystackSubscription, fetchInstruction, fetchPaystackSubscription } from '@/lib/payment-instructions-server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticatedUser(request);
    if (!auth) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    const body = await request.json();
    const instructionId = body.instructionId ? String(body.instructionId) : '';
    const legacyCommitmentId = body.legacyCommitmentId ? String(body.legacyCommitmentId) : '';
    if (!instructionId && !legacyCommitmentId) return NextResponse.json({ error: 'Payment instruction is required.' }, { status: 400 });

    const db = adminSupabase();

    if (instructionId) {
      const instruction = await fetchInstruction(db, instructionId);
      if (!instruction || instruction.user_id !== auth.user.id) return NextResponse.json({ error: 'Payment instruction not found.' }, { status: 404 });
      if (['cancelled','completed'].includes(instruction.status)) return NextResponse.json({ success: true, status: instruction.status });

      if (instruction.kind === 'one_off') {
        if (instruction.status === 'pending' || instruction.status === 'failed') {
          const { error } = await db.from('payment_instructions').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', instruction.id);
          if (error) throw error;
          return NextResponse.json({ success: true, status: 'cancelled' });
        }
        return NextResponse.json({ error: 'A completed once-off payment cannot be cancelled.' }, { status: 400 });
      }

      let code = instruction.provider_subscription_code || '';
      let token = instruction.provider_email_token || '';
      if (!code) return NextResponse.json({ error: 'This monthly payment is not active yet.' }, { status: 400 });
      if (!token) {
        const fetched = await fetchPaystackSubscription(code);
        token = fetched.data.email_token || '';
        if (token) {
          const { error } = await db.from('payment_instructions').update({ provider_email_token: token, next_payment_at: fetched.data.next_payment_date || null, updated_at: new Date().toISOString() }).eq('id', instruction.id);
          if (error) throw error;
        }
      }
      if (!token) throw new Error('Could not retrieve the Paystack cancellation token.');
      await disablePaystackSubscription(code, token);
      const now = new Date().toISOString();
      const { error: cancelError } = await db.from('payment_instructions').update({ status: 'non_renewing', cancelled_at: now, updated_at: now }).eq('id', instruction.id);
      if (cancelError) throw cancelError;
      return NextResponse.json({ success: true, status: 'non_renewing' });
    }

    const { data: commitment, error: commitmentError } = await db.from('commitments')
      .select('id,user_id,payment_subscription_code,status')
      .eq('id', legacyCommitmentId)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (commitmentError) throw commitmentError;
    if (!commitment) return NextResponse.json({ error: 'Monthly payment not found.' }, { status: 404 });
    if (!commitment.payment_subscription_code) return NextResponse.json({ error: 'No active Paystack subscription is attached.' }, { status: 400 });

    const fetched = await fetchPaystackSubscription(commitment.payment_subscription_code);
    const token = fetched.data.email_token || '';
    if (!token) throw new Error('Could not retrieve the Paystack cancellation token.');
    await disablePaystackSubscription(commitment.payment_subscription_code, token);
    const now = new Date().toISOString();
    const { error: updateError } = await db.from('commitments').update({ status: 'cancelled', cancelled_at: now, updated_at: now }).eq('id', commitment.id).eq('user_id', auth.user.id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, status: 'cancelled' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not cancel payment.' }, { status: 500 });
  }
}
