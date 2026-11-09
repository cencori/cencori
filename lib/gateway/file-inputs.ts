import 'server-only';
import type { GatewayContext } from '@/lib/gateway-middleware';

/**
 * Files attached to a turn, made readable by any model: a PDF's text (via
 * the Documents extractor) or a text file's contents replace the file part
 * before the turn reaches the model, so attachments work whether or not the
 * model takes files natively. Images stay as images.
 *
 *   { type: 'input_file', filename: 'q3.pdf', file_data: 'data:application/pdf;base64,...' }
 *     → { type: 'input_text', text: '[Attached file: q3.pdf]\n...' }
 */

export const MAX_FILES_PER_TURN = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_PER_FILE = 60_000;

const TEXT_TYPES = /^(text\/|application\/(json|xml|csv|x-yaml|yaml|x-ndjson|javascript|typescript))/;
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|ndjson|xml|ya?ml|log|html?|js|ts|tsx|jsx|py|sql)$/i;

type Part = Record<string, unknown>;

export interface InlinedInput {
    input: unknown;
    /** Whether the turn carries an image (for routing to a model that can see). */
    hasImage: boolean;
    /** Names of the files that were read. */
    files: string[];
}

export async function inlineFileParts(input: unknown, ctx: GatewayContext): Promise<InlinedInput> {
    const state = { hasImage: false, files: [] as string[], count: 0 };
    if (!Array.isArray(input)) return { input, hasImage: false, files: [] };

    const out = [];
    for (const item of input) {
        // OpenAI's shorthand message ({ role, content } with no type) is a message.
        const message = item && typeof item === 'object' && typeof (item as Part).role === 'string' && (item as Part).type === undefined
            ? { type: 'message', ...(item as Part) }
            : item;
        if (message && typeof message === 'object' && Array.isArray((message as Part).content)) {
            const content = [];
            for (const part of (message as Part).content as Part[]) content.push(await convert(part, ctx, state));
            out.push({ ...(message as Part), content });
        } else if (message !== item) {
            out.push(message);
        } else if (item && typeof item === 'object') {
            out.push(await convert(item as Part, ctx, state));
        } else {
            out.push(item);
        }
    }
    return { input: out, hasImage: state.hasImage, files: state.files };
}

async function convert(part: Part, ctx: GatewayContext, state: { hasImage: boolean; files: string[]; count: number }): Promise<Part> {
    const type = part?.type;
    if (type === 'input_image' || type === 'image_url' || type === 'image') {
        state.hasImage = true;
        return part;
    }
    if (type !== 'input_file' && type !== 'file') return part;

    const filename = typeof part.filename === 'string' ? part.filename.slice(0, 200) : 'file';
    const note = (text: string) => ({ type: 'input_text', text: `[Attached file: ${filename}]\n${text}` });
    if (++state.count > MAX_FILES_PER_TURN) return note(`(Not read: at most ${MAX_FILES_PER_TURN} files per message.)`);

    const decoded = decodeDataUrl(typeof part.file_data === 'string' ? part.file_data : '');
    if (!decoded) return note('(Not read: the file must be sent as a base64 data URL in file_data.)');
    if (decoded.bytes.length > MAX_FILE_BYTES) return note(`(Not read: larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.)`);

    // An image sent as a file is still an image.
    if (decoded.mimeType.startsWith('image/')) {
        state.hasImage = true;
        state.files.push(filename);
        return { type: 'input_image', image_url: `data:${decoded.mimeType};base64,${decoded.bytes.toString('base64')}` };
    }

    try {
        let text: string;
        if (decoded.mimeType === 'application/pdf' || /\.pdf$/i.test(filename)) {
            const { extractDocument } = await import('@/lib/documents/extract');
            const extracted = await extractDocument(ctx, { bytes: decoded.bytes, mimeType: 'application/pdf', filename });
            text = extracted.text;
        } else if (TEXT_TYPES.test(decoded.mimeType) || TEXT_EXTENSIONS.test(filename)) {
            text = decoded.bytes.toString('utf8');
        } else {
            return note(`(Not read: ${decoded.mimeType || 'this type'} isn't supported. Send PDFs, images or text files.)`);
        }
        state.files.push(filename);
        const trimmed = text.length > MAX_TEXT_PER_FILE ? `${text.slice(0, MAX_TEXT_PER_FILE)}\n…(truncated)` : text;
        return note(trimmed.trim() || '(The file is empty.)');
    } catch (error) {
        return note(`(Couldn't read this file: ${error instanceof Error ? error.message : 'unknown error'})`);
    }
}

function decodeDataUrl(value: string): { mimeType: string; bytes: Buffer } | null {
    const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(value);
    if (!match) return null;
    try {
        const bytes = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
        return { mimeType: (match[1] || 'application/octet-stream').toLowerCase(), bytes };
    } catch {
        return null;
    }
}

/** Models that can't see images; a turn with images on one of these switches to VISION_FALLBACK_MODEL. */
const TEXT_ONLY_MODELS = /(^|\/)gpt-oss-|(^|\/)llama-3\.[0-3]-|(^|\/)llama3-/i;
export const VISION_FALLBACK_MODEL = 'claude-haiku-4-5';

export function textOnlyModel(model: string): boolean {
    return TEXT_ONLY_MODELS.test(model);
}
