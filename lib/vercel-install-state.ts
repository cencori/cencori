import { createHmac, timingSafeEqual } from 'crypto';

const STATE_MAX_AGE_MS = 30 * 60 * 1000;
const STATE_SECRET =
    process.env.VERCEL_INTEGRATION_STATE_SECRET ||
    process.env.ENCRYPTION_SECRET ||
    process.env.GITHUB_APP_CLIENT_SECRET ||
    null;

export function hasVercelInstallStateSecret(): boolean {
    return !!STATE_SECRET;
}

export interface VercelInstallStatePayload {
    source?: 'dashboard';
    projectId?: string;
    orgSlug?: string;
    projectSlug?: string;
    redirect?: string;
    userId?: string;
    issuedAt?: number;
}

interface ParsedVercelInstallState {
    payload: VercelInstallStatePayload;
    signatureValid: boolean;
}

function normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePayload(value: unknown): VercelInstallStatePayload {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const record = value as Record<string, unknown>;
    const issuedAt =
        typeof record.issuedAt === 'number' && Number.isFinite(record.issuedAt)
            ? record.issuedAt
            : undefined;

    return {
        source: record.source === 'dashboard' ? 'dashboard' : undefined,
        projectId: normalizeString(record.projectId),
        orgSlug: normalizeString(record.orgSlug),
        projectSlug: normalizeString(record.projectSlug),
        redirect: normalizeString(record.redirect),
        userId: normalizeString(record.userId),
        issuedAt,
    };
}

function payloadMessage(payload: VercelInstallStatePayload): string {
    return [
        payload.source || '',
        payload.projectId || '',
        payload.orgSlug || '',
        payload.projectSlug || '',
        payload.redirect || '',
        payload.userId || '',
        String(payload.issuedAt || 0),
    ].join('|');
}

function computeSignature(payload: VercelInstallStatePayload): string | null {
    if (!STATE_SECRET) {
        return null;
    }

    return createHmac('sha256', STATE_SECRET)
        .update(payloadMessage(payload))
        .digest('hex');
}

function isValidSignature(actual: string, expected: string): boolean {
    try {
        const actualBuffer = Buffer.from(actual);
        const expectedBuffer = Buffer.from(expected);

        if (actualBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return timingSafeEqual(actualBuffer, expectedBuffer);
    } catch {
        return false;
    }
}

export function createVercelInstallState(
    payload: Omit<VercelInstallStatePayload, 'issuedAt'>
): string {
    const normalizedPayload: VercelInstallStatePayload = {
        ...normalizePayload(payload),
        issuedAt: Date.now(),
    };

    const signature = computeSignature(normalizedPayload);

    return JSON.stringify({
        ...normalizedPayload,
        ...(signature ? { sig: signature } : {}),
    });
}

export function parseVercelInstallState(rawState: string | null): ParsedVercelInstallState {
    if (!rawState) {
        return { payload: {}, signatureValid: false };
    }

    let parsed: unknown = {};

    try {
        parsed = JSON.parse(decodeURIComponent(rawState));
    } catch {
        return { payload: {}, signatureValid: false };
    }

    const payload = normalizePayload(parsed);
    if (!parsed || typeof parsed !== 'object') {
        return { payload, signatureValid: false };
    }

    const signature = normalizeString((parsed as Record<string, unknown>).sig);
    if (!signature) {
        return { payload, signatureValid: false };
    }

    const expectedSignature = computeSignature(payload);
    if (!expectedSignature || !isValidSignature(signature, expectedSignature)) {
        return { payload, signatureValid: false };
    }

    if (!payload.issuedAt) {
        return { payload, signatureValid: false };
    }

    const age = Date.now() - payload.issuedAt;
    if (age < -60_000 || age > STATE_MAX_AGE_MS) {
        return { payload, signatureValid: false };
    }

    return { payload, signatureValid: true };
}
