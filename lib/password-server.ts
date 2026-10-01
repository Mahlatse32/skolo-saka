import type { User } from '@supabase/supabase-js';
import { serverSupabase } from './paystack-server';
import { hasPasswordCredential, passwordError } from './password-auth';

export async function confirmAccountPassword(user: User, password: unknown) {
  if (!hasPasswordCredential(user) || passwordError(password)) return false;
  const verifier = serverSupabase();
  try {
    const credentials = user.phone ? { phone: user.phone, password: password as string }
      : user.email && user.email_confirmed_at ? { email: user.email, password: password as string } : null;
    if (!credentials) return false;
    const { data, error } = await verifier.auth.signInWithPassword(credentials);
    if (error || !data.session) return false;
    const valid = data.user?.id === user.id && hasPasswordCredential(data.user);
    const { error: signOutError } = await verifier.auth.signOut({ scope: 'local' });
    return valid && !signOutError;
  } catch { return false; }
}
