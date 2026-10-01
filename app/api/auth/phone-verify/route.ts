import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase, serverSupabase } from '@/lib/paystack-server';
import { normalizeSaPhone } from '@/lib/pin-auth';
import { createPasswordProof, PASSWORD_PROOF_COOKIE } from '@/lib/password-proof';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const body = await request.json();
    if (typeof body.phone !== 'string' || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) return json('Enter the six-digit SMS code.', 400);
    const phone = normalizeSaPhone(body.phone);
    if (!/^\+27[6-8]\d{8}$/.test(phone)) return json('Enter a valid South African mobile number.', 400);
    const client = serverSupabase();
    const { data, error } = await client.auth.verifyOtp({ phone, token: body.code, type: 'sms' });
    if (error || !data.user || !data.session || !data.user.phone || normalizeSaPhone(data.user.phone) !== phone) return json('That code is invalid or has expired. Request a new SMS code.', 400);
    const { data: verified, error: claimsError } = await client.auth.getClaims(data.session.access_token);
    if (claimsError || verified?.claims?.sub !== data.user.id || !verified.claims.session_id) return json('Could not verify this session. Request a new SMS code.', 400);
    const { data: profile, error: profileError } = await adminSupabase().from('profiles').select('phone').eq('id', data.user.id).maybeSingle();
    if (profileError || !profile || (profile.phone && normalizeSaPhone(profile.phone) !== phone)) return json('Use the original verified phone number for this account.', 403);
    const proof = createPasswordProof({ sub: data.user.id, sessionId: verified.claims.session_id, phone });
    const response = NextResponse.json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } }, { headers: { 'Cache-Control': 'private, no-store' } });
    response.cookies.set(PASSWORD_PROOF_COOKIE, proof, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth/password', maxAge: 600 });
    return response;
  } catch { return json('Could not verify your SMS code. Try again.', 400); }
}
