const DEFAULT_FOUNDER_EMAILS = [
    'omogbolahanng@gmail.com',
    'bola@cencori.com',
];

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function getFounderEmails(): string[] {
    const envValue = process.env.INTERNAL_FOUNDER_EMAILS || '';
    const fromEnv = envValue
        .split(',')
        .map((entry) => normalizeEmail(entry))
        .filter(Boolean);

    return Array.from(new Set([...DEFAULT_FOUNDER_EMAILS, ...fromEnv]));
}

export function isFounderEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    const normalized = normalizeEmail(email);
    return getFounderEmails().includes(normalized);
}

export function allowAllInternalInDev(): boolean {
    const value = (process.env.ALLOW_ALL_INTERNAL_IN_DEV || 'true').trim().toLowerCase();
    return value !== 'false';
}
