import { NextRequest, NextResponse } from 'next/server';
import { authenticatedUser } from '@/lib/payment-instructions-server';
import { hasSportsAdminRole } from '@/lib/sports-access';

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticatedUser(request);
    if (!auth) return json({ error: 'Sign in to continue.' }, 401);
    const area = request.nextUrl.searchParams.get('area');
    if (area !== 'analytics' && area !== 'sports') return json({ error: 'Unknown administration area.' }, 400);
    // Read current assignments using the caller's session and own-role RLS.
    // Never trust browser state or editable profile/JWT user metadata.
    const allowed = area === 'analytics'
      ? await auth.supabase.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle()
      : await auth.supabase.from('sports_admin_assignments').select('user_id,role,school_id,team_id,active').eq('user_id', auth.user.id).eq('active', true);
    if (allowed.error) return json({ error: 'Unable to verify your access. Please try again.' }, 503);
    const permitted = area === 'analytics' ? Boolean(allowed.data) : hasSportsAdminRole(Array.isArray(allowed.data) ? allowed.data : []);
    if (!permitted) return json({ error: area === 'analytics'
      ? 'Analytics is restricted to approved platform administrators.'
      : 'Sports administration is restricted to assigned school managers and coaches.' }, 403);
    return json({ allowed: true, userId: auth.user.id });
  } catch {
    return json({ error: 'Unable to verify your access. Please try again.' }, 503);
  }
}
