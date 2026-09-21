'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { AnalyticsProperties } from '@/lib/analytics';
import { sanitiseAnalyticsPath } from '@/lib/analytics';

const VISITOR_KEY = 'skolo_analytics_visitor';
const SESSION_KEY = 'skolo_analytics_session';
const SESSION_STARTED_KEY = 'skolo_analytics_session_started';
const SESSION_LENGTH_MS = 30 * 60 * 1000;

function identifier(storage: Storage, key: string) {
  let value = storage.getItem(key);
  if (!value) { value = crypto.randomUUID(); storage.setItem(key, value); }
  return value;
}

function analyticsIdentity() {
  const now = Date.now();
  const last = Number(sessionStorage.getItem(SESSION_STARTED_KEY) || 0);
  if (!last || now - last > SESSION_LENGTH_MS) sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.setItem(SESSION_STARTED_KEY, String(now));
  return { visitorId: identifier(localStorage, VISITOR_KEY), sessionId: identifier(sessionStorage, SESSION_KEY) };
}

export async function trackEvent(eventName: string, properties: AnalyticsProperties = {}, pagePath?: string) {
  if (typeof window === 'undefined' || navigator.doNotTrack === '1') return;
  const { visitorId, sessionId } = analyticsIdentity();
  const { data: { session } } = await supabase.auth.getSession();
  void fetch('/api/analytics/events', {
    method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify({ eventName, visitorId, sessionId, pagePath: pagePath || `${window.location.pathname}${window.location.search}`, properties }),
  }).catch(() => undefined);
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const query = searchParams.toString();
    void trackEvent('page_view', {}, sanitiseAnalyticsPath(`${pathname}${query ? `?${query}` : ''}`));
  }, [pathname, searchParams]);
  useEffect(() => {
    const capture = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-analytics]');
      const name = element?.dataset.analytics;
      if (name) void trackEvent(name);
    };
    document.addEventListener('click', capture, true);
    return () => document.removeEventListener('click', capture, true);
  }, []);
  return null;
}
