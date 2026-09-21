import type { createAdminClient } from '@/lib/supabaseAdmin';
import { dePrefixId, withPrefix } from './http';

type Admin = ReturnType<typeof createAdminClient>;

export const deSkill = (id: string): string => dePrefixId(id).replace(/^(skl_)/, '');

export function serializeSkill(row: Record<string, unknown>) {
    return {
        id: withPrefix('skl', row.id as string),
        project_id: row.project_id,
        tenant_id: row.tenant_id ? withPrefix('ten', row.tenant_id as string) : null,
        name: row.name,
        slug: row.slug,
        description: row.description ?? null,
        visibility: row.visibility,
        status: row.status,
        created_by: row.created_by ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export function serializeSkillVersion(row: Record<string, unknown>, includeContent: boolean) {
    return {
        id: row.id,
        skill_id: row.skill_id,
        version: row.version,
        status: row.status,
        source_type: row.source_type,
        source_uri: row.source_uri ?? null,
        source_revision: row.source_revision ?? null,
        checksum: row.checksum ?? null,
        scan_findings: row.scan_findings ?? [],
        reviewed_by: row.reviewed_by ?? null,
        published_at: row.published_at ?? null,
        created_at: row.created_at,
        ...(includeContent ? { content: row.content } : {}),
    };
}

export async function loadSkill(supabase: Admin, projectId: string, skillId: string) {
    const { data } = await supabase.from('skills').select('*').eq('project_id', projectId).eq('id', deSkill(skillId)).maybeSingle();
    if (data) return data as Record<string, unknown>;
    const { data: bySlug } = await supabase.from('skills').select('*').eq('project_id', projectId).eq('slug', skillId).maybeSingle();
    return (bySlug ?? null) as Record<string, unknown> | null;
}

export async function loadSkillVersion(supabase: Admin, projectId: string, skillId: string, version: string) {
    const skill = await loadSkill(supabase, projectId, skillId);
    if (!skill) return null;
    const { data } = await supabase.from('skill_versions').select('*').eq('skill_id', skill.id as string).eq('version', version).maybeSingle();
    const row = data ?? (await supabase.from('skill_versions').select('*').eq('id', version).eq('skill_id', skill.id as string).maybeSingle()).data;
    return (row ?? null) as Record<string, unknown> | null;
}
