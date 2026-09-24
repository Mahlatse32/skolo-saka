import type { NextConfig } from 'next';

// Vercel currently shares the production Supabase URL with Preview. Refuse to
// build previews against that project until Preview is explicitly isolated.
if (
  process.env.VERCEL_ENV === 'preview' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('nnexzxszqjedaqqukfiq.supabase.co')
) {
  throw new Error('Preview must use the isolated Skolo Saka test Supabase project');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
