/**
 * A business's profile, as its owner gives it when creating the business in
 * Studiowave: what kind of business (up to 3 categories), when it's open,
 * where it is (or that it has no physical location), its website and a short
 * description. One `tool_connections` row per project (connector_slug
 * 'business-profile'). Every staff member is told it on each customer turn
 * (businessBriefing), so the owner never has to teach hours or the address.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export const BUSINESS_PROFILE_SLUG = 'business-profile';

export const BUSINESS_CATEGORIES = [
    'Restaurant & food', 'Fashion & clothing', 'Beauty, hair & salon', 'Health & wellness', 'Medical & clinic',
    'Shopping & retail', 'Grocery store', 'Electronics & gadgets', 'Events & entertainment', 'Hotel & short-let',
    'Real estate', 'Education', 'Travel & transport', 'Professional services', 'Repairs & home services',
    'Automotive', 'Fitness & gym', 'Photography & media', 'Other business',
] as const;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SETS_MAX = 3;

export type HoursMode = 'selected' | 'always' | 'appointments';
/** One opening, "09:00" to "18:00". */
export type HoursSet = { open: string; close: string };

export interface BusinessProfile {
    categories: string[];
    hours: { mode: HoursMode; days: HoursSet[][] };
    address: string | null;
    no_location: boolean;
    website: string | null;
    description: string | null;
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const clock = (value: unknown): string | null => {
    const match = typeof value === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(value.trim()) : null;
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59 || hours * 60 + minutes > 24 * 60) return null;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/** A profile as sent, made safe: unknown categories, broken hours and bad links are dropped. */
export function cleanProfile(raw: unknown): BusinessProfile {
    const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const categories = (Array.isArray(input.categories) ? input.categories : [])
        .filter((value): value is string => typeof value === 'string' && (BUSINESS_CATEGORIES as readonly string[]).includes(value))
        .filter((value, index, all) => all.indexOf(value) === index)
        .slice(0, 3);
    const hoursInput = (input.hours && typeof input.hours === 'object' ? input.hours : {}) as { mode?: unknown; days?: unknown };
    const mode: HoursMode = hoursInput.mode === 'selected' || hoursInput.mode === 'appointments' ? hoursInput.mode : 'always';
    const days = Array.from({ length: 7 }, (_, index) => {
        const sets = Array.isArray(hoursInput.days) && Array.isArray(hoursInput.days[index]) ? hoursInput.days[index] as unknown[] : [];
        return sets
            .map((set) => {
                const open = clock((set as HoursSet | null)?.open);
                const close = clock((set as HoursSet | null)?.close);
                return open && close && close > open ? { open, close } : null;
            })
            .filter((set): set is HoursSet => !!set)
            .slice(0, SETS_MAX);
    });
    const noLocation = input.no_location === true;
    let website: string | null = text(input.website, 300) || null;
    if (website) {
        if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
        try {
            const url = new URL(website);
            website = url.hostname.includes('.') ? url.toString().replace(/\/$/, '') : null;
        } catch {
            website = null;
        }
    }
    return {
        categories,
        hours: { mode, days: mode === 'selected' ? days : Array.from({ length: 7 }, () => []) },
        address: noLocation ? null : text(input.address, 300) || null,
        no_location: noLocation,
        website,
        description: (typeof input.description === 'string' ? input.description.trim().slice(0, 512) : '') || null,
    };
}

export async function getBusinessProfile(db: Admin, projectId: string): Promise<{ id: string; profile: BusinessProfile } | null> {
    const { data } = await db.from('tool_connections').select('id, metadata').eq('project_id', projectId).eq('connector_slug', BUSINESS_PROFILE_SLUG).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const metadata = data?.metadata as { kind?: string; profile?: unknown } | undefined;
    if (!data || metadata?.kind !== 'business_profile') return null;
    return { id: data.id as string, profile: cleanProfile(metadata.profile) };
}

export async function saveBusinessProfile(db: Admin, projectId: string, raw: unknown): Promise<BusinessProfile | null> {
    const profile = cleanProfile(raw);
    const existing = await getBusinessProfile(db, projectId);
    const metadata = { kind: 'business_profile', profile, updated_at: new Date().toISOString() };
    const { error } = existing
        ? await db.from('tool_connections').update({ metadata }).eq('id', existing.id)
        : await db.from('tool_connections').insert({ project_id: projectId, connector_slug: BUSINESS_PROFILE_SLUG, owner_type: 'platform', status: 'active', metadata });
    return error ? null : profile;
}

/** "9am", "5:30pm". */
function twelveHour(value: string): string {
    const [hours, minutes] = value.split(':').map(Number);
    return `${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}${hours < 12 || hours === 24 ? 'am' : 'pm'}`;
}

/** The week as people say it: "Monday to Friday 9am to 6pm; Saturday 10am to 4pm; closed Sunday". */
export function describeBusinessHours(hours: BusinessProfile['hours']): string {
    if (hours.mode === 'always') return 'Open 24 hours, every day';
    if (hours.mode === 'appointments') return 'By appointment only';
    const order = [1, 2, 3, 4, 5, 6, 0];
    const label = (sets: HoursSet[]) => (sets.length ? sets.map((set) => `${twelveHour(set.open)} to ${twelveHour(set.close)}`).join(' and ') : '');
    const groups: Array<{ days: number[]; label: string }> = [];
    for (const day of order) {
        const current = label(hours.days[day] ?? []);
        const last = groups.at(-1);
        if (last && last.label === current) last.days.push(day);
        else groups.push({ days: [day], label: current });
    }
    return groups.map(({ days, label: value }) => {
        const names = days.length > 2 ? `${DAY_NAMES[days[0]]} to ${DAY_NAMES[days.at(-1)!]}` : days.map((day) => DAY_NAMES[day]).join(' and ');
        return value ? `${names} ${value}` : `closed ${names}`;
    }).join('; ');
}

/** What every staff member is told about the business they work in, on each customer turn. */
export async function businessBriefing(db: Admin, projectId: string): Promise<string> {
    const [found, { data: project }] = await Promise.all([
        getBusinessProfile(db, projectId).catch(() => null),
        db.from('projects').select('name').eq('id', projectId).maybeSingle(),
    ]);
    if (!found) return '';
    const { profile } = found;
    return [
        `The business you work for: ${(project?.name as string | undefined) ?? 'the business'}.`,
        profile.categories.length ? `- What it is: ${profile.categories.join(', ')}.` : null,
        profile.description ? `- About it, in the owner's words: ${profile.description}` : null,
        `- Hours: ${describeBusinessHours(profile.hours)}.`,
        profile.no_location ? '- It has no physical location (online, or it comes to the customer).' : profile.address ? `- Where: ${profile.address}.` : null,
        profile.website ? `- Website: ${profile.website}` : null,
    ].filter(Boolean).join('\n');
}
