import crypto from 'crypto';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DEFAULT_CEN_PREFIX = 'cen_';
const DEFAULT_CEN_KEY_BODY_LENGTH = 32;
const MASK_FILL = '••••••••••••••';

const CENCORI_API_KEY_PREFIXES = [
    'cake_',
    'cencori_',
    'cen_',
    'csk_',
    'cpk_',
    'csk_test_',
    'cpk_test_',
];

export function generateApiKey(
    prefix = DEFAULT_CEN_PREFIX,
    bodyLength = DEFAULT_CEN_KEY_BODY_LENGTH
): string {
    const bytes = crypto.randomBytes(bodyLength);
    let keyBody = '';

    for (let i = 0; i < bodyLength; i += 1) {
        keyBody += BASE58_ALPHABET[bytes[i] % BASE58_ALPHABET.length];
    }

    return `${prefix}${keyBody}`;
}

export function extractKeyPrefix(apiKey: string): string {
    return apiKey.slice(0, 8);
}

export function hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export function verifyApiKey(apiKey: string, expectedHash: string): boolean {
    if (!apiKey || !expectedHash) return false;

    const computedHash = hashApiKey(apiKey);
    if (computedHash.length !== expectedHash.length) return false;

    try {
        return crypto.timingSafeEqual(
            Buffer.from(computedHash, 'hex'),
            Buffer.from(expectedHash, 'hex')
        );
    } catch {
        return false;
    }
}

export function validateApiKey(apiKey: unknown): apiKey is string {
    if (typeof apiKey !== 'string') return false;
    if (!apiKey) return false;

    // Legacy base58 format used in tests and older keys.
    if (/^cen_[1-9A-HJ-NP-Za-km-z]{32}$/.test(apiKey)) {
        return true;
    }

    // Current gateway key formats.
    if (/^(?:csk|cpk)(?:_test)?_[a-f0-9]{48}$/i.test(apiKey)) {
        return true;
    }

    if (/^cake_[a-f0-9]{48}$/i.test(apiKey)) {
        return true;
    }

    if (/^cencori_[A-Za-z0-9._-]{16,}$/.test(apiKey)) {
        return true;
    }

    return false;
}

export function maskApiKey(prefix: string, lastFour?: string): string {
    return `${prefix}${MASK_FILL}${lastFour ?? ''}`;
}

export function getKeyLastFour(apiKey: string): string {
    return apiKey.slice(-4);
}

export function extractBearerToken(authHeader: string | null): string | null {
    if (!authHeader) return null;

    const [scheme, ...rest] = authHeader.trim().split(/\s+/);
    if (!scheme || !/^bearer$/i.test(scheme) || rest.length === 0) return null;

    const token = rest.join(' ').trim();
    return token || null;
}

export function isCencoriApiKey(token: string | null): token is string {
    if (!token) return false;
    return CENCORI_API_KEY_PREFIXES.some((prefix) => token.startsWith(prefix));
}

export function extractCencoriApiKeyFromHeaders(headers: Pick<Headers, 'get'>): string | null {
    const directKey = headers.get('CENCORI_API_KEY')?.trim();
    if (directKey) return directKey;

    const bearerToken = extractBearerToken(headers.get('Authorization'));
    return isCencoriApiKey(bearerToken) ? bearerToken : null;
}
