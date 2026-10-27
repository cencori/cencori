import { createHmac } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyKapsoDelivery } from '@/lib/channels/kapso';

const SECRET = 'test-secret';
const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
const signed = (raw: string, secret = SECRET) => createHmac('sha256', secret).update(raw, 'utf8').digest('hex');

describe('Kapso deliveries', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('trusts Kapso\'s signature or Cencori\'s header, and nothing else', () => {
        vi.stubEnv('KAPSO_WEBHOOK_SECRET', SECRET);
        expect(verifyKapsoDelivery(body, signed(body), null)).toBe(true);
        expect(verifyKapsoDelivery(body, signed(body).toUpperCase(), null)).toBe(true);
        expect(verifyKapsoDelivery(body, null, SECRET)).toBe(true);
        expect(verifyKapsoDelivery(body, signed(body, 'other'), null)).toBe(false);
        expect(verifyKapsoDelivery(`${body} `, signed(body), null)).toBe(false);
        expect(verifyKapsoDelivery(body, null, 'wrong')).toBe(false);
        expect(verifyKapsoDelivery(body, null, null)).toBe(false);
    });

    it('trusts nothing when the secret isn\'t configured', () => {
        vi.stubEnv('KAPSO_WEBHOOK_SECRET', '');
        expect(verifyKapsoDelivery(body, signed(body, ''), '')).toBe(false);
    });
});
