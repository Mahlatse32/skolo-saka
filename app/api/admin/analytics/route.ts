import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase, serverSupabase } from '@/lib/paystack-server';

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { data: authData, error: authError } = await serverSupabase(token).auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  const db = adminSupabase();
  const { data: role } = await db.from('platform_admins').select('user_id').eq('user_id', authData.user.id).maybeSingle();
  if (!role) return NextResponse.json({ error: 'Platform administrator access required.' }, { status: 403 });
  const requested = Number(request.nextUrl.searchParams.get('days') || 30);
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const { data, error } = await db.rpc('platform_analytics_summary', { p_days: days });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}
