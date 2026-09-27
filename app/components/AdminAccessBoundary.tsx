'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function AdminAccessBoundary({ area, children }: { area: 'analytics' | 'sports'; children: ReactNode }) {
  const [access, setAccess] = useState<{ userId?: string; message: string }>({ message: 'Checking administrator access…' });

  useEffect(() => {
    let active = true;
    let version = 0;
    let controller: AbortController | undefined;
    async function check(clear = false) {
      const current = ++version;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      if (clear) setAccess({ message: 'Checking administrator access…' });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active || current !== version) return;
        if (!session) { setAccess({ message: 'Sign in with your approved administrator account to continue.' }); return; }
        const response = await fetch(`/api/admin/access?area=${area}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal,
        });
        const body = await response.json();
        if (!active || current !== version) return;
        setAccess(response.ok && body.allowed
          ? { userId: body.userId, message: '' }
          : { message: body.error || 'Administrator access required.' });
      } catch {
        if (active && current === version) setAccess({ message: 'Unable to verify access. Please try again.' });
      }
    }
    void check();
    // Do not await Supabase operations inside its auth-state callback.
    let pending: ReturnType<typeof setTimeout>;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      ++version;
      controller?.abort();
      setAccess({ message: 'Checking administrator access…' });
      clearTimeout(pending);
      pending = setTimeout(() => void check(), 0);
    });
    const onFocus = () => void check(true);
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => void check(), 30_000);
    return () => { active = false; ++version; controller?.abort(); clearTimeout(pending); clearInterval(interval); subscription.unsubscribe(); window.removeEventListener('focus', onFocus); };
  }, [area]);

  if (access.userId) return <div key={access.userId}>{children}</div>;
  return <main style={{ maxWidth: 680, margin: '64px auto', padding: 24 }}>
    <h1>{area === 'analytics' ? 'Analytics' : 'Sports administration'}</h1>
    <p role="status">{access.message}</p>
    <p>Registering an account does not grant administrator permissions.</p>
    <Link href="/">Sign in / return to Skolo Saka</Link>
  </main>;
}
