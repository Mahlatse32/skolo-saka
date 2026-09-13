import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/paystack-server';
import { authenticatedUser } from '@/lib/payment-instructions-server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticatedUser(request);
    if (!auth) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    const db = adminSupabase();

    const [{ data: memberships, error: membershipError }, { data: commitments, error: commitmentError }, { data: instructions, error: instructionError }] = await Promise.all([
      db.from('school_memberships')
        .select('school_id,schools(id,name,level,province,town,municipality)')
        .eq('user_id', auth.user.id),
      db.from('commitments')
        .select('id,school_id,amount_cents,status,payment_provider,provider_reference,payment_plan_code,payment_subscription_code,payment_instruction_id,started_at,cancelled_at,schools(name,level)')
        .eq('user_id', auth.user.id),
      db.from('payment_instructions')
        .select('id,kind,cadence,term_months,amount_cents,currency,status,provider,provider_plan_code,provider_subscription_code,provider_reference,next_payment_at,started_at,cancelled_at,completed_at,created_at,payment_instruction_allocations(id,school_id,commitment_id,amount_cents,schools(name,level))')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false }),
    ]);
    if (membershipError) throw membershipError;
    if (commitmentError) throw commitmentError;
    if (instructionError) throw instructionError;

    const { data: contributions, error: contributionsError } = await db.from('ledger_transactions')
      .select('id,amount_cents,currency,occurred_at,schools(name)')
      .eq('user_id', auth.user.id).eq('type', 'contribution')
      .order('occurred_at', { ascending: false }).limit(100);
    if (contributionsError) throw contributionsError;

    const safeInstructions = (instructions || []).map((instruction: any) => ({
      id: instruction.id,
      kind: instruction.kind,
      cadence: instruction.cadence,
      term_months: instruction.term_months,
      amount_cents: Number(instruction.amount_cents),
      currency: instruction.currency,
      status: instruction.status,
      provider: instruction.provider,
      provider_plan_code: instruction.provider_plan_code,
      provider_subscription_code: instruction.provider_subscription_code,
      provider_reference: instruction.provider_reference,
      next_payment_at: instruction.next_payment_at,
      started_at: instruction.started_at,
      cancelled_at: instruction.cancelled_at,
      completed_at: instruction.completed_at,
      created_at: instruction.created_at,
      allocations: (instruction.payment_instruction_allocations || []).map((allocation: any) => ({
        id: allocation.id,
        school_id: allocation.school_id,
        commitment_id: allocation.commitment_id,
        amount_cents: Number(allocation.amount_cents),
        school: Array.isArray(allocation.schools) ? allocation.schools[0] : allocation.schools,
      })),
    }));

    const legacy = (commitments || [])
      .filter((row: any) => row.payment_provider === 'paystack' && row.payment_subscription_code && !row.payment_instruction_id && row.status !== 'cancelled')
      .map((row: any) => ({
        id: row.id,
        school_id: row.school_id,
        amount_cents: Number(row.amount_cents),
        status: row.status,
        provider_reference: row.provider_reference,
        payment_plan_code: row.payment_plan_code,
        payment_subscription_code: row.payment_subscription_code,
        started_at: row.started_at,
        school: Array.isArray(row.schools) ? row.schools[0] : row.schools,
      }));

    const commitmentBySchool = new Map((commitments || []).map((row: any) => [row.school_id, row]));
    const schools = (memberships || []).map((row: any) => {
      const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
      const commitment: any = commitmentBySchool.get(row.school_id);
      return {
        id: row.school_id,
        name: school?.name || 'School',
        level: school?.level || 'other',
        province: school?.province || '',
        town: school?.town || school?.municipality || null,
        amount_cents: Number(commitment?.amount_cents || 1000),
        commitment_id: commitment?.id || null,
        commitment_status: commitment?.status || null,
        payment_instruction_id: commitment?.payment_instruction_id || null,
        payment_provider: commitment?.payment_provider || null,
        payment_subscription_code: commitment?.payment_subscription_code || null,
      };
    });

    return NextResponse.json({ contributions, schools, instructions: safeInstructions, legacy, paymentMode: process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_') ? 'live' : process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'unavailable' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load payments.' }, { status: 500 });
  }
}
