import crypto from 'crypto';

export const KNOWLEDGE_CHUNK_SIZE = 1000;
export const KNOWLEDGE_CHUNK_OVERLAP = 100;
export const KNOWLEDGE_MAX_CHUNKS = 200;
export const KNOWLEDGE_MAX_FILE_BYTES = 8 * 1024 * 1024;

export function checksumText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

/** Deterministic chunking: 1000 chars / 100 overlap with sentence snap, mirrors dashboard upload. */
export function chunkKnowledgeText(input: string): string[] {
    const normalized = input.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    const chunks: string[] = [];
    let start = 0;
    while (start < normalized.length && chunks.length < KNOWLEDGE_MAX_CHUNKS) {
        let end = Math.min(start + KNOWLEDGE_CHUNK_SIZE, normalized.length);
        if (end < normalized.length) {
            const window = normalized.slice(start, end);
            const lastBreak = Math.max(window.lastIndexOf('. '), window.lastIndexOf('\n'), window.lastIndexOf('? '), window.lastIndexOf('! '));
            if (lastBreak > KNOWLEDGE_CHUNK_SIZE * 0.5) end = start + lastBreak + 1;
        }
        const piece = normalized.slice(start, end).trim();
        if (piece.length > 10) chunks.push(piece);
        if (end >= normalized.length) break;
        start = Math.max(end - KNOWLEDGE_CHUNK_OVERLAP, start + 1);
    }
    return chunks;
}

export function detectMime(filename: string, explicit?: string | null): string {
    if (explicit) return explicit;
    const lower = filename.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
    if (lower.endsWith('.csv')) return 'text/csv';
    if (lower.endsWith('.json')) return 'application/json';
    return 'text/plain';
}

export function isSupportedKnowledgeMime(mime: string): boolean {
    return [
        'text/plain',
        'text/markdown',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/html',
        'text/csv',
        'application/json',
    ].includes(mime.toLowerCase());
}

export function stripHtml(html: string): string {
    return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function extractKnowledgeText(buffer: Buffer, mime: string, filename: string): Promise<{ text: string; pages?: number }> {
    const lowerMime = mime.toLowerCase();
    if (lowerMime === 'application/pdf') {
        const mod = (await import('pdf-parse')) as unknown as { default?: (buf: Buffer) => Promise<{ text: string; numpages: number }> } & ((buf: Buffer) => Promise<{ text: string; numpages: number }>);
        const pdfParse = mod.default ?? (mod as unknown as (buf: Buffer) => Promise<{ text: string; numpages: number }>);
        const result = await pdfParse(buffer);
        return { text: result.text ?? '', pages: result.numpages };
    }
    if (lowerMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return { text: result.value ?? '' };
    }
    const text = buffer.toString('utf8');
    if (lowerMime === 'text/html') return { text: stripHtml(text) };
    if (lowerMime === 'application/json') {
        try {
            const parsed = JSON.parse(text);
            return { text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2) };
        } catch {
            return { text };
        }
    }
    void filename;
    return { text };
}
