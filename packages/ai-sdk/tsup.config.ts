import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        'index': 'src/index.ts',
        'vercel/index': 'src/vercel/index.ts',
        'tanstack/index': 'src/tanstack/index.ts',
        'ai/index': 'src/ai/index.ts',
        'compute/index': 'src/compute/index.ts',
        'workflow/index': 'src/workflow/index.ts',
        'storage/index': 'src/storage/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
});
