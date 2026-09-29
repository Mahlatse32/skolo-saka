export const TEST_SUPABASE_URL = 'https://faytrobauwibxujvmbct.supabase.co';
export const UAT_ORIGIN = 'https://skolo-saka-uat.vercel.app';

export function isUat() {
  return process.env.VERCEL_PROJECT_ID === 'prj_EIjAps6uY5VAfnbkb2IlTulDJks6' ||
    process.env.VERCEL_GIT_COMMIT_REF === 'uat' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === TEST_SUPABASE_URL;
}

export function applicationOrigin() {
  const configured = process.env.NEXT_APP_URL;
  if (!configured) throw new Error('NEXT_APP_URL is not configured');
  const url = new URL(configured);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('NEXT_APP_URL must be an origin without credentials, path or query');
  }
  if (isUat() && url.origin !== UAT_ORIGIN) throw new Error('UAT callbacks must stay on the UAT domain');
  if (url.protocol !== 'https:' && !(url.hostname === 'localhost' && process.env.NODE_ENV !== 'production')) {
    throw new Error('NEXT_APP_URL must use HTTPS');
  }
  return url.origin;
}

export function checkedPaystackSecret(key: string | undefined) {
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured');
  if (isUat() && !key.startsWith('sk_test_')) throw new Error('UAT requires a Paystack test key; live payments are disabled');
  return key;
}
