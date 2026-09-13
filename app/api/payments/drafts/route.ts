import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/paystack-server';
import { authenticatedUser } from '@/lib/payment-instructions-server';

// A draft is a saved preference, never a mandate or a charge. Existing RLS
// denies direct client writes; all mutations here are scoped to the caller.
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticatedUser(request);
    if (!auth) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    const body = await request.json();
    const { kind, amountCents } = body;
    const termMonths = kind === 'recurring' ? body.termMonths ?? null : null;
    if (!['recurring', 'one_off'].includes(kind) || !Number.isSafeInteger(amountCents) || amountCents < 1000 || amountCents > 100_000_000 ||
        (termMonths !== null && (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 1200))) {
      return NextResponse.json({ error: 'Choose at least R10 and a valid payment term.' }, { status: 400 });
    }
    const { data, error } = await adminSupabase().from('payment_instructions').insert({
      user_id: auth.user.id, kind, cadence: kind === 'recurring' ? 'monthly' : null,
      term_months: termMonths, amount_cents: amountCents, currency: 'ZAR',
      status: 'pending', provider: 'draft',
    }).select('id').single();
    if (error) throw error;
    return NextResponse.json({ instructionId: data.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Could not save your arrangement. Please try again.' }, { status: 500 });
  }
}
