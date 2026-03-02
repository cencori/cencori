/**
 * GitHub Webhook Signature Verification
 *
 * Verifies that incoming webhook payloads were sent by GitHub
 * using HMAC-SHA256 signature comparison.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify the HMAC-SHA256 signature of a GitHub webhook payload.
 *
 * @param payload - Raw request body as a string
 * @param signatureHeader - Value of the `X-Hub-Signature-256` header
 * @returns true if the signature is valid
 */
export function verifyWebhookSignature(payload: string, signatureHeader: string | null): boolean {
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('[Webhook] GITHUB_WEBHOOK_SECRET is not configured');
        return false;
    }

    if (!signatureHeader) {
        return false;
    }

    // GitHub sends: sha256=<hex digest>
    const expectedSignature = 'sha256=' + createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

    try {
        const sigBuffer = Buffer.from(signatureHeader);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (sigBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
        return false;
    }
}
