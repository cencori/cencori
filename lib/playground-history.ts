export interface HistoryMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    modelId?: string;
    metrics?: {
        costUsd: number;
        latencyMs: number;
        promptTokens: number;
        completionTokens: number;
    };
    isStreaming?: boolean;
}

export interface HistoryModelConfig {
    maxTokens: number;
    temperature: number;
    frequencyPenalty: number;
    presencePenalty: number;
}

export interface PlaygroundSession {
    id: string;
    title: string;
    messages: HistoryMessage[];
    selectedModels: string[];
    modelConfig: Record<string, HistoryModelConfig>;
    createdAt: number;
    updatedAt: number;
}

const STORAGE_KEY = 'cencori_playground_sessions';
const MAX_SESSIONS = 50;

export function getSessions(): PlaygroundSession[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as PlaygroundSession[];
    } catch {
        return [];
    }
}

export function saveSession(session: PlaygroundSession): void {
    try {
        const sessions = getSessions();
        const idx = sessions.findIndex((s) => s.id === session.id);
        const updated = { ...session, updatedAt: Date.now() };
        if (idx >= 0) {
            sessions[idx] = updated;
        } else {
            sessions.unshift(updated);
            if (sessions.length > MAX_SESSIONS) sessions.pop();
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch { /* localStorage full or unavailable */ }
}

export function deleteSession(id: string): PlaygroundSession[] {
    try {
        const sessions = getSessions().filter((s) => s.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        return sessions;
    } catch {
        return [];
    }
}

export function generateSessionId(): string {
    return crypto.randomUUID();
}
