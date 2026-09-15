import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase, paystackRequest } from '@/lib/paystack-server';
import { authenticatedUser, fetchInstruction, instructionAllocations } from '@/lib/payment-instructions-server';

export const runtime = 'nodejs';

type UpdatePlanResponse = { status: boolean; message: string };

async function updatePlanAmount(planCode: string, amountCents: number) {
  return paystackRequest<UpdatePlanResponse>(`/plan/${encodeURIComponent(planCode)}`, {
    method: 'PUT',
    body: JSON.stringify({ amount: amountCents, update_existing_subscriptions: true }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticatedUser(request);
    if (!auth) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

    const body = await request.json();
    const instructionId = body.instructionId ? String(body.instructionId) : '';
    const amountCents = body.amountCents;
    if (!instructionId || !Number.isSafeInteger(amountCents) || amountCents < 1000 || amountCents > 100_000_000) {
      return NextResponse.json({ error: 'Enter a monthly amount between R10 and R1,000,000.' }, { status: 400 });
    }

    const db = adminSupabase();
    const instruction = await fetchInstruction(db, instructionId);
    if (!instruction || instruction.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Monthly payment not found.' }, { status: 404 });
    }
    if (instruction.kind !== 'recurring' || instruction.status !== 'active' || !instruction.provider_subscription_code || !instruction.provider_plan_code) {
      return NextResponse.json({ error: 'Only an active monthly payment can be changed.' }, { status: 409 });
    }
    const allocations = await instructionAllocations(db, instruction.id);
    if (allocations.length && amountCents < allocations.length * 1000) {
      return NextResponse.json({ error: `Enter at least R${allocations.length * 10} so every school receives the R10 minimum.` }, { status: 400 });
    }
    if (Number(instruction.amount_cents) === amountCents) {
      return NextResponse.json({ success: true, amountCents, nextPaymentAt: instruction.next_payment_at || null });
    }

    const oldAmount = Number(instruction.amount_cents);
    await updatePlanAmount(instruction.provider_plan_code, amountCents);

    const { error } = await db.rpc('change_payment_instruction_amount', {
      p_instruction_id: instruction.id,
      p_amount_cents: amountCents,
    });
    if (error) {
      // Keep Paystack and the local ledger model aligned if the atomic local
      // update fails after Paystack accepted the new plan amount.
      try { await updatePlanAmount(instruction.provider_plan_code, oldAmount); } catch (rollbackError) {
        console.error('Could not restore Paystack plan amount after local update failure', rollbackError);
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      amountCents,
      nextPaymentAt: instruction.next_payment_at || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not change the monthly amount.' }, { status: 500 });
  }
}
