const PROD_DATABASE = 'https://nnexzxszqjedaqqukfiq.supabase.co';
const TEST_DATABASE = 'https://faytrobauwibxujvmbct.supabase.co';
const PROD_PROJECT = 'prj_P0ZKFWbWTgqGkdaTy5Lvyw31ikwp';
const UAT_PROJECT = 'prj_EIjAps6uY5VAfnbkb2IlTulDJks6';
const PROD_ORIGIN = 'https://www.skolosaka.co.za';
const UAT_ORIGIN = 'https://skolo-saka-uat.vercel.app';

export function paymentConfiguration() {
  const env = process.env;
  const database = env.NEXT_PUBLIC_SUPABASE_URL;
  const production = database === PROD_DATABASE || env.VERCEL_PROJECT_ID === PROD_PROJECT;
  const key = env.PAYSTACK_SECRET_KEY || '';
  const unavailable = () => new Error('Payments are not available yet. Please try again later.');
  if (production) {
    // A preview, UAT branch, or wrong database must never collect real money.
    if (database !== PROD_DATABASE || env.VERCEL_ENV === 'preview' ||
        env.VERCEL_PROJECT_ID === UAT_PROJECT || env.VERCEL_GIT_COMMIT_REF === 'uat' ||
        !key.startsWith('sk_live_')) throw unavailable();
    if (env.NEXT_APP_URL && env.NEXT_APP_URL !== PROD_ORIGIN) throw unavailable();
    return { key, mode: 'live' as const, origin: PROD_ORIGIN };
  }
  if (database !== TEST_DATABASE || !key.startsWith('sk_test_')) throw unavailable();
  if (env.NEXT_APP_URL && env.NEXT_APP_URL !== UAT_ORIGIN) throw unavailable();
  return { key, mode: 'test' as const, origin: UAT_ORIGIN };
}

export function paymentMode(): 'live' | 'test' | 'unavailable' {
  try { return paymentConfiguration().mode; } catch { return 'unavailable'; }
}
