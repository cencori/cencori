import { V as VectorSearchOptions } from '../types-Be_rWV2h.mjs';

/**
 * Storage Namespace - Vector Database, Knowledge Base, RAG
 *
 * 🚧 Coming Soon
 *
 * @example
 * const results = await cencori.storage.vectors.search('query', { limit: 5 });
 */

declare class VectorsNamespace {
    /**
     * Search vectors by query
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    search(query: string, options?: VectorSearchOptions): Promise<never>;
    /**
     * Upsert vectors
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    upsert(vectors: {
        id: string;
        values: number[];
        metadata?: Record<string, unknown>;
    }[]): Promise<never>;
    /**
     * Delete vectors by ID
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    delete(ids: string[]): Promise<never>;
}
declare class KnowledgeNamespace {
    /**
     * Query the knowledge base
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    query(question: string): Promise<never>;
    /**
     * Add documents to knowledge base
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    add(documents: {
        content: string;
        metadata?: Record<string, unknown>;
    }[]): Promise<never>;
}
declare class FilesNamespace {
    /**
     * Upload a file
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    upload(file: Blob | Buffer, name: string): Promise<never>;
    /**
     * Process a file (extract text, OCR, etc.)
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    process(fileId: string): Promise<never>;
}
declare class StorageNamespace {
    /**
     * Vector database operations
     */
    readonly vectors: VectorsNamespace;
    /**
     * Knowledge base operations (RAG)
     */
    readonly knowledge: KnowledgeNamespace;
    /**
     * File storage and processing
     */
    readonly files: FilesNamespace;
}

export { StorageNamespace };
