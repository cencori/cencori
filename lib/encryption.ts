/**
 * Encryption Utilities for Custom Provider API Keys
 * 
 * Simple encryption/decryption for storing custom provider API keys
 * Uses AES-256-GCM encryption with organization-specific keys
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Generate encryption key from organization ID
 * This creates a deterministic key for each organization
 */
function generateKey(organizationId: string): Buffer {
    const baseKey = process.env.ENCRYPTION_SECRET || 'default-secret-change-in-production';
    const combined = `${baseKey}:${organizationId}`;
    return Buffer.from(createHash('sha256').update(combined).digest('hex').slice(0, 32));
}

/**
 * Encrypt an API key
 */
export function encryptApiKey(apiKey: string, organizationId: string): string {
    try {
        const key = generateKey(organizationId);
        const iv = randomBytes(IV_LENGTH);

        const cipher = createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(apiKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Format: IV:AuthTag:EncryptedData
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
        console.error('[Encryption] Failed to encrypt API key:', error);
        throw new Error('Encryption failed');
    }
}

/**
 * Decrypt an API key
 */
export function decryptApiKey(encryptedApiKey: string, organizationId: string): string {
    try {
        const parts = encryptedApiKey.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted format');
        }

        const [ivHex, authTagHex, encryptedHex] = parts;

        const key = generateKey(organizationId);
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('[Encryption] Failed to decrypt API key:', error);
        throw new Error('Decryption failed');
    }
}

/**
 * Validate that an encrypted string can be decrypted
 */
export function validateEncryption(encryptedApiKey: string, organizationId: string): boolean {
    try {
        decryptApiKey(encryptedApiKey, organizationId);
        return true;
    } catch {
        return false;
    }
}
