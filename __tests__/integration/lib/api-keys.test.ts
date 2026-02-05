/**
 * API Keys Utility Integration Tests
 * 
 * Tests the API key utility functions from lib/api-keys.ts
 */

import { describe, it, expect } from 'vitest';
import {
    generateApiKey,
    extractKeyPrefix,
    hashApiKey,
    validateApiKey,
    maskApiKey,
    getKeyLastFour,
    verifyApiKey,
} from '@/lib/api-keys';

describe('API Key Utilities', () => {
    describe('generateApiKey', () => {
        it('should generate a key with correct prefix', () => {
            const key = generateApiKey();
            expect(key.startsWith('cen_')).toBe(true);
        });

        it('should generate a key with correct length', () => {
            const key = generateApiKey();
            // cen_ (4) + 32 characters = 36 total
            expect(key.length).toBe(36);
        });

        it('should generate unique keys', () => {
            const keys = new Set<string>();
            for (let i = 0; i < 100; i++) {
                keys.add(generateApiKey());
            }
            expect(keys.size).toBe(100);
        });

        it('should only contain base58 characters after prefix', () => {
            const key = generateApiKey();
            const keyBody = key.substring(4); // Remove 'cen_' prefix
            const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
            expect(base58Regex.test(keyBody)).toBe(true);
        });
    });

    describe('extractKeyPrefix', () => {
        it('should extract first 8 characters', () => {
            const key = 'cen_abcd1234567890';
            expect(extractKeyPrefix(key)).toBe('cen_abcd');
        });

        it('should work with generated keys', () => {
            const key = generateApiKey();
            const prefix = extractKeyPrefix(key);
            expect(prefix.length).toBe(8);
            expect(prefix.startsWith('cen_')).toBe(true);
        });
    });

    describe('hashApiKey', () => {
        it('should return a SHA-256 hash (64 hex characters)', () => {
            const key = generateApiKey();
            const hash = hashApiKey(key);
            expect(hash.length).toBe(64);
            expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
        });

        it('should produce consistent hashes for same input', () => {
            const key = generateApiKey();
            const hash1 = hashApiKey(key);
            const hash2 = hashApiKey(key);
            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different inputs', () => {
            const key1 = generateApiKey();
            const key2 = generateApiKey();
            expect(hashApiKey(key1)).not.toBe(hashApiKey(key2));
        });
    });

    describe('validateApiKey', () => {
        it('should validate correctly formatted keys', () => {
            const key = generateApiKey();
            expect(validateApiKey(key)).toBe(true);
        });

        it('should reject keys without correct prefix', () => {
            expect(validateApiKey('abc_1234567890123456789012345678901234')).toBe(false);
        });

        it('should reject keys that are too short', () => {
            expect(validateApiKey('cen_short')).toBe(false);
        });

        it('should reject keys that are too long', () => {
            expect(validateApiKey('cen_' + 'a'.repeat(100))).toBe(false);
        });

        it('should reject empty strings', () => {
            expect(validateApiKey('')).toBe(false);
        });

        it('should reject null/undefined', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(validateApiKey(null as any)).toBe(false);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(validateApiKey(undefined as any)).toBe(false);
        });

        it('should reject keys with invalid characters', () => {
            // '0', 'O', 'I', 'l' are not in base58
            expect(validateApiKey('cen_0OIl' + 'a'.repeat(28))).toBe(false);
        });
    });

    describe('maskApiKey', () => {
        it('should mask key with prefix only', () => {
            const masked = maskApiKey('cen_abcd');
            expect(masked).toBe('cen_abcd••••••••••••••');
        });

        it('should mask key with prefix and last four', () => {
            const masked = maskApiKey('cen_abcd', '1234');
            expect(masked).toBe('cen_abcd••••••••••••••1234');
        });
    });

    describe('getKeyLastFour', () => {
        it('should return last 4 characters', () => {
            const key = generateApiKey();
            const lastFour = getKeyLastFour(key);
            expect(lastFour.length).toBe(4);
            expect(key.endsWith(lastFour)).toBe(true);
        });
    });

    describe('verifyApiKey', () => {
        it('should verify matching key and hash', () => {
            const key = generateApiKey();
            const hash = hashApiKey(key);
            expect(verifyApiKey(key, hash)).toBe(true);
        });

        it('should reject non-matching key and hash', () => {
            const key1 = generateApiKey();
            const key2 = generateApiKey();
            const hash = hashApiKey(key1);
            expect(verifyApiKey(key2, hash)).toBe(false);
        });

        it('should reject modified keys', () => {
            const key = generateApiKey();
            const hash = hashApiKey(key);
            const modifiedKey = key.slice(0, -1) + 'X';
            expect(verifyApiKey(modifiedKey, hash)).toBe(false);
        });
    });
});
