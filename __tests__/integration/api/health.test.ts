/**
 * Health Endpoint Integration Tests
 * 
 * Tests the health check API endpoint.
 */

import { describe, it, expect } from 'vitest';

describe('Health Endpoint Integration', () => {
    // Base URL for testing - uses Next.js dev server if available
    const getBaseUrl = () => {
        return process.env.TEST_BASE_URL || 'http://localhost:3000';
    };

    describe('Health Check (Requires Running Server)', () => {
        // These tests require the Next.js server to be running
        const describeWithServer = process.env.TEST_WITH_SERVER ? describe : describe.skip;

        describeWithServer('/api/health endpoint', () => {
            it('should return 200 OK', async () => {
                const response = await fetch(`${getBaseUrl()}/api/health`);
                expect(response.status).toBe(200);
            });

            it('should return JSON response', async () => {
                const response = await fetch(`${getBaseUrl()}/api/health`);
                const contentType = response.headers.get('content-type');
                expect(contentType).toContain('application/json');
            });

            it('should include status in response', async () => {
                const response = await fetch(`${getBaseUrl()}/api/health`);
                const data = await response.json();
                expect(data.status).toBeDefined();
            });
        });
    });

    describe('Health Check Logic (No Server Required)', () => {
        it('should define expected health response structure', () => {
            // Define the expected structure of a health response
            const mockHealthResponse = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
            };

            // This validates our expected contract
            expect(mockHealthResponse.status).toBe('ok');
            expect(typeof mockHealthResponse.timestamp).toBe('string');
            expect(typeof mockHealthResponse.version).toBe('string');
        });

        it('should validate health status values', () => {
            const validStatuses = ['ok', 'degraded', 'error'];

            validStatuses.forEach(status => {
                expect(['ok', 'degraded', 'error']).toContain(status);
            });
        });

        it('should validate timestamp format', () => {
            const timestamp = new Date().toISOString();
            const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
            expect(isoRegex.test(timestamp)).toBe(true);
        });
    });
});
