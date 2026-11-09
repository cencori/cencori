export interface ResolvedPrompt {
    content: string;
    rawContent: string;
    modelHint: string | null;
    temperature: number | null;
    maxTokens: number | null;
    promptId: string;
    versionId: string;
    version: number;
    promptName: string;
}
