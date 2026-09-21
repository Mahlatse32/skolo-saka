export type AnalyticsProperties = Record<string, string | number | boolean | null>;

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const EVENT_NAME = /^[a-z][a-z0-9_]{1,63}$/;
const ALLOWED_VIEWS = new Set(['home', 'schools', 'projects', 'profile']);

export function sanitiseAnalyticsPath(input: string) {
  try {
    const url = new URL(input, 'https://www.skolosaka.co.za');
    const pathname = url.pathname.split('/').map(segment => UUID_SEGMENT.test(segment) || NUMERIC_SEGMENT.test(segment) ? ':id' : segment).join('/').slice(0, 220) || '/';
    const view = url.searchParams.get('view');
    return view && ALLOWED_VIEWS.has(view) ? `${pathname}?view=${view}` : pathname;
  } catch { return '/'; }
}

export function isAnalyticsEventName(value: unknown): value is string {
  return typeof value === 'string' && EVENT_NAME.test(value);
}

export function cleanAnalyticsProperties(value: unknown): AnalyticsProperties {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => EVENT_NAME.test(key) && (['string', 'number', 'boolean'].includes(typeof item) || item === null))
    .slice(0, 12)
    .map(([key, item]) => [key, typeof item === 'string' ? item.slice(0, 80) : item as number | boolean | null]));
}

export function deviceType(userAgent: string) {
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile';
  return userAgent ? 'desktop' : 'unknown';
}
