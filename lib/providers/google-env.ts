const GOOGLE_API_KEY_ENV_ORDER = [
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'GOOGLE_AI_API_KEY',
    'GEMINI_API_KEY',
] as const;

export function getGoogleApiKey(): string | null {
    for (const envKey of GOOGLE_API_KEY_ENV_ORDER) {
        const value = process.env[envKey];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }
    return null;
}

export function getGoogleApiKeySource(): string | null {
    for (const envKey of GOOGLE_API_KEY_ENV_ORDER) {
        const value = process.env[envKey];
        if (typeof value === 'string' && value.trim().length > 0) {
            return envKey;
        }
    }
    return null;
}

