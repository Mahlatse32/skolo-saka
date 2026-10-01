import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/paystack-server';
import { authenticatedUser } from '@/lib/payment-instructions-server';

export async function GET(request: NextRequest) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: 'Sign in with your password first.' }, { status: 401 });
  const db = adminSupabase();
  const { data: role, error: roleError } = await db.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle();
  if (roleError) return NextResponse.json({ error: 'Could not verify administrator access.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  if (!role) return NextResponse.json({ error: 'Platform administrator access required.' }, { status: 403 });
  const requested = Number(request.nextUrl.searchParams.get('days') || 30);
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const { data, error } = await db.rpc('platform_analytics_summary', { p_days: days });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}
