import { NextRequest, NextResponse } from 'next/server';
import { authenticatedUser } from '@/lib/payment-instructions-server';
import { adminSupabase } from '@/lib/paystack-server';

export const runtime = 'nodejs';
const PAGE_SIZE = 10;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
type Context = { params: Promise<{ id: string }> };

async function member(request: NextRequest, context: Context) {
  const auth = await authenticatedUser(request);
  if (!auth) return { response: json({ error: 'Sign in to see classmates and schoolmates.' }, 401) };
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { response: json({ error: 'School not found.' }, 404) };
  const { data, error } = await auth.supabase.from('school_memberships')
    .select('id,grade_left,graduation_year').eq('school_id', id).eq('user_id', auth.user.id).eq('role', 'alumnus').maybeSingle();
  if (error) throw error;
  if (!data) return { response: json({ error: 'Add this school to My School as an alumnus to see its community.' }, 403) };
  return { auth, id, membership: data };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const access = await member(request, context);
    if (access.response) return access.response;
    const { auth, id, membership } = access;
    const mode = request.nextUrl.searchParams.get('mode') || 'classmates';
    const page = Number(request.nextUrl.searchParams.get('page') || '1');
    if (!['classmates', 'schoolmates'].includes(mode) || !Number.isSafeInteger(page) || page < 1 || page > 10000) return json({ error: 'Invalid community page.' }, 400);
    const cohort = { grade: membership.grade_left, year: membership.graduation_year };
    if (mode === 'classmates' && (!cohort.grade || !cohort.year)) return json({ items: [], total: 0, page, pageSize: PAGE_SIZE, cohort, needsDetails: true });
    let query = adminSupabase().from('school_memberships')
      .select('id,grade_left,graduation_year,profiles!school_memberships_user_id_fkey(first_name,last_name,full_name)', { count: 'exact' })
      .eq('school_id', id).eq('role', 'alumnus').neq('user_id', auth.user.id);
    if (mode === 'classmates') query = query.eq('grade_left', cohort.grade).eq('graduation_year', cohort.year);
    const { data, count, error } = await query.order('created_at', { ascending: false }).order('id')
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) throw error;
    const items = (data || []).map(row => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return { id: row.id, name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.full_name || 'School alumnus', grade: row.grade_left, year: row.graduation_year };
    });
    return json({ items, total: count || 0, page, pageSize: PAGE_SIZE, cohort, needsDetails: false });
  } catch {
    return json({ error: 'Could not load the school community. Please try again.' }, 500);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const access = await member(request, context);
    if (access.response) return access.response;
    const { grade, year } = await request.json();
    if (!Number.isInteger(grade) || grade < 1 || grade > 12 || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) return json({ error: 'Choose a grade from 1 to 12 and a valid past or current year.' }, 400);
    const { data, error } = await access.auth.supabase.from('school_memberships')
      .update({ grade_left: grade, graduation_year: year })
      .eq('id', access.membership.id).eq('user_id', access.auth.user.id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: 'Your school membership changed. Refresh and try again.' }, 409);
    return json({ saved: true });
  } catch {
    return json({ error: 'Could not save your school details. Please try again.' }, 500);
  }
}
