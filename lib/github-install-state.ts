import { createHmac, timingSafeEqual } from "crypto";

const STATE_MAX_AGE_MS = 30 * 60 * 1000;
const STATE_SECRET =
    process.env.GITHUB_APP_STATE_SECRET ||
    process.env.GITHUB_APP_CLIENT_SECRET ||
    null;

export interface GithubInstallStatePayload {
    source?: string;
    redirect?: string;
    orgSlug?: string;
    accountType?: string;
    accountLogin?: string;
    userId?: string;
    issuedAt?: number;
}

interface ParsedGithubInstallState {
    payload: GithubInstallStatePayload;
    signatureValid: boolean;
}

function normalizeString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePayload(value: unknown): GithubInstallStatePayload {
    if (!value || typeof value !== "object") {
        return {};
    }

    const record = value as Record<string, unknown>;
    const issuedAt =
        typeof record.issuedAt === "number" && Number.isFinite(record.issuedAt)
            ? record.issuedAt
            : undefined;

    return {
        source: normalizeString(record.source),
        redirect: normalizeString(record.redirect),
        orgSlug: normalizeString(record.orgSlug),
        accountType: normalizeString(record.accountType),
        accountLogin: normalizeString(record.accountLogin),
        userId: normalizeString(record.userId),
        issuedAt,
    };
}

function payloadMessage(payload: GithubInstallStatePayload): string {
    return [
        payload.source || "",
        payload.redirect || "",
        payload.orgSlug || "",
        payload.accountType || "",
        payload.accountLogin || "",
        payload.userId || "",
        String(payload.issuedAt || 0),
    ].join("|");
}

function computeSignature(payload: GithubInstallStatePayload): string | null {
    if (!STATE_SECRET) {
        return null;
    }

    return createHmac("sha256", STATE_SECRET)
        .update(payloadMessage(payload))
        .digest("hex");
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

export function createGithubInstallState(
    payload: Omit<GithubInstallStatePayload, "issuedAt">
): string {
    const normalizedPayload: GithubInstallStatePayload = {
        ...normalizePayload(payload),
        issuedAt: Date.now(),
    };

    const signature = computeSignature(normalizedPayload);

    return JSON.stringify({
        ...normalizedPayload,
        ...(signature ? { sig: signature } : {}),
    });
}

export function parseGithubInstallState(rawState: string | null): ParsedGithubInstallState {
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

    if (!parsed || typeof parsed !== "object") {
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
