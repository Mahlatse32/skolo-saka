import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase, paystackRequest } from '@/lib/paystack-server';
import { authenticatedUser, type PaymentKind } from '@/lib/payment-instructions-server';

type AllocationInput = { schoolId: string; amountCents: number };
type InitializeResponse = { status: boolean; data: { authorization_url: string; access_code: string; reference: string } };
type PlanResponse = { status: boolean; data: { plan_code: string } };

export const runtime = 'nodejs';

function cleanAllocations(value: unknown): AllocationInput[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: AllocationInput[] = [];
  for (const row of value) {
    const schoolId = String((row as any)?.schoolId || '');
    const amountCents = Number((row as any)?.amountCents || 0);
    if (!schoolId || seen.has(schoolId) || !Number.isInteger(amountCents) || amountCents < 1000 || amountCents > 100_000_000) continue;
    seen.add(schoolId);
    rows.push({ schoolId, amountCents });
  }
  return rows;
}

export async function POST(request: NextRequest) {
  let instructionId: string | null = null;
  try {
    const auth = await authenticatedUser(request);
    if (!auth) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

    const body = await request.json();
    if (body.consent !== true) return NextResponse.json({ error: 'Confirm the payment terms before continuing.' }, { status: 400 });
    const kind = String(body.kind || '') as PaymentKind;
    if (kind !== 'one_off' && kind !== 'recurring') return NextResponse.json({ error: 'Choose once-off or monthly payment.' }, { status: 400 });
    const allocations = cleanAllocations(body.allocations);
    if (!Array.isArray(body.allocations) || allocations.length !== body.allocations.length) return NextResponse.json({ error: 'Each school must have a valid contribution of at least R10. Please review your selection.' }, { status: 400 });
    if (!allocations.length) return NextResponse.json({ error: 'Choose at least one school.' }, { status: 400 });
    if (allocations.length > 20) return NextResponse.json({ error: 'Too many schools in one payment.' }, { status: 400 });

    const rawTerm = body.termMonths;
    const termMonths = kind === 'recurring' && rawTerm !== null && rawTerm !== undefined && rawTerm !== '' ? Number(rawTerm) : null;
    if (termMonths !== null && (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 1200)) {
      return NextResponse.json({ error: 'Choose a term between 1 and 1200 months, or Forever.' }, { status: 400 });
    }

    const schoolIds = allocations.map(row => row.schoolId);
    const { data: memberships, error: membershipError } = await auth.supabase
      .from('school_memberships')
      .select('school_id')
      .eq('user_id', auth.user.id)
      .in('school_id', schoolIds);
    if (membershipError) throw membershipError;
    const allowed = new Set((memberships || []).map(row => row.school_id));
    if (allowed.size !== schoolIds.length) return NextResponse.json({ error: 'One or more schools are not linked to your account.' }, { status: 403 });

    const { data: profile, error: profileError } = await auth.supabase.from('profiles').select('email').eq('id', auth.user.id).maybeSingle();
    if (profileError) throw profileError;
    const email = profile?.email?.trim() || auth.user.email?.trim();
    if (!email) return NextResponse.json({ error: 'Add your email address in Profile before setting up payment.' }, { status: 400 });

    const db = adminSupabase();
    const total = allocations.reduce((sum, row) => sum + row.amountCents, 0);
    const { data: instruction, error: instructionError } = await db.from('payment_instructions').insert({
      user_id: auth.user.id,
      kind,
      cadence: kind === 'recurring' ? 'monthly' : null,
      term_months: kind === 'recurring' ? termMonths : null,
      amount_cents: total,
      currency: 'ZAR',
      status: 'pending',
      provider: 'paystack',
    }).select('id').single();
    if (instructionError || !instruction) throw instructionError || new Error('Could not create payment instruction.');
    instructionId = instruction.id;

    const allocationRows: Array<{ payment_instruction_id: string; school_id: string; commitment_id: string | null; amount_cents: number }> = [];
    for (const allocation of allocations) {
      let commitmentId: string | null = null;
      if (kind === 'recurring') {
        const { data: existing, error: existingError } = await db.from('commitments')
          .select('id,status,payment_instruction_id,payment_provider,payment_subscription_code')
          .eq('user_id', auth.user.id)
          .eq('school_id', allocation.schoolId)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existing?.id) {
          const activeStatus = ['pending','active','paused'].includes(existing.status);
          if (existing.payment_subscription_code && activeStatus && !existing.payment_instruction_id) {
            throw new Error('One of these schools already has an active individual monthly payment. Cancel it before creating one combined payment.');
          }
          if (existing.payment_instruction_id && existing.payment_instruction_id !== instruction.id && activeStatus) {
            throw new Error('One of these schools is already attached to another monthly payment. Cancel that payment before creating another.');
          }
          const { error: updateError } = await db.from('commitments').update({
            amount_cents: allocation.amountCents,
            status: 'pending',
            payment_provider: 'paystack',
            payment_instruction_id: instruction.id,
            provider_reference: null,
            payment_plan_code: null,
            payment_subscription_code: null,
            cancelled_at: null,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id).eq('user_id', auth.user.id);
          if (updateError) throw updateError;
          commitmentId = existing.id;
        } else {
          const { data: inserted, error: insertError } = await db.from('commitments').insert({
            user_id: auth.user.id,
            school_id: allocation.schoolId,
            amount_cents: allocation.amountCents,
            currency: 'ZAR',
            frequency: 'monthly',
            status: 'pending',
            payment_provider: 'paystack',
            payment_instruction_id: instruction.id,
          }).select('id').maybeSingle();
          if (insertError) throw insertError;
          if (inserted?.id) commitmentId = inserted.id;
          if (!commitmentId) {
            const { data: reread, error: rereadError } = await db.from('commitments').select('id,status,payment_instruction_id,payment_subscription_code').eq('user_id', auth.user.id).eq('school_id', allocation.schoolId).maybeSingle();
            if (rereadError || !reread) throw rereadError || new Error('Could not prepare school commitment.');
            if (reread.payment_subscription_code && ['pending','active','paused'].includes(reread.status) && !reread.payment_instruction_id) {
              throw new Error('One of these schools already has an active individual monthly payment. Cancel it before creating one combined payment.');
            }
            commitmentId = reread.id;
            const { error: relinkError } = await db.from('commitments').update({ payment_instruction_id: instruction.id }).eq('id', commitmentId);
            if (relinkError) throw relinkError;
          }
        }
      }
      allocationRows.push({ payment_instruction_id: instruction.id, school_id: allocation.schoolId, commitment_id: commitmentId, amount_cents: allocation.amountCents });
    }

    const { error: allocationError } = await db.from('payment_instruction_allocations').insert(allocationRows);
    if (allocationError) throw allocationError;

    let planCode: string | null = null;
    if (kind === 'recurring') {
      const plan = await paystackRequest<PlanResponse>('/plan', {
        method: 'POST',
        body: JSON.stringify({
          name: `Skolo Saka – ${allocations.length} ${allocations.length === 1 ? 'school' : 'schools'} – R${total / 100}/month`,
          amount: total,
          interval: 'monthly',
          currency: 'ZAR',
          invoice_limit: termMonths || undefined,
          description: termMonths ? `Skolo Saka monthly contribution for ${termMonths} months` : 'Skolo Saka monthly contribution until cancelled',
          send_invoices: true,
          send_sms: false,
        }),
      });
      planCode = plan.data.plan_code;
      const { error: planSaveError } = await db.from('payment_instructions').update({ provider_plan_code: planCode, updated_at: new Date().toISOString() }).eq('id', instruction.id);
      if (planSaveError) throw planSaveError;
    }

    const origin = process.env.NEXT_APP_URL || request.nextUrl.origin;
    const payload: Record<string, unknown> = {
      email,
      amount: total,
      currency: 'ZAR',
      channels: ['card'],
      callback_url: `${origin}/payment/complete`,
      metadata: {
        payment_instruction_id: instruction.id,
        user_id: auth.user.id,
        kind,
        source: 'skolo_saka_payment_center',
        consent_version: 'card-contribution-v1',
        consent_at: new Date().toISOString(),
      },
    };
    if (planCode) payload.plan = planCode;

    const initialized = await paystackRequest<InitializeResponse>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const { error: referenceError } = await db.from('payment_instructions').update({
      provider_reference: initialized.data.reference,
      updated_at: new Date().toISOString(),
    }).eq('id', instruction.id);
    if (referenceError) throw referenceError;

    return NextResponse.json({ authorizationUrl: initialized.data.authorization_url, reference: initialized.data.reference, instructionId: instruction.id });
  } catch (error) {
    if (instructionId) {
      try {
        await adminSupabase().from('commitments').update({ payment_instruction_id: null, payment_provider: null }).eq('payment_instruction_id', instructionId).eq('status', 'pending');
        await adminSupabase().from('payment_instructions').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', instructionId);
      } catch { /* best effort */ }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not start payment.' }, { status: 500 });
  }
}
