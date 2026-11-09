/**
 * What run() can take besides text: messages with images and files.
 *
 * ```ts
 * await run(agent, [
 *     { role: 'user', content: [
 *         { type: 'input_text', text: 'What does this invoice owe?' },
 *         { type: 'input_file', filename: 'invoice.pdf', file_data: 'data:application/pdf;base64,...' },
 *         { type: 'input_image', image_url: 'https://example.com/receipt.jpg' },
 *     ] },
 * ]);
 * ```
 *
 * Same shape as OpenAI's Responses input. Images reach models that can see
 * them (a text-only model is swapped for one that can, for that turn); PDFs
 * and text files are read on Cencori and given to the model as text.
 */

export type InputContentPart =
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string; detail?: 'auto' | 'low' | 'high' }
    | { type: 'input_file'; filename: string; file_data: string };

export interface AgentInputItem {
    /** Optional, as in OpenAI's shorthand; Cencori treats { role, content } as a message. */
    type?: 'message';
    role: 'user';
    content: string | InputContentPart[];
}

export type AgentInput = string | AgentInputItem[];

/** The text in an input, for guardrails and anything else that reads words. */
export function inputText(input: AgentInput): string {
    if (typeof input === 'string') return input;
    return input
        .flatMap((item) => (typeof item.content === 'string' ? [item.content] : item.content.filter((p) => p.type === 'input_text').map((p) => (p as { text: string }).text)))
        .join('\n');
}

/** An image part from a URL or a data URL. */
export function image(url: string, detail?: 'auto' | 'low' | 'high'): InputContentPart {
    return { type: 'input_image', image_url: url, ...(detail ? { detail } : {}) };
}

/** A file part from bytes (Node Buffer / Uint8Array) or a data URL. */
export function file(filename: string, data: string | Uint8Array, mimeType = guessType(filename)): InputContentPart {
    if (typeof data === 'string') return { type: 'input_file', filename, file_data: data };
    let binary = '';
    for (const b of data) binary += String.fromCharCode(b);
    return { type: 'input_file', filename, file_data: `data:${mimeType};base64,${btoa(binary)}` };
}

function guessType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', csv: 'text/csv', json: 'application/json', md: 'text/markdown', txt: 'text/plain' } as Record<string, string>)[ext] ?? 'application/octet-stream';
}
