import type { createAdminClient } from '@/lib/supabaseAdmin';
import { embedForMemory } from '@/lib/memory/embeddings';
import { chunkKnowledgeText, checksumText } from './knowledge';

type Admin = ReturnType<typeof createAdminClient>;

const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /disregard\s+(all\s+)?prior\s+instructions/i,
    /system\s*:\s*you\s+are\s+now/i,
    /reveal\s+(your\s+)?system\s+prompt/i,
    /exfiltrate/i,
];

/** Lightweight M1 injection heuristic (full gateway guard lands in M4 hardening). */
export function scanForInjection(text: string): boolean {
    return INJECTION_PATTERNS.some((re) => re.test(text));
}

export async function ingestSourceText(
    supabase: Admin,
    opts: { projectId: string; organizationId: string; knowledgeBaseId: string; tenantId: string | null; sourceId: string; text: string },
): Promise<{ chunks: number; checksum: string }> {
    const checksum = checksumText(opts.text);
    await supabase.from('knowledge_sources').update({ status: 'processing', checksum }).eq('id', opts.sourceId);

    if (scanForInjection(opts.text)) {
        await supabase.from('knowledge_sources').update({ status: 'stale', error: 'Potential prompt injection detected; held for review' }).eq('id', opts.sourceId);
        return { chunks: 0, checksum };
    }

    const chunks = chunkKnowledgeText(opts.text);
    if (chunks.length === 0) {
        await supabase.from('knowledge_sources').update({ status: 'failed', error: 'No extractable content' }).eq('id', opts.sourceId);
        return { chunks: 0, checksum };
    }

    // Idempotent re-sync: skip when checksum matches a ready source with chunks.
    const { data: existing } = await supabase.from('knowledge_chunks').select('id').eq('source_id', opts.sourceId).limit(1);
    if ((existing ?? []).length > 0) {
        const { data: src } = await supabase.from('knowledge_sources').select('checksum').eq('id', opts.sourceId).maybeSingle();
        if ((src?.checksum as string) === checksum) {
            await supabase.from('knowledge_sources').update({ status: 'ready', error: null }).eq('id', opts.sourceId);
            const { count } = await supabase.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('source_id', opts.sourceId);
            return { chunks: count ?? 0, checksum };
        }
        await supabase.from('knowledge_chunks').delete().eq('source_id', opts.sourceId);
    }

    try {
        const embedded = await embedForMemory(supabase as never, opts.projectId, opts.organizationId, chunks);
        const rows = chunks.map((content, i) => ({
            project_id: opts.projectId,
            knowledge_base_id: opts.knowledgeBaseId,
            source_id: opts.sourceId,
            tenant_id: opts.tenantId,
            ord: i,
            page: null as number | null,
            content,
            embedding: `[${embedded.embeddings[i].join(',')}]`,
            metadata: { checksum },
        }));
        // Insert in batches of 10 (mirrors atomic upload batch RPC limits).
        for (let i = 0; i < rows.length; i += 10) {
            const batch = rows.slice(i, i + 10);
            const { error } = await supabase.from('knowledge_chunks').insert(batch as never);
            if (error) throw new Error(error.message);
        }
        await supabase.from('knowledge_sources').update({ status: 'ready', error: null }).eq('id', opts.sourceId);
        try {
            const { triggerWebhooks } = await import('@/lib/webhooks/trigger');
            await triggerWebhooks(opts.projectId, 'knowledge_source.ready' as never, { knowledge_base_id: opts.knowledgeBaseId, source_id: opts.sourceId, chunks: chunks.length });
        } catch {
            // Webhook delivery failure must not fail ingestion.
        }
        return { chunks: chunks.length, checksum };
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Ingestion failed';
        await supabase.from('knowledge_sources').update({ status: 'failed', error: message }).eq('id', opts.sourceId);
        try {
            const { triggerWebhooks } = await import('@/lib/webhooks/trigger');
            await triggerWebhooks(opts.projectId, 'knowledge_source.failed' as never, { knowledge_base_id: opts.knowledgeBaseId, source_id: opts.sourceId, error: message });
        } catch {
            // ignore
        }
        throw e;
    }
}
