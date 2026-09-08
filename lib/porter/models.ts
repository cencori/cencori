/**
 * The models a Porter may answer with.
 *
 * Short on purpose. The catalog carries over a hundred, and a support agent choosing between them
 * is a decision nobody asked for -- these are the ones that make sense for answering questions from
 * a handful of pages, and every id is verified present in lib/providers/config.ts.
 *
 * Auto is the default and stays first: it is what a Porter is created with, and the honest answer
 * for a customer who has no opinion.
 */
export const PORTER_MODELS = [
    { id: null, name: "Auto", note: "Cencori picks — fast and free" },
    { id: "groq/compound", name: "Compound", note: "Free, quick, served on Cencori's own account" },
    { id: "dots-studio/dots-3-note-preview:free", name: "Dots 3 Note", note: "Free, 512k context" },
    { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", note: "Frontier, costs more per answer" },
    { id: "claude-sonnet-5", name: "Claude Sonnet 5", note: "Frontier, strong at following instructions" },
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", note: "Fast, inexpensive" },
] as const;

export const PORTER_MODEL_IDS: string[] = PORTER_MODELS.flatMap((model) =>
    model.id === null ? [] : [model.id as string]
);
