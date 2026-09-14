import type { NextConfig } from 'next';
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
