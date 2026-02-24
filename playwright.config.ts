import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    use: {
        baseURL: process.env.TEST_BASE_URL || process.env.DEV_BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // Start local dev server before running tests
    webServer: process.env.CI ? undefined : {
        command: 'npm run dev',
        url: process.env.DEV_BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});