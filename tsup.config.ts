import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin/copilot-otel.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist/bin',
  clean: true,
  sourcemap: true,
  shims: true,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
