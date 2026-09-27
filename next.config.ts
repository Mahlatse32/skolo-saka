import type { NextConfig } from 'next';

// The dedicated UAT project has its own explicit public configuration. Never
// fall back to inherited credentials if that project is misconfigured.
const dedicatedUat = process.env.VERCEL_PROJECT_ID === 'prj_EIjAps6uY5VAfnbkb2IlTulDJks6';
const uatUrl = process.env.NEXT_PUBLIC_UAT_SUPABASE_URL;
const uatKey = process.env.NEXT_PUBLIC_UAT_SUPABASE_PUBLISHABLE_KEY;
if (dedicatedUat && (!uatUrl || !uatKey)) throw new Error('Dedicated UAT Supabase configuration is required');
const url = uatUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = uatKey || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const isUat = dedicatedUat || process.env.VERCEL_GIT_COMMIT_REF === 'uat' || !!uatUrl;
if (isUat && url !== 'https://faytrobauwibxujvmbct.supabase.co') {
  throw new Error('UAT must use the isolated Skolo Saka test Supabase project');
}
if (process.env.VERCEL_ENV === 'preview' && url?.includes('nnexzxszqjedaqqukfiq.supabase.co')) {
  throw new Error('Preview must use the isolated Skolo Saka test Supabase project');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Only these browser-safe values are embedded; server secrets never go here.
  env: {
    ...(url ? { NEXT_PUBLIC_SUPABASE_URL: url } : {}),
    ...(key ? { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } : {}),
  },
  async redirects() {
    return [{
      source: '/:path*',
      has: [{ type: 'host', value: 'skolo-saka-arnx.vercel.app' }],
      destination: 'https://www.skolosaka.co.za/:path*',
      permanent: true,
    }];
  },
};
export default nextConfig;
