/**
 * What the traces list shows for a session's first message.
 *
 * Attached files reach the model as their text ("[Attached file: q3.pdf]\n..."),
 * and that's what the turn stores, so the agent keeps the file in later turns.
 * The list shows only what the user wrote, and the files by name.
 */

const ATTACHED = /\n?\[Attached file: ([^\]\n]+)\]\n/g;

export function sessionPreview(input: string | null | undefined): { text: string | null; files: string[] } {
    if (!input) return { text: null, files: [] };
    const files: string[] = [];
    let first = -1;
    for (const match of input.matchAll(ATTACHED)) {
        if (first === -1) first = match.index ?? 0;
        files.push(match[1].trim());
    }
    const text = (first === -1 ? input : input.slice(0, first)).replace(/\s+/g, ' ').trim();
    return { text: text ? text.slice(0, 200) : null, files };
}
