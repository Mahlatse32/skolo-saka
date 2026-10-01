import { supabase } from './supabase';

export async function saveAccountPassword(password: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Verify your phone or use a new recovery link first.');
  const response = await fetch('/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ password }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not save your password.');
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.user) throw new Error('Password saved. Return to sign in with your new password.');
  return data.user;
}
