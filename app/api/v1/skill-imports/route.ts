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
import {
    extractSkillZip,
    githubCodeloadUrl,
    htmlToReadableText,
    looksLikeHtml,
    parseGitHubTarget,
    repoFilterNotice,
    SkillImportSourceError,
    type ImportNotice,
} from '@/lib/embedded/skill-import-source';
import { safeOutboundFetch } from '@/lib/security/outbound-url';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const BINARY_CONTENT_TYPE = /^(image|audio|video|font)\//i;
const REJECTED_CONTENT_TYPE =
    /application\/(octet-stream|pdf|x-msdownload|x-sh|x-executable|msword|vnd\.ms-|vnd\.openxmlformats|vnd\.apple\.|x-tar|gzip)/i;
const ZIP_CONTENT_TYPE = /zip/i;

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

function errorFromSource(e: unknown, source: string): { status: number; message: string; details: Record<string, unknown> } {
    if (e instanceof SkillImportSourceError) {
        return { status: e.status, message: e.message, details: { ...e.details, source: source.slice(0, 1000) } };
    }
    return { status: 400, message: e instanceof Error ? e.message : 'Failed to read import source', details: { source: source.slice(0, 1000) } };
}

async function fetchRemoteBuffer(url: string, maxRedirects = 5): Promise<{ buffer: Buffer; contentType: string; revision: string | null; finalUrl: string }> {
    const safe = await import('@/lib/security/outbound-url').then((m) => m.assertSafeOutboundUrl(url));
    const res = await safeOutboundFetch(safe.toString(), { signal: AbortSignal.timeout(20000) }, { maxRedirects });
    if (!res.ok) {
        throw new SkillImportSourceError(res.status >= 500 ? 502 : 400, `Source URL returned ${res.status}: ${safe.toString().slice(0, 200)}`, {
            http_status: res.status,
            source: safe.toString().slice(0, 1000),
        });
    }
    const contentType = res.headers.get('content-type') ?? '';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > SKILL_MAX_TOTAL_BYTES) {
        throw new SkillImportSourceError(
            413,
            `Source exceeds ${SKILL_MAX_TOTAL_BYTES} bytes (found ${buffer.length}); link a smaller file or upload a filtered archive`,
            { actual_bytes: buffer.length, limit_bytes: SKILL_MAX_TOTAL_BYTES, content_type: contentType || null, source: safe.toString().slice(0, 1000) },
        );
    }
    return { buffer, contentType, revision: res.headers.get('etag'), finalUrl: safe.toString() };
}

async function fetchUrlText(url: string): Promise<{ files: SkillFile[]; revision: string | null; notices: ImportNotice[] }> {
    const notices: ImportNotice[] = [];
    const { buffer, contentType, revision, finalUrl } = await fetchRemoteBuffer(url);
    const name = new URL(finalUrl).pathname.split('/').pop() || 'SKILL.md';
    const zipMagic = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
    if (/\.zip$/i.test(name) || ZIP_CONTENT_TYPE.test(contentType) || zipMagic) {
        const extracted = await extractSkillZip(buffer, { source: finalUrl });
        const notice = repoFilterNotice(extracted, null);
        if (notice) notices.push(notice);
        return { files: extracted.files, revision, notices };
    }
    if (BINARY_CONTENT_TYPE.test(contentType) || REJECTED_CONTENT_TYPE.test(contentType)) {
        throw new SkillImportSourceError(
            415,
            `Source content-type ${contentType || 'unknown'} is not importable; link a Markdown/text file or zip, or paste the text directly`,
            { content_type: contentType || null, source: finalUrl.slice(0, 1000) },
        );
    }
    const head = buffer.toString('utf8', 0, Math.min(buffer.length, 2048));
    if (looksLikeHtml(contentType, head)) {
        const full = buffer.toString('utf8');
        const { text, title } = htmlToReadableText(full, finalUrl);
        const bytes = Buffer.byteLength(text, 'utf8');
        if (bytes > SKILL_MAX_TOTAL_BYTES) {
            throw new SkillImportSourceError(
                413,
                `Extracted page text exceeds ${SKILL_MAX_TOTAL_BYTES} bytes (found ${bytes}); paste a shorter section instead`,
                { actual_bytes: bytes, limit_bytes: SKILL_MAX_TOTAL_BYTES, source: finalUrl.slice(0, 1000) },
            );
        }
        notices.push({
            code: 'html_extracted',
            message: `URL returned an HTML page${title ? ` ("${title.slice(0, 120)}")` : ''}; readable text was extracted (${buffer.length} HTML bytes → ${bytes} text bytes). Layout, scripts, and media were dropped.`,
        });
        return { files: [{ path: 'SKILL.md', content: text }], revision, notices };
    }
    if (buffer.length === 0) {
        throw new SkillImportSourceError(422, `Source URL returned an empty body: ${finalUrl.slice(0, 200)}`, {
            source: finalUrl.slice(0, 1000),
        });
    }
    const text = buffer.toString('utf8');
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > SKILL_MAX_FILE_BYTES) {
        throw new SkillImportSourceError(
            413,
            `Source file exceeds ${SKILL_MAX_FILE_BYTES} bytes (found ${bytes}); link a smaller file or paste a shorter section`,
            { actual_bytes: bytes, limit_bytes: SKILL_MAX_FILE_BYTES, source: finalUrl.slice(0, 1000) },
        );
    }
    return { files: [{ path: /\.(md|markdown|mdx|txt)$/i.test(name) ? name : 'SKILL.md', content: text }], revision, notices };
}

async function fetchRepoArchive(
    repository: string,
    opts: { ref?: string; subdir?: string; branch?: string; path?: string },
): Promise<{ files: SkillFile[]; revision: string | null; notices: ImportNotice[]; target: { owner: string; repo: string; ref: string; subdir: string | null } }> {
    const target = parseGitHubTarget(repository, opts);
    if (!target) {
        throw new SkillImportSourceError(
            400,
            'repository must be a public github.com URL (owner/repo, optionally /tree/<ref>/<subdir>) or "owner/repo"; otherwise upload an archive',
            { repository: repository.slice(0, 300) },
        );
    }
    const archive = githubCodeloadUrl(target.owner, target.repo, target.ref);
    // Fetch the archive buffer directly (not via fetchUrlText) so the
    // subdir scope applies inside the zip filter — caps are enforced on the
    // scoped files, not the whole repo.
    const { buffer, revision } = await fetchRemoteBuffer(archive).catch((e: unknown) => {
        if (e instanceof SkillImportSourceError) {
            throw new SkillImportSourceError(e.status, e.message, { ...e.details, repository: repository.slice(0, 500), ref: target.ref });
        }
        throw e;
    });
    const extracted = await extractSkillZip(buffer, { subdir: target.subdir, source: repository }).catch((e: unknown) => {
        if (e instanceof SkillImportSourceError) {
            throw new SkillImportSourceError(e.status, e.message, { ...e.details, repository: repository.slice(0, 500), ref: target.ref });
        }
        throw e;
    });
    const extraNotices: ImportNotice[] = [];
    const filterNotice = repoFilterNotice(extracted, target.subdir);
    if (filterNotice) extraNotices.push(filterNotice);
    if (target.subdir) {
        extraNotices.push({ code: 'repo_subdir', message: `Scoped repo import to "${target.subdir}" (${extracted.files.length} text file(s)).` });
    }
    if (target.ref !== 'HEAD') {
        extraNotices.unshift({ code: 'repo_ref', message: `Imported public repo ${target.owner}/${target.repo} at ref "${target.ref}".` });
    }
    return { files: extracted.files, revision, notices: extraNotices, target };
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
    const extraFindings: ScanFinding[] = [];

    try {
        if (contentType.includes('multipart/form-data')) {
            const form = await req.formData();
            const file = form.get('file');
            if (!(file instanceof File)) {
                return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'file is required', { requestId }), { requestId });
            }
            if (file.size > UPLOAD_MAX_BYTES) {
                return addGatewayHeaders(
                    embeddedError(413, 'invalid_request_error', `Upload exceeds ${UPLOAD_MAX_BYTES} bytes (found ${file.size}): ${file.name.slice(0, 120)}`, {
                        requestId,
                        details: { actual_bytes: file.size, limit_bytes: UPLOAD_MAX_BYTES, filename: file.name.slice(0, 200) },
                    }),
                    { requestId },
                );
            }
            const filename = file.name || 'upload.zip';
            const buffer = Buffer.from(await file.arrayBuffer());
            sourceType = 'upload';
            sourceRef = `upload:${filename}`;
            if (/\.zip$/i.test(filename)) {
                const extracted = await extractSkillZip(buffer, { source: sourceRef });
                files = extracted.files;
                const notice = repoFilterNotice(extracted, null);
                if (notice) extraFindings.push({ severity: 'warning', code: notice.code, message: notice.message });
            } else {
                if (buffer.length > SKILL_MAX_FILE_BYTES) {
                    return addGatewayHeaders(
                        embeddedError(413, 'invalid_request_error', `File exceeds ${SKILL_MAX_FILE_BYTES} bytes (found ${buffer.length}): ${filename.slice(0, 120)}`, {
                            requestId,
                            details: { actual_bytes: buffer.length, limit_bytes: SKILL_MAX_FILE_BYTES, filename: filename.slice(0, 200) },
                        }),
                        { requestId },
                    );
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
                ref?: string; subdir?: string; branch?: string; path?: string;
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
                sourceType = 'repo';
                sourceRef = body.repository;
                const { files: repoFiles, notices, target } = await fetchRepoArchive(body.repository, {
                    ref: body.ref,
                    subdir: body.subdir,
                    branch: body.branch,
                    path: body.path,
                });
                files = repoFiles;
                if (target.subdir) sourceRef = `${body.repository}#${target.subdir}@${target.ref}`;
                else if (target.ref !== 'HEAD') sourceRef = `${body.repository}@${target.ref}`;
                for (const notice of notices) {
                    extraFindings.push({ severity: 'warning', code: notice.code, message: notice.message });
                }
            } else if (body.url) {
                sourceType = 'url';
                sourceRef = body.url;
                const { files: urlFiles, notices } = await fetchUrlText(body.url);
                files = urlFiles;
                for (const notice of notices) {
                    extraFindings.push({ severity: 'warning', code: notice.code, message: notice.message });
                }
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
        if (e instanceof SkillImportSourceError) {
            return addGatewayHeaders(embeddedError(e.status, 'invalid_request_error', e.message, { requestId, details: { ...e.details, request_id: requestId } }), { requestId });
        }
        const { status, message, details } = errorFromSource(e, sourceRef || 'unknown');
        return addGatewayHeaders(embeddedError(status, 'invalid_request_error', message, { requestId, details: { ...details, request_id: requestId } }), { requestId });
    }

    if (!sourceType) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'No import source supplied', { requestId }), { requestId });
    }
    const { files: normalized, findings: normalizeFindings } = normalizeSkillFiles(files.map((f) => ({ path: f.path, content: f.content })));
    const findings: ScanFinding[] = [...normalizeFindings, ...scanSkillFiles(normalized), ...extraFindings];
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
