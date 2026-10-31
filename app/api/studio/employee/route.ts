/**
 * GET  /api/studio/employee?project_id=&agent_id=
 *      An employee's profile: its name and personality (tone, how it talks,
 *      language, emoji), with the choices the profile offers.
 * POST /api/studio/employee  { project_id, agent_id, name?, tone?, style?, language?, emoji? }
 *      Rename it and set its personality. Live on the next customer message
 *      (lib/studio/persona.ts), no publishing. Owners and admins.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getPersona, LANGUAGES, publicPersona, savePersona, TONES } from '@/lib/studio/persona';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

/** The choices, in the owner's words. */
const CHOICES = {
    tones: [
        { id: 'warm', label: 'Warm', description: 'Kind and upbeat' },
        { id: 'professional', label: 'Professional', description: 'Polite and precise' },
        { id: 'playful', label: 'Playful', description: 'Light and witty' },
        { id: 'direct', label: 'Straight to the point', description: 'Short and clear' },
    ],
    languages: [
        { id: 'customer', label: "The customer's language" },
        { id: 'english', label: 'English' },
        { id: 'pidgin', label: 'Pidgin' },
        { id: 'yoruba', label: 'Yoruba' },
        { id: 'igbo', label: 'Igbo' },
        { id: 'hausa', label: 'Hausa' },
        { id: 'french', label: 'French' },
    ],
} satisfies { tones: Array<{ id: keyof typeof TONES; label: string; description: string }>; languages: Array<{ id: keyof typeof LANGUAGES; label: string }> };

async function employee(projectId: string, agentId: string) {
    const db = createAdminClient();
    const { data } = await db.from('agents').select('id, name').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    return data ? { db, agent: data as { id: string; name: string } } : null;
}

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id');
    const agentId = req.nextUrl.searchParams.get('agent_id');
    if (!isId(projectId) || !isId(agentId)) return fail('Say which employee.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const found = await employee(projectId, agentId);
    if (!found) return fail('That employee isn\'t there any more.', 404);
    const persona = await getPersona(found.db, projectId, agentId);
    return NextResponse.json({ name: found.agent.name, ...publicPersona(persona), choices: CHOICES }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!isId(body?.project_id) || !isId(body?.agent_id)) return fail('Say which employee.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    if (!['owner', 'admin'].includes(access.role)) return fail('Only owners and admins can change an employee.', 403);
    const found = await employee(body.project_id, body.agent_id);
    if (!found) return fail('That employee isn\'t there any more.', 404);

    let name = found.agent.name;
    if (body.name !== undefined) {
        name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
        if (!name) return fail('Give your employee a name.');
        if (name.length > 60) return fail('Keep the name under 60 characters.');
    }
    // The personality first: a name alone still writes it, so the new name reaches customers.
    const saved = await savePersona(found.db, {
        projectId: body.project_id, agentId: body.agent_id, existing: await getPersona(found.db, body.project_id, body.agent_id),
        tone: body.tone, style: body.style, language: body.language, emoji: body.emoji,
    });
    if (!saved.ok) return fail(saved.message);
    if (name !== found.agent.name) {
        const { error } = await found.db.from('agents').update({ name }).eq('project_id', body.project_id).eq('id', body.agent_id);
        if (error) return fail('Saved the personality, but couldn\'t rename them. Try again.', 502);
    }
    return NextResponse.json({ name, ...publicPersona(saved.persona), choices: CHOICES });
}
