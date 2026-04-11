/**
 * Newsletter helpers — token generation, branded confirm/unsubscribe email bodies.
 *
 * Subscribers are independent of Cencori user accounts. The flow is:
 *   1. POST /api/newsletter/subscribe        → creates pending row + sends confirm email
 *   2. GET  /api/newsletter/confirm?token=…  → flips status to confirmed
 *   3. GET  /api/newsletter/unsubscribe?token=… → flips status to unsubscribed
 */

import { randomBytes } from 'crypto';
import { minimalTemplate } from '@/lib/email-templates';

export function generateToken(): string {
    return randomBytes(32).toString('hex');
}

export function isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (trimmed.length > 254) return false;
    // Pragmatic email check — not RFC 5322, but rejects obvious junk.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

interface ConfirmEmailParams {
    confirmUrl: string;
    unsubscribeUrl: string;
}

export function renderConfirmEmail({ confirmUrl, unsubscribeUrl }: ConfirmEmailParams): string {
    return minimalTemplate({
        subject: 'Confirm your subscription',
        preheader: 'One click to confirm your subscription to Cencori updates.',
        body: `
            <h1 style="font-size:22px;font-weight:800;margin:0 0 16px;color:#202124;">Confirm your subscription</h1>
            <p>Thanks for signing up for Cencori updates. Click the button below to confirm your email address and start receiving our newsletter.</p>
            <p>You'll get product updates, security research, and occasional notes from the team — never spam, and you can unsubscribe in one click any time.</p>
        `,
        ctaText: 'Confirm subscription',
        ctaUrl: confirmUrl,
        footerText: `If you didn't sign up, you can ignore this email — you won't be added to our list. Or <a href="${unsubscribeUrl}" style="color:#5f6368;text-decoration:underline;">unsubscribe immediately</a>.`,
    });
}

interface WelcomeEmailParams {
    unsubscribeUrl: string;
}

export function renderWelcomeEmail({ unsubscribeUrl }: WelcomeEmailParams): string {
    return minimalTemplate({
        subject: 'Welcome to Cencori',
        preheader: 'You\'re in. Here\'s what to expect.',
        body: `
            <h1 style="font-size:22px;font-weight:800;margin:0 0 16px;color:#202124;">Welcome to Cencori.</h1>
            <p>You're on the list. Thanks for subscribing — you'll now get product updates, security research, and notes from the team building the control plane for production AI.</p>
            <p>A few emails a month. Never filler. Always something we'd actually want to read ourselves.</p>
            <p>If you're shipping AI to real users and want to see what Cencori can do for security, observability, and cost control, head to <a href="https://cencori.com" style="color:#1a73e8;text-decoration:underline;">cencori.com</a> and try it free.</p>
            <p style="margin-top:24px;color:#5f6368;font-size:13px;">— The Cencori team</p>
        `,
        ctaText: 'Explore Cencori',
        ctaUrl: 'https://cencori.com',
        footerText: `You're receiving this because you just subscribed at cencori.com. <a href="${unsubscribeUrl}" style="color:#5f6368;text-decoration:underline;">Unsubscribe</a> any time.`,
    });
}

export function buildConfirmUrl(baseUrl: string, token: string): string {
    return `${baseUrl}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
}

export function buildUnsubscribeUrl(baseUrl: string, token: string): string {
    return `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function getBaseUrl(): string {
    const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
    if (explicit) return explicit;
    const vercel = process.env.VERCEL_URL;
    if (vercel) return `https://${vercel}`;
    return 'https://cencori.com';
}
