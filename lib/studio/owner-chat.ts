/**
 * The owner's one conversation with their employee (Studio): a single thread
 * per owner per business that never resets, so the employee remembers what
 * was said last week. Every message is stamped with when it was sent, and the
 * employee sees those stamps in the business's time zone, so it knows what
 * "yesterday" means and how long it's been. Older messages fold into a
 * running summary (summarizeThread), and each reply sees the summary plus the
 * latest messages, so a long thread stays quick.
 *
 * One thread per employee: the owner can talk to any of their staff, each
 * with their own conversation. Threads from before that (no agent_id) are
 * the main employee's, so no history was lost.
 *
 * Stored like owner alerts, on a project tool_connections row per owner and
 * employee (connector_slug = 'owner-chat'), so it needs no migration.
 */
import type { createAdminClient } from '@/lib/supabaseAdmin';

type Admin = ReturnType<typeof createAdminClient>;

export const OWNER_CHAT_SLUG = 'owner-chat';
/** Messages each reply sees word for word; older ones it sees through the summary. */
export const RECENT_MESSAGES = 30;
/** When this many messages haven't been summarised, the oldest fold in, down to RECENT_MESSAGES. */
export const SUMMARIZE_AT = 50;
/** Kept on the row at most (summarised ones go first): enough to scroll back through. */
const KEEP_MESSAGES = 400;
const SUMMARY_MAX = 6_000;

export type ChatActionState = 'pending' | 'running' | 'done' | 'failed' | 'cancelled' | 'expired';
export type ChatNoteState = 'saved' | 'undoing' | 'undone' | 'failed';

export interface StoredAction {
    id: string;
    title: string;
    state: ChatActionState;
    result?: string;
    /** The whole proposal, so the app can show it again after reopening. */
    proposal: Record<string, unknown>;
}

export interface StoredNote {
    id: string;
    fact: string;
    agent_id: string;
    agent_name: string;
    state: ChatNoteState;
}

export interface StoredMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    /** When it was sent (ISO). */
    at: string;
    /** The app's notes to the employee (an action's outcome), not something the owner typed. */
    hidden?: boolean;
    actions?: StoredAction[];
    notes?: StoredNote[];
}

export interface ThreadSettings {
    kind: 'owner_chat';
    user_id: string;
    /** The employee this conversation is with; absent on threads from before there was one per employee (the main one's). */
    agent_id?: string;
    messages: StoredMessage[];
    /** Everything before the first unsummarised message, in a few paragraphs, with dates. */
    summary: string | null;
    /** How many of `messages` (from the start) the summary covers. */
    summarized: number;
}

export interface Thread {
    id: string | null;
    projectId: string;
    settings: ThreadSettings;
}

const COLUMNS = 'id, project_id, metadata';

/** Which employee's thread: theirs, and for the main one also the thread from before there was one per employee. */
export type ThreadKey = { agentId: string; main: boolean };

export interface StaffMember { id: string; name: string; live: boolean }

/** The staff in the AI tab's order: live ones first, then oldest first. The first is the main employee. */
export async function studioStaff(db: Admin, projectId: string): Promise<StaffMember[]> {
    const { data } = await db.from('agents').select('id, name, is_active, stable_version_id, created_at').eq('project_id', projectId).order('created_at', { ascending: true });
    return ((data ?? []) as Array<{ id: string; name: string; is_active: boolean; stable_version_id: string | null }>)
        .map((agent) => ({ id: agent.id, name: agent.name, live: !!agent.stable_version_id && agent.is_active }))
        .sort((a, b) => Number(b.live) - Number(a.live));
}

function emptyThread(projectId: string, userId: string, key?: ThreadKey): Thread {
    return { id: null, projectId, settings: { kind: 'owner_chat', user_id: userId, ...(key ? { agent_id: key.agentId } : {}), messages: [], summary: null, summarized: 0 } };
}

/** The thread a key names, among one owner's threads in a business (newest first). */
export function pickThread<T extends { metadata: ThreadSettings | null }>(rows: T[], key?: ThreadKey): T | null {
    const threads = rows.filter((row) => row.metadata?.kind === 'owner_chat');
    if (!key) return threads[0] ?? null;
    return threads.find((row) => row.metadata?.agent_id === key.agentId)
        ?? (key.main ? threads.find((row) => !row.metadata?.agent_id) ?? null : null);
}

export async function getThread(db: Admin, projectId: string, userId: string, key?: ThreadKey): Promise<Thread> {
    const { data } = await db.from('tool_connections').select(COLUMNS)
        .eq('project_id', projectId).eq('connector_slug', OWNER_CHAT_SLUG).eq('metadata->>user_id', userId)
        .order('created_at', { ascending: false }).limit(50);
    const row = pickThread((data ?? []) as Array<{ id: string; metadata: ThreadSettings | null }>, key);
    if (!row || row.metadata?.kind !== 'owner_chat') return emptyThread(projectId, userId, key);
    const settings = row.metadata;
    return {
        id: row.id,
        projectId,
        settings: {
            ...settings,
            // The main employee's old thread becomes theirs by name once it's written again.
            ...(key ? { agent_id: key.agentId } : {}),
            messages: Array.isArray(settings.messages) ? settings.messages : [],
            summary: typeof settings.summary === 'string' ? settings.summary : null,
            summarized: Number.isInteger(settings.summarized) ? settings.summarized : 0,
        },
    };
}

/** Write the thread back, trimming the oldest summarised messages past KEEP_MESSAGES. */
export async function saveThread(db: Admin, thread: Thread): Promise<Thread> {
    const settings = { ...thread.settings };
    const over = settings.messages.length - KEEP_MESSAGES;
    if (over > 0) {
        const drop = Math.min(over, settings.summarized);
        settings.messages = settings.messages.slice(drop);
        settings.summarized -= drop;
    }
    const write = thread.id
        ? db.from('tool_connections').update({ metadata: settings }).eq('id', thread.id).select('id').single()
        : db.from('tool_connections').insert({ project_id: thread.projectId, connector_slug: OWNER_CHAT_SLUG, owner_type: 'platform', status: 'active', metadata: settings }).select('id').single();
    const { data, error } = await write;
    if (error || !data) throw new Error('Could not save the conversation.');
    return { ...thread, id: (data as { id: string }).id, settings };
}

/** Change one message's action or saved fact (its state after the owner confirmed or undid it). */
export function patchMessage(thread: Thread, messageId: string, change: { actionId?: string; noteId?: string; state: string; result?: string }): boolean {
    const message = thread.settings.messages.find((item) => item.id === messageId);
    if (!message) return false;
    if (change.actionId) {
        const action = message.actions?.find((item) => item.id === change.actionId);
        if (!action || !ACTION_STATES.has(change.state)) return false;
        action.state = change.state as ChatActionState;
        if (change.result !== undefined) action.result = change.result.slice(0, 500);
        return true;
    }
    if (change.noteId) {
        const note = message.notes?.find((item) => item.id === change.noteId);
        if (!note || !NOTE_STATES.has(change.state)) return false;
        note.state = change.state as ChatNoteState;
        return true;
    }
    return false;
}

const ACTION_STATES = new Set(['pending', 'running', 'done', 'failed', 'cancelled', 'expired']);
const NOTE_STATES = new Set(['saved', 'undoing', 'undone', 'failed']);

/** "Fri 31 Oct, 2:05 pm" in the business's time zone. */
export function stamp(at: string, timeZone: string): string {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return '';
    const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
    const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(date).replace(/\s?([ap])m$/i, ' $1m').toLowerCase();
    return `${day}, ${time}`;
}

/** What a message carries besides its words, for the employee to read: the actions and saved facts, and how they ended. */
function extras(message: StoredMessage): string[] {
    return [
        ...(message.actions ?? []).map((action) => `[${action.title}: ${action.state}${action.result ? ` — ${action.result}` : ''}]`),
        ...(message.notes ?? []).map((note) => `[Saved for customers (${note.agent_name}): "${note.fact}"${note.state === 'undone' ? " — the owner undid this, so it's no longer told to customers" : ''}]`),
    ];
}

/**
 * The thread as the employee sees it: the summary, then the latest messages,
 * the owner's each starting with when they sent it. The employee's own
 * replies carry no stamp (it would start writing them), and what they
 * proposed or saved is noted after them.
 */
export function threadContext(thread: Thread, timeZone: string): { summary: string | null; messages: Array<{ role: 'user' | 'assistant'; content: string }> } {
    const recent = thread.settings.messages.slice(Math.max(thread.settings.summarized, thread.settings.messages.length - RECENT_MESSAGES));
    return {
        summary: thread.settings.summary,
        messages: recent.map((message) => ({
            role: message.role,
            content: message.role === 'user'
                ? `[${stamp(message.at, timeZone)}]${message.hidden ? ' (from the app, not typed by the owner)' : ''} ${message.content}`
                : [message.content, ...extras(message)].filter(Boolean).join('\n'),
        })),
    };
}

/** What's waiting to fold into the summary, oldest first, or nothing yet. */
export function toSummarize(thread: Thread): StoredMessage[] {
    const unsummarized = thread.settings.messages.length - thread.settings.summarized;
    if (unsummarized < SUMMARIZE_AT) return [];
    return thread.settings.messages.slice(thread.settings.summarized, thread.settings.messages.length - RECENT_MESSAGES);
}

/** The prompt that folds `batch` into the running summary. */
export function summaryPrompt(previous: string | null, batch: StoredMessage[], timeZone: string): string {
    const lines = batch.map((message) => `${stamp(message.at, timeZone)} ${message.role === 'user' ? (message.hidden ? 'App' : 'Owner') : 'Employee'}: ${[message.content, ...extras(message)].filter(Boolean).join(' ').slice(0, 1_500)}`);
    return `You keep the running summary of a business owner's conversation with their employee (an AI that serves their customers and helps run the business). Update it with the messages below.

Keep what matters later: decisions and instructions the owner gave, facts about the business, the people and customers mentioned, things promised or still to do, and what was done (with the date it happened). Keep dates (e.g. "On Tue 28 Oct the owner…"). Drop greetings and small talk. Plain prose or short bullets, under 600 words, written as notes for the employee.

PREVIOUS SUMMARY
${previous ?? '(none yet)'}

NEW MESSAGES
${lines.join('\n')}

Reply with only the updated summary.`;
}

/** Fold the messages that summary covered: called with the model's reply to summaryPrompt. */
export function applySummary(thread: Thread, batch: StoredMessage[], summary: string): Thread {
    if (!batch.length || !summary.trim()) return thread;
    return { ...thread, settings: { ...thread.settings, summary: summary.trim().slice(0, SUMMARY_MAX), summarized: thread.settings.summarized + batch.length } };
}

/** For the app: the latest messages to show, oldest first, with their stamps and states. */
export function publicThread(thread: Thread, limit = 100) {
    return {
        messages: thread.settings.messages.slice(-limit),
        has_older: thread.settings.messages.length > limit,
    };
}
