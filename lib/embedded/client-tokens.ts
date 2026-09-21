import crypto from 'crypto';
import type { ClientTokenClaims } from './types';
import { CLIENT_TOKEN_PREFIX } from './types';
import { dePrefixId } from './http';

function base64url(input: Buffer | string): string {
    return Buffer.from(input).toString('base64url');
}

function tokenSecret(): string {
    const secret = process.env.EMBEDDED_CLIENT_TOKEN_SECRET || process.env.ENCRYPTION_SECRET;
    if (secret) return secret;
    // Fail closed in production: a hardcoded fallback would let anyone forge
    // scoped tokens. Dev/test may use the insecure default explicitly.
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Client token signing secret is not configured (EMBEDDED_CLIENT_TOKEN_SECRET)');
    }
    return 'dev-embedded-client-token-secret-insecure';
}

export interface MintClientTokenInput {
    projectId: string;
    environment: string;
    tenantId: string;
    externalUserId: string;
    installationIds?: string[];
    permissions: string[];
    sessionId?: string;
    expiresInSeconds?: number;
}

export function mintClientToken(input: MintClientTokenInput): { token: string; expiresAt: string } {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + Math.min(input.expiresInSeconds ?? 900, 900);
    const claims: ClientTokenClaims = {
        project_id: input.projectId,
        env: input.environment,
        tenant_id: input.tenantId,
        external_user_id: input.externalUserId,
        // Normalize to raw UUIDs: public IDs are exposed as ins_<uuid> but
        // claims, comparisons, and UUID columns all use the raw form.
        installation_ids: input.installationIds?.map(dePrefixId),
        permissions: input.permissions,
        session_id: input.sessionId,
        exp,
        iat: now,
        aud: 'cencori-api',
    };
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify(claims));
    const sig = crypto.createHmac('sha256', tokenSecret()).update(`${header}.${payload}`).digest('base64url');
    return { token: `${CLIENT_TOKEN_PREFIX}${header}.${payload}.${sig}`, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifyClientToken(token: string): { ok: true; claims: ClientTokenClaims } | { ok: false; code: string; message: string } {
    if (!token.startsWith(CLIENT_TOKEN_PREFIX)) {
        return { ok: false, code: 'client_token_expired', message: 'Not a client token' };
    }
    const compact = token.slice(CLIENT_TOKEN_PREFIX.length);
    const [header, payload, sig] = compact.split('.');
    if (!header || !payload || !sig) {
        return { ok: false, code: 'client_token_expired', message: 'Malformed client token' };
    }
    const expected = crypto.createHmac('sha256', tokenSecret()).update(`${header}.${payload}`).digest('base64url');
    // timingSafeEqual throws on length mismatch — reject malformed signatures
    // as invalid (401) instead of crashing the route with a RangeError.
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return { ok: false, code: 'client_token_revoked', message: 'Invalid client token signature' };
    }
    let claims: ClientTokenClaims;
    try {
        claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        return { ok: false, code: 'client_token_expired', message: 'Unparseable client token' };
    }
    if (claims.aud !== 'cencori-api') {
        return { ok: false, code: 'client_token_revoked', message: 'Invalid token audience' };
    }
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
        return { ok: false, code: 'client_token_expired', message: 'Client token expired' };
    }
    if (!claims.project_id || !claims.tenant_id || !claims.external_user_id) {
        return { ok: false, code: 'client_token_revoked', message: 'Client token missing scope' };
    }
    return { ok: true, claims };
}
