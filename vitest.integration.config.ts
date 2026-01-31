import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./__tests__/integration/setup.ts'],
        include: ['__tests__/integration/**/*.test.ts'],
        exclude: ['**/node_modules/**', '.next', 'dist'],
        testTimeout: 30000, // 30 seconds for DB operations
        hookTimeout: 30000,
        // Run tests sequentially to avoid DB conflicts
        fileParallelism: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: './coverage/integration',
            exclude: [
                'node_modules',
                '.next',
                'dist',
                '**/*.d.ts',
                '**/*.config.*',
                '**/types/**',
                '__tests__/**',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
