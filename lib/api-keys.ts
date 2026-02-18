/**
 * API Key Utilities
 * Handles generation, hashing, validation, and masking of API keys
 */

import { createHash, randomBytes } from "crypto";

const API_KEY_PREFIX = "cen_";
const API_KEY_LENGTH = 32;

/**
 * Generates a secure random API key
 * Format: cen_<32 random characters>
 */
export function generateApiKey(prefix: string = API_KEY_PREFIX): string {
    // Generate random bytes and convert to base58 (no confusing characters)
    const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let result = "";

    for (let i = 0; i < API_KEY_LENGTH; i++) {
        const randomIndex = randomBytes(1)[0] % base58Chars.length;
        result += base58Chars[randomIndex];
    }

    return `${prefix}${result}`;
}

/**
 * Extracts the prefix from an API key for indexing
 * Returns first 8 characters (e.g., "cen_abcd")
 */
export function extractKeyPrefix(apiKey: string): string {
    return apiKey.substring(0, 8);
}

/**
 * Hashes an API key using SHA-256 for storage
 * Note: For production, consider using bcrypt, but SHA-256 is simpler for initial implementation
 */
export function hashApiKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Validates API key format
 */
export function validateApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== "string") {
        return false;
    }

    // Check if it starts with correct prefix
    if (!apiKey.startsWith(API_KEY_PREFIX)) {
        return false;
    }

    // Check total length
    if (apiKey.length !== API_KEY_PREFIX.length + API_KEY_LENGTH) {
        return false;
    }

    // Check if it only contains base58 characters after prefix
    const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const keyBody = apiKey.substring(API_KEY_PREFIX.length);

    for (const char of keyBody) {
        if (!base58Chars.includes(char)) {
            return false;
        }
    }

    return true;
}

/**
 * Masks an API key for display
 * Shows: cen_••••••••••••••1234
 */
export function maskApiKey(keyPrefix: string, lastFour?: string): string {
    const maskedMiddle = "••••••••••••••";

    if (lastFour) {
        return `${keyPrefix}${maskedMiddle}${lastFour}`;
    }

    // If only prefix provided, just mask the rest
    return `${keyPrefix}${maskedMiddle}`;
}

/**
 * Gets the last 4 characters of a key for display
 */
export function getKeyLastFour(apiKey: string): string {
    return apiKey.slice(-4);
}

/**
 * Verifies if a provided key matches the stored hash
 */
export function verifyApiKey(providedKey: string, storedHash: string): boolean {
    const providedHash = hashApiKey(providedKey);
    return providedHash === storedHash;
}
