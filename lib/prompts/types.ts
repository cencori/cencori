export interface PromptRegistryEntry {
    id: string;
    project_id: string;
    name: string;
    slug: string;
    description: string | null;
    tags: string[];
    active_version_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface PromptVersion {
    id: string;
    prompt_id: string;
    version: number;
    content: string;
    model_hint: string | null;
    temperature: number | null;
    max_tokens: number | null;
    variables: string[];
    change_message: string | null;
    created_by: string | null;
    created_at: string;
}

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
