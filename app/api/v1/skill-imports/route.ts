import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import {
    SKILL_MAX_FILE_BYTES,
    SKILL_MAX_TOTAL_BYTES,
    checksumSkillFiles,
    hasBlockers,
    normalizeSkillFiles,
    scanSkillFiles,
    type ScanFinding,
    type SkillFile,
} from '@/lib/embedded/skill-scan';
import { safeOutboundFetch } from '@/lib/security/outbound-url';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const IMPORT_MAX_FILES = 200;

function serialize(row: Record<string, unknown>) {
    return {
        id: row.id,
        source_type: row.source_type,
        source_ref: row.source_ref,
        status: row.status,
        normalized_manifest: row.normalized_manifest ?? {},
        scan_findings: row.scan_findings ?? [],
        checksum: row.checksum ?? null,
        reviewed_by: row.reviewed_by ?? null,
        published_skill_version_id: row.published_skill_version_id ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function resolveTenant(supabase: ReturnType<typeof createAdminClient>, projectId: string, tenantId: string | undefined) {
    if (!tenantId) return null;
    const raw = dePrefixId(tenantId);
    const { data } = await supabase.from('platform_tenants').select('id').eq('project_id', projectId).eq('id', raw).maybeSingle();
    if (data) return data.id as string;
    const { data: byExt } = await supabase.from('platform_tenants').select('id').eq('project_id', projectId).eq('external_id', tenantId).maybeSingle();
    return (byExt?.id as string) ?? null;
}

async function fetchUrlText(url: string): Promise<{ files: SkillFile[]; revision: string | null }> {
    const safe = await import('@/lib/security/outbound-url').then((m) => m.assertSafeOutboundUrl(url));
    const res = await safeOutboundFetch(safe.toString(), { signal: AbortSignal.timeout(20000) }, { maxRedirects: 2 });
    if (!res.ok) throw new Error(`Source URL returned ${res.status}`);
    const contentType = res.headers.get('content-type') ?? '';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > SKILL_MAX_TOTAL_BYTES) throw new Error('Source exceeds size limit');
    const name = new URL(safe.toString()).pathname.split('/').pop() || 'SKILL.md';
    if (/\.zip$/i.test(name) || contentType.includes('zip')) {
        return { files: await extractZip(buffer), revision: res.headers.get('etag') };
    }
    return { files: [{ path: /\.(md|markdown|txt)$/i.test(name) ? name : 'SKILL.md', content: buffer.toString('utf8') }], revision: res.headers.get('etag') };
}

async function extractZip(buffer: Buffer): Promise<SkillFile[]> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const files: SkillFile[] = [];
    const entries = Object.values(zip.files).filter((e) => !e.dir).slice(0, IMPORT_MAX_FILES + 1);
    if (entries.length > IMPORT_MAX_FILES) throw new Error(`Archive exceeds ${IMPORT_MAX_FILES} files`);
    let total = 0;
    for (const entry of entries) {
        const text = await entry.async('string');
        total += Buffer.byteLength(text, 'utf8');
        if (total > SKILL_MAX_TOTAL_BYTES) throw new Error('Archive exceeds size limit');
        files.push({ path: entry.name.replace(/\\/g, '/'), content: text });
    }
    return files;
}

function githubCodeloadUrl(repoUrl: string): string | null {
    const m = repoUrl.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/|$)/i);
    if (!m) return null;
    return `https://codeload.github.com/${m[1]}/tar.gz/HEAD`;
}

// POST /v1/skill-imports — exactly one source; staged, never auto-published.
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const contentType = req.headers.get('content-type') ?? '';

    let sourceType: 'repo' | 'url' | 'upload' | 'paste' | null = null;
    let sourceRef = '';
    let files: SkillFile[] = [];
    let tenantId: string | null = null;

    try {
        if (contentType.includes('multipart/form-data')) {
            const form = await req.formData();
            const file = form.get('file');
            if (!(file instanceof File)) {
                return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'file is required', { requestId }), { requestId });
            }
            if (file.size > UPLOAD_MAX_BYTES) {
                return addGatewayHeaders(embeddedError(413, 'invalid_request_error', 'Upload exceeds 10MB', { requestId }), { requestId });
            }
            const filename = file.name || 'upload.zip';
            const buffer = Buffer.from(await file.arrayBuffer());
            sourceType = 'upload';
            sourceRef = `upload:${filename}`;
            if (/\.zip$/i.test(filename)) {
                files = await extractZip(buffer);
            } else {
                if (buffer.length > SKILL_MAX_FILE_BYTES) {
                    return addGatewayHeaders(embeddedError(413, 'invalid_request_error', 'File exceeds size limit', { requestId }), { requestId });
                }
                files = [{ path: filename, content: buffer.toString('utf8') }];
            }
            const tenantParam = form.get('tenant_id');
            if (typeof tenantParam === 'string' && tenantParam) {
                tenantId = await resolveTenant(supabase, validation.context.projectId, tenantParam);
                if (!tenantId) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
            }
        } else {
            const body = (await req.json()) as {
                source_type?: string; url?: string; repository?: string; text?: string;
                files?: Array<{ path?: string; content?: unknown }>; tenant_id?: string; filename?: string;
            };
            if (body.tenant_id) {
                tenantId = await resolveTenant(supabase, validation.context.projectId, body.tenant_id);
                if (!tenantId) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
            }
            const provided = [body.url, body.repository, body.text, body.files].filter((v) => v !== undefined);
            if (provided.length !== 1) {
                return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Provide exactly one source: url, repository, text, or files', { requestId }), { requestId });
            }
            if (body.repository) {
                const archive = githubCodeloadUrl(body.repository);
                if (!archive) {
                    return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'repository must be a public github.com URL; otherwise upload an archive', { requestId }), { requestId });
                }
                sourceType = 'repo';
                sourceRef = body.repository;
                ({ files } = await fetchUrlText(archive));
            } else if (body.url) {
                sourceType = 'url';
                sourceRef = body.url;
                ({ files } = await fetchUrlText(body.url));
            } else if (body.text !== undefined) {
                sourceType = 'paste';
                sourceRef = 'paste:inline';
                files = [{ path: body.filename || 'SKILL.md', content: body.text.toString() }];
            } else {
                sourceType = 'paste';
                sourceRef = 'paste:files';
                files = (body.files ?? []).map((f) => ({ path: (f.path ?? 'SKILL.md').toString(), content: (f.content ?? '').toString() }));
            }
        }
    } catch (e) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', e instanceof Error ? e.message : 'Failed to read import source', { requestId }), { requestId });
    }

    if (!sourceType) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No import source supplied', { requestId }), { requestId });
    }
    const { files: normalized, findings: normalizeFindings } = normalizeSkillFiles(files.map((f) => ({ path: f.path, content: f.content })));
    const findings: ScanFinding[] = [...normalizeFindings, ...scanSkillFiles(normalized)];
    // Normalized file contents are pinned on the import row so review and
    // publish operate on exactly what was scanned (alpha; revisit storage at scale).
    const manifest = {
        files: normalized.map((f) => ({ path: f.path, bytes: Buffer.byteLength(f.content, 'utf8'), content: f.content })),
        blocked: hasBlockers(findings),
    };

    const { data, error } = await supabase
        .from('skill_imports')
        .insert({
            project_id: validation.context.projectId,
            tenant_id: tenantId,
            source_type: sourceType,
            source_ref: sourceRef.slice(0, 1000),
            status: 'ready_for_review',
            normalized_manifest: manifest,
            scan_findings: findings,
            checksum: normalized.length > 0 ? checksumSkillFiles(normalized) : null,
        })
        .select('*')
        .single();
    if (error || !data) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to stage import', { requestId }), { requestId });
    }
    const row = data as Record<string, unknown>;
    return addGatewayHeaders(NextResponse.json(serialize(row), { status: 201 }), { requestId });
}
