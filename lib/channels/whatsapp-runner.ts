/**
 * Answering WhatsApp messages: each customer number gets a conversation
 * (a session on the agent's published version, like a website visitor's),
 * and each message runs a turn through the regular turns endpoint.
 *
 * Customers often send several short messages in a row ("hi", "I want to
 * book", "for Saturday"). Turns on one session must not overlap, so messages
 * go into a per-customer queue in Redis; whoever holds the customer's lock
 * answers everything queued, as one turn, then checks for more.
 */

import { NextRequest } from 'next/server';
import { createRedisClient, type RedisClient } from '@/lib/redis';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import type { SubscriptionTier } from '@/lib/entitlements';
import { decryptApiKey } from '@/lib/encryption';
import { mintClientToken } from '@/lib/embedded/client-tokens';
import { ensureWidgetInstallation } from '@/lib/embedded/widget';
import {
    markReadAndTyping,
    patchChannelMetadata,
    sendText,
    type InboundMessage,
    type WhatsAppChannel,
} from './whatsapp';

type Admin = ReturnType<typeof createAdminClient>;

/** How long one customer's lock lasts if its holder dies mid-turn. */
const LOCK_SECONDS = 120;
/** A turn that takes longer than this gets an apology instead of hanging. */
const TURN_TIMEOUT_MS = 90_000;
/** Turns in one conversation before the next message starts a new one. */
const CONVERSATION_MAX_TURNS = 40;
/** A chat quiet this long starts over (Meta's own customer-service window is 24 hours). */
const CONVERSATION_IDLE_MS = 24 * 60 * 60_000;
const FALLBACK_REPLY = 'Sorry, I couldn\'t answer that just now. Please try again in a moment.';
const UNSUPPORTED_REPLY = 'Sorry, I can only read text messages for now. Could you type that out?';

let redis: RedisClient | null | undefined;
function getRedis(): RedisClient | null {
    if (redis !== undefined) return redis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    redis = url && token ? createRedisClient({ url, token }) : null;
    return redis;
}

/** Meta retries deliveries; a message id is answered once. */
async function firstDelivery(messageId: string): Promise<boolean> {
    const client = getRedis();
    if (!client) return true;
    try {
        return (await client.set(`wa_seen:${messageId}`, 1, { nx: true, ex: 86_400 })) === 'OK';
    } catch {
        return true;
    }
}

interface Queued { id: string; text: string | null }

export async function handleInboundMessages(db: Admin, channel: WhatsAppChannel, messages: InboundMessage[]): Promise<void> {
    const fresh: InboundMessage[] = [];
    for (const message of messages) {
        if (message.phoneNumberId && message.phoneNumberId !== channel.metadata.phone_number_id) continue;
        if (await firstDelivery(message.id)) fresh.push(message);
    }
    if (fresh.length === 0) return;
    void patchChannelMetadata(db, channel, { last_message_at: new Date().toISOString() });

    // One customer at a time, in arrival order.
    const byCustomer = new Map<string, InboundMessage[]>();
    for (const message of fresh) byCustomer.set(message.from, [...(byCustomer.get(message.from) ?? []), message]);
    await Promise.all([...byCustomer.values()].map((list) => answerCustomer(db, channel, list)));
}

async function answerCustomer(db: Admin, channel: WhatsAppChannel, messages: InboundMessage[]): Promise<void> {
    const customer = messages[0].from;
    const name = messages.find((m) => m.name)?.name ?? null;
    const client = getRedis();
    if (!client) {
        await answer(db, channel, customer, name, messages.map((m) => ({ id: m.id, text: m.text })));
        return;
    }
    const queueKey = `wa_queue:${channel.id}:${customer}`;
    const lockKey = `wa_lock:${channel.id}:${customer}`;
    try {
        await client.rpush(queueKey, ...messages.map((m) => JSON.stringify({ id: m.id, text: m.text } satisfies Queued)));
        await client.expire(queueKey, 3_600);
    } catch {
        await answer(db, channel, customer, name, messages.map((m) => ({ id: m.id, text: m.text })));
        return;
    }
    // Hold the lock while anything is queued; a message that lands just as the
    // lock is let go is picked up by the re-check.
    for (let attempt = 0; attempt < 5; attempt++) {
        const locked = await client.set(lockKey, 1, { nx: true, ex: LOCK_SECONDS }).catch(() => null);
        if (locked !== 'OK') return;
        try {
            for (;;) {
                const raw = await client.lrange(queueKey, 0, -1);
                if (raw.length === 0) break;
                await client.ltrim(queueKey, raw.length, -1);
                const batch = raw.map((item) => (typeof item === 'string' ? JSON.parse(item) : item) as Queued);
                await client.expire(lockKey, LOCK_SECONDS);
                await answer(db, channel, customer, name, batch);
            }
        } finally {
            await client.del(lockKey).catch(() => undefined);
        }
        const left = await client.lrange(queueKey, 0, 0).catch(() => []);
        if (left.length === 0) return;
    }
}

/** Answer one or more queued messages from a customer with a single turn. */
async function answer(db: Admin, channel: WhatsAppChannel, customer: string, name: string | null, batch: Queued[]): Promise<void> {
    const token = channel.accessTokenEncrypted ? safeDecrypt(channel.accessTokenEncrypted, await organizationOf(db, channel.projectId)) : null;
    if (!token) return;
    const last = batch[batch.length - 1];
    const texts = batch.map((m) => m.text).filter((t): t is string => !!t);
    if (texts.length === 0) {
        await sendText(channel, token, customer, UNSUPPORTED_REPLY, last.id).catch(() => undefined);
        return;
    }
    void markReadAndTyping(channel, token, last.id);

    let reply: string;
    try {
        reply = await runTurn(db, channel, customer, name, texts.join('\n'));
    } catch (error) {
        console.error('[whatsapp] turn failed', error instanceof Error ? error.message : error);
        reply = FALLBACK_REPLY;
    }
    if (!reply.trim()) return;
    try {
        await sendText(channel, token, customer, reply, batch.length > 1 ? undefined : last.id);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Send failed';
        console.error('[whatsapp] send failed', message);
        await db.from('tool_connections').update({ last_error: message.slice(0, 300) }).eq('id', channel.id);
    }
}

const orgCache = new Map<string, string>();
async function organizationOf(db: Admin, projectId: string): Promise<string> {
    const cached = orgCache.get(projectId);
    if (cached) return cached;
    const { data } = await db.from('projects').select('organization_id').eq('id', projectId).maybeSingle();
    const id = (data?.organization_id as string | undefined) ?? '';
    if (id) orgCache.set(projectId, id);
    return id;
}

function safeDecrypt(value: string, organizationId: string): string | null {
    try {
        return decryptApiKey(value, organizationId);
    } catch {
        return null;
    }
}

/** The customer's open conversation, or a new one. */
async function customerSession(db: Admin, channel: WhatsAppChannel, customer: string, name: string | null): Promise<{ sessionId: string; tenantId: string; installationId: string }> {
    const projectId = channel.projectId;
    const agentId = channel.metadata.agent_id;
    const [{ data: agent }, organizationId] = await Promise.all([
        db.from('agents').select('name').eq('project_id', projectId).eq('id', agentId).maybeSingle(),
        organizationOf(db, projectId),
    ]);
    const { data: org } = await db.from('organizations').select('subscription_tier').eq('id', organizationId).maybeSingle();
    const tier = ((org?.subscription_tier as string | undefined) || 'free') as SubscriptionTier;
    const installed = await ensureWidgetInstallation(db, { projectId, agentId, agentName: (agent?.name as string | undefined) ?? 'Agent', tier, audience: 'whatsapp' });
    if (!installed.ok) throw new Error(installed.message);

    const externalUserId = `wa:${customer}`;
    const { data: open } = await db.from('sessions').select('id, last_turn_number, updated_at')
        .eq('project_id', projectId).eq('installation_id', installed.installationId)
        .eq('external_user_id', externalUserId).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (open) {
        // A long or long-quiet chat starts a fresh conversation, so history stays short and relevant.
        const stale = Date.now() - new Date(open.updated_at as string).getTime() > CONVERSATION_IDLE_MS;
        if ((open.last_turn_number as number) < CONVERSATION_MAX_TURNS && !stale) {
            return { sessionId: open.id as string, tenantId: installed.tenantId, installationId: installed.installationId };
        }
        await db.from('sessions').update({ status: 'completed' }).eq('id', open.id as string);
    }

    const { checkCustomRateLimit } = await import('@/lib/rate-limit');
    const perDay = await checkCustomRateLimit(`wa_day:${channel.id}`, channel.metadata.daily_session_cap, 86_400);
    if (!perDay.allowed) throw new Error('Daily conversation cap reached');
    const { data: created, error } = await db.from('sessions').insert({
        project_id: projectId,
        organization_id: organizationId || null,
        status: 'active',
        agent_id: agentId,
        tenant_id: installed.tenantId,
        external_user_id: externalUserId,
        installation_id: installed.installationId,
        metadata: { source: 'whatsapp', channel_id: channel.id, customer_number: customer, customer_name: name },
    }).select('id').single();
    if (error || !created) throw new Error('Could not start the conversation');
    return { sessionId: created.id as string, tenantId: installed.tenantId, installationId: installed.installationId };
}

/** Run a turn through the turns endpoint and read the reply off its event stream. */
async function runTurn(db: Admin, channel: WhatsAppChannel, customer: string, name: string | null, input: string): Promise<string> {
    const session = await customerSession(db, channel, customer, name);
    const { token } = mintClientToken({
        projectId: channel.projectId,
        environment: 'production',
        tenantId: session.tenantId,
        externalUserId: `wa:${customer}`,
        installationIds: [session.installationId],
        permissions: ['sessions:turn'],
        sessionId: session.sessionId,
        expiresInSeconds: 300,
    });
    // Called in-process: the route does its own auth, limits, tools and billing.
    const { POST } = await import('@/app/api/v1/sessions/[id]/turns/route');
    const request = new NextRequest(`https://cencori.internal/api/v1/sessions/${session.sessionId}/turns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'cencori-whatsapp' },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
    });
    const response = await POST(request, { params: Promise.resolve({ id: session.sessionId }) });
    if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Turn failed (${response.status})`);
    }
    return readReply(response.body);
}

/** The reply text from a turn's server-sent events. */
export async function readReply(body: ReadableStream<Uint8Array>): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reply = '';
    let failure: string | null = null;
    const handle = (chunk: string) => {
        let type = 'message';
        let data = '';
        for (const line of chunk.split('\n')) {
            if (line.startsWith('event:')) type = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) return;
        try {
            const parsed = JSON.parse(data) as { delta?: unknown; output?: { error?: string } };
            if (type === 'output_text.delta' && typeof parsed.delta === 'string') reply += parsed.delta;
            else if (type === 'turn.failed') failure = parsed.output?.error ?? 'Turn failed';
            else if (type === 'turn.paused') failure = 'Turn needs approval';
        } catch {
            // skip malformed events
        }
    };
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        parts.forEach(handle);
    }
    if (buffer.trim()) handle(buffer);
    if (!reply && failure) throw new Error(failure);
    return reply;
}
