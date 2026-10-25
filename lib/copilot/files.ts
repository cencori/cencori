/**
 * Text files attached to Copilot messages. Read in the browser and sent beside
 * the message text, then folded into the prompt by the agent route. Shared so
 * the composer and the server enforce the same limits.
 */

export interface CopilotFile {
    name: string;
    /** Text files: their text. Images: the vision description, once made. */
    content: string;
    kind?: "text" | "image";
    /** Images only, and only until described: the downscaled image itself. */
    dataUrl?: string;
    /**
     * Images only: a small preview kept with the message (and saved with the
     * chat) so the picture stays visible after it's described. Never sent to
     * the model.
     */
    thumbnail?: string;
}

/**
 * Images ride along as data URLs on the message being sent, are described by a
 * vision model on the server, and from then on travel (and are saved) as that
 * description. The gateway refuses images alongside tool calls, which Copilot
 * always needs, so the description step is what lets every model "see" them.
 */
export const COPILOT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const COPILOT_IMAGES_PER_MESSAGE = 3;
/** Longest edge after the browser downscales an image. */
export const COPILOT_IMAGE_MAX_EDGE = 1600;
/** ~3 MB of base64; a downscaled screenshot is usually well under 1 MB. */
export const COPILOT_IMAGE_MAX_DATA_URL_CHARS = 3_000_000;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/** Characters per file (~100 KB of text, roughly 25K tokens). */
export const COPILOT_FILE_MAX_CHARS = 100_000;
export const COPILOT_FILES_PER_MESSAGE = 5;
/**
 * File characters per request, across the whole conversation sent. Newest
 * files win; older ones past the budget are dropped with a note, so a long
 * chat with attachments can't grow every request without bound.
 */
export const COPILOT_FILES_REQUEST_BUDGET = 300_000;

/** What the file picker offers. Anything readable as UTF-8 text also works when dropped. */
export const COPILOT_FILE_ACCEPT = [
    ".txt", ".log", ".csv", ".tsv", ".json", ".jsonl", ".md", ".mdx", ".yaml", ".yml", ".toml", ".ini", ".env",
    ".xml", ".html", ".css", ".sql", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".rb",
    ".php", ".java", ".kt", ".swift", ".sh", ".graphql", ".prisma",
].join(",");

/** Binary files decode with NUL characters; text never has them. */
export function looksLikeText(content: string): boolean {
    return !content.slice(0, 8_000).includes("\u0000");
}

/**
 * Validates and trims what a client sent; anything malformed is dropped.
 * Returns text files plus images that already have a description; images still
 * waiting for one come back from {@link sanitizeImages}.
 */
export function sanitizeFiles(value: unknown): CopilotFile[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((file): file is CopilotFile =>
            Boolean(file) && typeof file.name === "string" && typeof file.content === "string"
            && !(file.kind === "image" && !file.content))
        .slice(0, COPILOT_FILES_PER_MESSAGE)
        .map((file) => ({
            name: file.name.slice(0, 200),
            content: file.content.slice(0, COPILOT_FILE_MAX_CHARS),
            kind: file.kind === "image" ? "image" as const : "text" as const,
        }));
}

/** Images on a message that still need describing: well-formed data URLs only. */
export function sanitizeImages(value: unknown): { name: string; dataUrl: string }[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((file): file is CopilotFile =>
            Boolean(file) && file.kind === "image" && typeof file.name === "string" && typeof file.dataUrl === "string"
            && !file.content
            && file.dataUrl.length <= COPILOT_IMAGE_MAX_DATA_URL_CHARS && IMAGE_DATA_URL.test(file.dataUrl))
        .slice(0, COPILOT_IMAGES_PER_MESSAGE)
        .map((file) => ({ name: file.name.slice(0, 200), dataUrl: file.dataUrl as string }));
}

/** The message text with its files appended as tagged blocks the model can cite by name. */
export function withFiles(text: string, files: CopilotFile[], omitted: string[] = []): string {
    const blocks = files.map((file) => {
        const name = file.name.replace(/"/g, "'");
        return file.kind === "image"
            ? `<image name="${name}">\nDescription of the attached image:\n${file.content}\n</image>`
            : `<file name="${name}">\n${file.content}\n</file>`;
    });
    const notes = omitted.map((name) => `[Attached file "${name}" was left out: too much file content in this conversation.]`);
    return [text, ...blocks, ...notes].filter(Boolean).join("\n\n");
}
