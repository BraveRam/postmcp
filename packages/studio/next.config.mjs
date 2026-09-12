import { createMDX } from 'fumadocs-mdx/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@postmcp/core'],
  transpilePackages: ['@postmcp/presets', '@postmcp/types'],
  productionBrowserSourceMaps: false,
};

const withMDX = createMDX();

export default withMDX(nextConfig);
