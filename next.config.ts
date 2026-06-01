import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // bcrypt/pg/pdfmake use native/Node APIs — keep on server bundle
  serverExternalPackages: ['bcrypt', 'pg', 'pdfmake'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
    ],
  },
};

export default nextConfig;
