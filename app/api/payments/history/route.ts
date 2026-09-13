import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/paystack-server';
import { authenticatedUser } from '@/lib/payment-instructions-server';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticatedUser(request);
    if (!auth) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    const { data, error } = await adminSupabase().from('ledger_transactions')
      .select('id,amount_cents,occurred_at,schools(name)')
      .eq('user_id', auth.user.id).eq('type', 'contribution')
      .order('occurred_at', { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ contributions: data || [] });
  } catch {
    return NextResponse.json({ error: 'Could not load contributions. Please try again.' }, { status: 500 });
  }
}
