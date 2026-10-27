import { describe, expect, it } from 'vitest';
import { isPublicHttpsUrl } from '@/lib/studio/push-endpoint';

describe('push endpoints', () => {
    it('accepts the browsers\' push services', () => {
        expect(isPublicHttpsUrl('https://fcm.googleapis.com/fcm/send/abc:123')).toBe(true);
        expect(isPublicHttpsUrl('https://web.push.apple.com/QGx')).toBe(true);
        expect(isPublicHttpsUrl('https://updates.push.services.mozilla.com/wpush/v2/gAAA')).toBe(true);
    });

    it('refuses anything the server shouldn\'t post to', () => {
        for (const bad of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://[::1]/x', 'https://metadata.internal/x', 'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'not a url', 'https://intranet/x']) {
            expect(isPublicHttpsUrl(bad), bad).toBe(false);
        }
    });
});
