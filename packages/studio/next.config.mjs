import { createMDX } from 'fumadocs-mdx/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@postmcp/core', '@postmcp/presets', '@postmcp/types'],
};

const withMDX = createMDX();

export default withMDX(nextConfig);
