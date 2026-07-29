
import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    target: 'es2022',
    platform: 'node',
    outDir: 'dist',
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    shims: true,
    banner: {
        js: '#!/usr/bin/env node',
    },
});
