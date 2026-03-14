export interface CacheConfig {
    cacheEnabled: boolean;
    exactMatchEnabled: boolean;
    semanticMatchEnabled: boolean;
    ttlSeconds: number;
    similarityThreshold: number;
    maxEntries: number;
    excludedModels: string[];
    maxCacheableTemperature: number;
}

export interface CacheLookupResult {
    hit: boolean;
    hitType: 'exact' | 'semantic' | null;
    response: any | null;
    entryId: string | null;
    similarityScore: number | null;
    embedding: number[] | null;
}

export interface CacheStoreParams {
    projectId: string;
    cacheKey: string;
    promptText: string;
    model: string;
    temperature: number | undefined;
    maxTokens: number | undefined;
    response: any;
    embedding: number[] | null;
    ttlSeconds: number;
    estimatedTokens: number;
    estimatedCostUsd: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
    cacheEnabled: false,
    exactMatchEnabled: true,
    semanticMatchEnabled: false,
    ttlSeconds: 3600,
    similarityThreshold: 0.95,
    maxEntries: 10000,
    excludedModels: [],
    maxCacheableTemperature: 0.2,
};
