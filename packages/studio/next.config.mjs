/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@postmcp/core', '@postmcp/presets', '@postmcp/types'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
