import { createHmac, timingSafeEqual } from 'node:crypto';

export const PASSWORD_PROOF_COOKIE = 'skolo-password-setup';
type Proof = { sub: string; sessionId: string; phone: string; expiresAt: number };
function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Password verification is not configured');
  return secret;
}
function signature(payload: string) { return createHmac('sha256', key()).update(`password-setup-v1:${payload}`).digest('base64url'); }

export function createPasswordProof(proof: Omit<Proof, 'expiresAt'>, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...proof, expiresAt: now + 600_000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifyPasswordProof(value: string | undefined, expected: Omit<Proof, 'expiresAt'>, now = Date.now()) {
  if (!value) return false;
  try {
    const parts = value.split('.');
    if (parts.length !== 2) return false;
    const actual = Buffer.from(parts[1]), wanted = Buffer.from(signature(parts[0]));
    if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return false;
    const proof: Proof = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return proof.sub === expected.sub && proof.sessionId === expected.sessionId && proof.phone === expected.phone &&
      typeof proof.expiresAt === 'number' && now < proof.expiresAt && proof.expiresAt <= now + 600_000;
  } catch { return false; }
}
