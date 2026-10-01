import type { User } from '@supabase/supabase-js';

export const PASSWORD_CREDENTIAL_VERSION = 'password_v2';

export function hasPasswordCredential(user: Pick<User, 'app_metadata'> | null | undefined) {
  return user?.app_metadata?.credential_version === PASSWORD_CREDENTIAL_VERSION;
}

export function passwordError(value: unknown): string | null {
  if (typeof value !== 'string' || Array.from(value).length < 12) return 'Use at least 12 characters for your password.';
  if (new TextEncoder().encode(value).length > 72) return 'Use a password no longer than 72 bytes.';
  if (/^Ss![a-f0-9]{64}$/i.test(value) || /^\d+$/.test(value) || /^(.)\1+$/.test(value)) return 'Choose a password that is harder to guess. A few unrelated words work well.';
  if (['password1234', 'password12345', 'passwordpassword', 'qwerty123456', '123456abcdef'].includes(value.toLowerCase())) return 'Choose a password that is harder to guess. A few unrelated words work well.';
  return null;
}

export function hasRecentResetProof(claims: { amr?: unknown }, now = Date.now()) {
  if (!Array.isArray(claims.amr)) return false;
  const seconds = now / 1000;
  return claims.amr.some(entry => entry && ['otp', 'recovery'].includes(entry.method) &&
    typeof entry.timestamp === 'number' && entry.timestamp <= seconds + 30 && seconds - entry.timestamp <= 600);
}
