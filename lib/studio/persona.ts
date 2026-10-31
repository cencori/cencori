/**
 * An employee's personality (Studio): its tone, how it talks, the language it
 * speaks and whether it uses emoji, set by the owner on the employee's
 * profile. Live, not versioned: each turn reads it (app/api/v1/sessions/[id]/
 * turns), so a change reaches the next customer message without publishing,
 * and the owner's side of the same employee (Copilot's employee mode) speaks
 * the same way. Stored like owner alerts, on a project tool_connections row
 * per agent (connector_slug = 'persona'). Agents with no row (developers' own)
 * get nothing added.
 */
import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export const PERSONA_SLUG = 'persona';

export const TONES = {
    warm: 'Warm and friendly: kind, upbeat, makes people feel welcome.',
    professional: 'Professional: polite, precise and composed, like a good front desk.',
    playful: 'Playful: light, witty and fun, without getting in the way of helping.',
    direct: 'Straight to the point: short, clear answers, no small talk.',
} as const;
export type Tone = keyof typeof TONES;

export const LANGUAGES = {
    customer: "Reply in the customer's language: whatever they write in.",
    english: 'Speak English.',
    pidgin: 'Speak Nigerian Pidgin, naturally, unless the customer clearly prefers English.',
    yoruba: 'Speak Yoruba, unless the customer writes in another language.',
    igbo: 'Speak Igbo, unless the customer writes in another language.',
    hausa: 'Speak Hausa, unless the customer writes in another language.',
    french: 'Speak French, unless the customer writes in another language.',
} as const;
export type Language = keyof typeof LANGUAGES;

const STYLE_MAX = 500;

export interface PersonaSettings {
    kind: 'persona';
    agent_id: string;
    tone: Tone;
    /** In the owner's words: "uses Pidgin when customers do", "calls everyone 'boss'". */
    style: string;
    language: Language;
    emoji: boolean;
}

export interface Persona {
    id: string;
    settings: PersonaSettings;
}

const COLUMNS = 'id, project_id, metadata';
export const DEFAULT_PERSONA = { tone: 'warm' as Tone, style: '', language: 'customer' as Language, emoji: false };

function toPersona(row: Record<string, unknown> | null): Persona | null {
    const settings = row?.metadata as PersonaSettings | undefined;
    if (!row || settings?.kind !== 'persona') return null;
    return {
        id: row.id as string,
        settings: {
            ...settings,
            tone: settings.tone in TONES ? settings.tone : DEFAULT_PERSONA.tone,
            language: settings.language in LANGUAGES ? settings.language : DEFAULT_PERSONA.language,
            style: typeof settings.style === 'string' ? settings.style : '',
            emoji: settings.emoji === true,
        },
    };
}

export async function getPersona(db: Admin, projectId: string, agentId: string): Promise<Persona | null> {
    const { data } = await db.from('tool_connections').select(COLUMNS)
        .eq('project_id', projectId).eq('connector_slug', PERSONA_SLUG).eq('metadata->>agent_id', agentId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return toPersona(data as Record<string, unknown> | null);
}

/** What the profile shows and edits: the saved personality, or the defaults. */
export function publicPersona(persona: Persona | null) {
    const s = persona?.settings;
    return { tone: s?.tone ?? DEFAULT_PERSONA.tone, style: s?.style ?? '', language: s?.language ?? DEFAULT_PERSONA.language, emoji: s?.emoji ?? DEFAULT_PERSONA.emoji };
}

export async function savePersona(
    db: Admin,
    opts: { projectId: string; agentId: string; existing: Persona | null; tone?: unknown; style?: unknown; language?: unknown; emoji?: unknown },
): Promise<{ ok: true; persona: Persona } | { ok: false; message: string }> {
    const current = publicPersona(opts.existing);
    if (opts.tone !== undefined && !(typeof opts.tone === 'string' && opts.tone in TONES)) return { ok: false, message: 'Choose a tone.' };
    if (opts.language !== undefined && !(typeof opts.language === 'string' && opts.language in LANGUAGES)) return { ok: false, message: 'Choose a language.' };
    if (opts.style !== undefined && typeof opts.style !== 'string') return { ok: false, message: 'Describe how they talk in words.' };
    const style = typeof opts.style === 'string' ? opts.style.replace(/\s+/g, ' ').trim() : current.style;
    if (style.length > STYLE_MAX) return { ok: false, message: `Keep "how they talk" under ${STYLE_MAX} characters.` };
    const settings: PersonaSettings = {
        kind: 'persona',
        agent_id: opts.agentId,
        tone: (opts.tone as Tone | undefined) ?? current.tone,
        style,
        language: (opts.language as Language | undefined) ?? current.language,
        emoji: typeof opts.emoji === 'boolean' ? opts.emoji : current.emoji,
    };
    const write = opts.existing
        ? db.from('tool_connections').update({ metadata: settings }).eq('id', opts.existing.id).select(COLUMNS).single()
        : db.from('tool_connections').insert({ project_id: opts.projectId, connector_slug: PERSONA_SLUG, owner_type: 'platform', status: 'active', metadata: settings }).select(COLUMNS).single();
    const { data, error } = await write;
    const persona = toPersona(data as Record<string, unknown> | null);
    if (error || !persona) return { ok: false, message: "Couldn't save the personality. Try again." };
    return { ok: true, persona };
}

/** How the employee comes across, for its instructions: name, tone, how they talk, language, emoji. */
export function personaInstructions(name: string, settings: Pick<PersonaSettings, 'tone' | 'style' | 'language' | 'emoji'>): string {
    return [
        `WHO YOU ARE\nYour name is ${name}. Use this name; it replaces any other name for you above.`,
        `Personality: ${TONES[settings.tone]}`,
        settings.style ? `How you talk, in the owner's words: ${settings.style}` : null,
        LANGUAGES[settings.language],
        settings.emoji ? 'Use an emoji now and then where it fits.' : "Don't use emoji.",
    ].filter(Boolean).join('\n');
}

/** For a turn: the block, or nothing for an agent without a personality saved. */
export async function personaBlock(db: Admin, projectId: string, agentId: string): Promise<string> {
    const persona = await getPersona(db, projectId, agentId);
    if (!persona) return '';
    const { data: agent } = await db.from('agents').select('name').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    const name = (agent as { name?: string } | null)?.name;
    return name ? personaInstructions(name, persona.settings) : '';
}
