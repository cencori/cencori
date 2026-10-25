import { describe, expect, it } from 'vitest';
import {
    WIDGET_MAX_TURNS,
    checkWidgetTurn,
    generateWidgetKey,
    isWidgetKey,
    mintWidgetPreviewToken,
    normalizeWidgetOrigin,
    originAllowed,
    sanitizeAppearance,
    verifyWidgetPreviewToken,
} from '@/lib/embedded/widget';

describe('normalizeWidgetOrigin', () => {
    it('turns what people type into an origin', () => {
        expect(normalizeWidgetOrigin('example.com')).toBe('https://example.com');
        expect(normalizeWidgetOrigin('https://Example.com/pricing?x=1')).toBe('https://example.com');
        expect(normalizeWidgetOrigin('*.example.com')).toBe('https://*.example.com');
        expect(normalizeWidgetOrigin('https://*.example.co.uk')).toBe('https://*.example.co.uk');
        expect(normalizeWidgetOrigin('localhost:5173')).toBe('http://localhost:5173');
        expect(normalizeWidgetOrigin('https://shop.example.com:8443')).toBe('https://shop.example.com:8443');
    });

    it('rejects things that are not a site', () => {
        expect(normalizeWidgetOrigin('')).toBeNull();
        expect(normalizeWidgetOrigin('not a site')).toBeNull();
        expect(normalizeWidgetOrigin('http://example.com')).toBeNull();
        expect(normalizeWidgetOrigin('*.com')).toBeNull();
        expect(normalizeWidgetOrigin('*')).toBeNull();
        expect(normalizeWidgetOrigin('javascript:alert(1)')).toBeNull();
    });
});

describe('originAllowed', () => {
    const allowed = ['https://example.com', 'https://*.shop.io', 'http://localhost:*'];

    it('matches exact origins, subdomain wildcards and any localhost port', () => {
        expect(originAllowed('https://example.com', allowed)).toBe(true);
        expect(originAllowed('https://eu.shop.io', allowed)).toBe(true);
        expect(originAllowed('https://a.b.shop.io', allowed)).toBe(true);
        expect(originAllowed('http://localhost:3000', allowed)).toBe(true);
    });

    it('refuses everything else', () => {
        expect(originAllowed('https://www.example.com', allowed)).toBe(false);
        expect(originAllowed('https://shop.io', allowed)).toBe(false);
        expect(originAllowed('https://evilshop.io', allowed)).toBe(false);
        expect(originAllowed('http://example.com', allowed)).toBe(false);
        expect(originAllowed('https://example.com:8443', allowed)).toBe(false);
        expect(originAllowed(null, allowed)).toBe(false);
        expect(originAllowed('garbage', allowed)).toBe(false);
        expect(originAllowed('https://example.com', [])).toBe(false);
    });
});

describe('preview tokens', () => {
    it('verify only for the widget they were minted for', () => {
        const token = mintWidgetPreviewToken('w1');
        expect(verifyWidgetPreviewToken(token, 'w1')).toBe(true);
        expect(verifyWidgetPreviewToken(token, 'w2')).toBe(false);
    });

    it('reject tampering and junk', () => {
        const [id, exp, sig] = mintWidgetPreviewToken('w1').split('.');
        expect(verifyWidgetPreviewToken(`${id}.${Number(exp) + 9999}.${sig}`, 'w1')).toBe(false);
        expect(verifyWidgetPreviewToken(`${id}.1.${sig}`, 'w1')).toBe(false);
        expect(verifyWidgetPreviewToken('w1.9999999999.nope', 'w1')).toBe(false);
        expect(verifyWidgetPreviewToken(undefined, 'w1')).toBe(false);
    });
});

describe('widget keys', () => {
    it('generates keys the routes accept', () => {
        const key = generateWidgetKey();
        expect(isWidgetKey(key)).toBe(true);
        expect(generateWidgetKey()).not.toBe(key);
        expect(isWidgetKey('cwk_../../etc')).toBe(false);
        expect(isWidgetKey('sk_live_123')).toBe(false);
    });
});

describe('sanitizeAppearance', () => {
    it('fills defaults from the agent and drops bad values', () => {
        const look = sanitizeAppearance({ accent: 'red', theme: 'neon', position: 'top', title: '   ' }, 'Appointment setter');
        expect(look).toEqual({
            title: 'Appointment setter',
            greeting: 'Hi! How can I help?',
            launcher_text: 'Need help?',
            accent: '#111111',
            theme: 'auto',
            position: 'right',
            launcher_style: 'card',
        });
    });

    it('keeps valid values and trims long text', () => {
        const look = sanitizeAppearance({ accent: '#FF5500', theme: 'dark', position: 'left', greeting: 'x'.repeat(500) });
        expect(look.accent).toBe('#ff5500');
        expect(look.theme).toBe('dark');
        expect(look.position).toBe('left');
        expect(look.greeting).toHaveLength(300);
    });
});

describe('checkWidgetTurn', () => {
    it('stops a conversation at its turn limit', async () => {
        await expect(checkWidgetTurn('s1', WIDGET_MAX_TURNS)).resolves.toMatchObject({ code: 'widget_conversation_limit' });
    });
});
