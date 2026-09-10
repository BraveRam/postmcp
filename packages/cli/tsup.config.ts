import { defineConfig } from 'tsup';
import packageJson from './package.json';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  define: {
    __POSTMCP_VERSION__: JSON.stringify(packageJson.version),
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
});
