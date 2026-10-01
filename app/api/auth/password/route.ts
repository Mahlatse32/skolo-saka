import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase, serverSupabase } from '@/lib/paystack-server';
import { hasPasswordCredential, hasRecentResetProof, passwordError, PASSWORD_CREDENTIAL_VERSION } from '@/lib/password-auth';
import { normalizeSaPhone } from '@/lib/pin-auth';
import { verifyPasswordProof, PASSWORD_PROOF_COOKIE } from '@/lib/password-proof';

export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Verify your phone or open a recovery link first.' }, 401);
    const client = serverSupabase(token);
    const { data: { user }, error: userError } = await client.auth.getUser(token);
    if (userError || !user) return json({ error: 'Your verification session has expired.' }, 401);
    const { data, error: claimsError } = await client.auth.getClaims(token);
    if (claimsError || !data?.claims || data.claims.sub !== user.id) {
      return json({ error: 'Verify by SMS or open a new recovery link before setting a password.' }, 403);
    }
    const db = adminSupabase();
    const { data: profile, error: profileError } = await db.from('profiles').select('phone,email').eq('id', user.id).maybeSingle();
    if (profileError || !profile) return json({ error: 'Could not verify your account details. Try again.' }, 503);
    // An old session cannot replace the account's phone/email and then upgrade it.
    if (profile.phone && (!user.phone || normalizeSaPhone(profile.phone) !== normalizeSaPhone(user.phone))) {
      return json({ error: 'Use the original verified phone number to recover this account.' }, 403);
    }
    const recentSms = Boolean(user.phone && data.claims.session_id && verifyPasswordProof(request.cookies.get(PASSWORD_PROOF_COOKIE)?.value, {
      sub: user.id, sessionId: data.claims.session_id, phone: normalizeSaPhone(user.phone),
    }));
    const recentRecovery = Array.isArray(data.claims.amr) && hasRecentResetProof({ amr: data.claims.amr.filter(entry => typeof entry === 'object' && entry?.method === 'recovery') });
    if (!recentSms && !recentRecovery) return json({ error: 'Verify by SMS or open a new recovery link before setting a password.' }, 403);
    if (!recentSms && !hasPasswordCredential(user) && (!user.email_confirmed_at || !profile.email || profile.email.trim().toLowerCase() !== user.email?.toLowerCase())) {
      return json({ error: 'Use your previously verified recovery email or verify by SMS.' }, 403);
    }
    const body = await request.json();
    const validation = passwordError(body.password);
    if (validation) return json({ error: validation }, 400);
    // The server authorizes recovery proof before using the Admin API. This
    // also supports SMS resets when direct client password changes require
    // the current password in hosted Auth settings.
    const { error: passwordUpdateError } = await db.auth.admin.updateUserById(user.id, {
      password: body.password,
      app_metadata: { ...user.app_metadata, credential_version: PASSWORD_CREDENTIAL_VERSION },
    });
    if (passwordUpdateError) return json({ error: 'Could not save this password. Choose another or request a new verification code.' }, 400);
    const { error: revokeError } = await db.auth.admin.signOut(token, 'others');
    if (revokeError) return json({ error: 'Password saved. Verify again to finish securing your other sessions.' }, 503);
    const response = json({ success: true });
    response.cookies.set(PASSWORD_PROOF_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth/password', maxAge: 0 });
    return response;
  } catch { return json({ error: 'Could not save your password. Try again.' }, 400); }
}
