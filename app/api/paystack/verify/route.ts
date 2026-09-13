import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase, paystackRequest } from '@/lib/paystack-server';
import { fetchInstruction, recordInstructionCharge } from '@/lib/payment-instructions-server';

type VerifyResponse = {
  status: boolean;
  data: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at: string;
    metadata?: Record<string, unknown>;
    id: number;
    channel?: string;
  };
};

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const reference = request.nextUrl.searchParams.get('reference');
    if (!reference) return NextResponse.json({ success: false, message: 'Missing payment reference.' }, { status: 400 });

    const verified = await paystackRequest<VerifyResponse>(`/transaction/verify/${encodeURIComponent(reference)}`);
    const data = verified.data;
    if (data.status !== 'success') return NextResponse.json({ success: false, message: 'Payment is not successful yet.' });

    const db = adminSupabase();
    const instructionId = String(data.metadata?.payment_instruction_id || '');
    if (instructionId) {
      const instruction = await fetchInstruction(db, instructionId);
      if (!instruction) return NextResponse.json({ success: false, message: 'Payment instruction could not be matched.' }, { status: 404 });
      const allocations = await recordInstructionCharge({
        db,
        instruction,
        reference: data.reference,
        amount: Number(data.amount),
        currency: data.currency,
        paidAt: data.paid_at,
        transactionId: data.id,
        channel: data.channel || null,
      });
      return NextResponse.json({ success: true, kind: instruction.kind, schoolCount: allocations.length });
    }

    // Backward compatibility for the first per-school Paystack subscriptions.
    const commitmentId = String(data.metadata?.commitment_id || '');
    if (!commitmentId) return NextResponse.json({ success: false, message: 'Payment could not be matched.' });
    const { data: commitment, error: commitmentError } = await db.from('commitments')
      .select('id,user_id,school_id,amount_cents,currency')
      .eq('id', commitmentId)
      .maybeSingle();
    if (commitmentError) throw commitmentError;
    if (!commitment || Number(commitment.amount_cents) !== Number(data.amount) || String(commitment.currency) !== String(data.currency)) {
      return NextResponse.json({ success: false, message: 'Payment details do not match the contribution.' });
    }

    const occurredAt = new Date(data.paid_at || Date.now()).toISOString();
    const { error: updateError } = await db.from('commitments').update({
      status: 'active', payment_provider: 'paystack', provider_reference: data.reference,
      started_at: occurredAt, cancelled_at: null, updated_at: new Date().toISOString(),
    }).eq('id', commitment.id);
    if (updateError) throw updateError;
    const { error: ledgerError } = await db.from('ledger_transactions').upsert({
      user_id: commitment.user_id, school_id: commitment.school_id, commitment_id: commitment.id,
      type: 'contribution', amount_cents: data.amount, currency: data.currency, external_reference: data.reference,
      metadata: { provider: 'paystack', verified: true, transaction_id: data.id, channel: data.channel || null },
      occurred_at: occurredAt,
    }, { onConflict: 'external_reference' });
    if (ledgerError) throw ledgerError;
    return NextResponse.json({ success: true, kind: 'recurring', schoolCount: 1 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not verify payment.' }, { status: 500 });
  }
}
