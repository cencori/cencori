// src/storage/index.ts
var VectorsNamespace = class {
  /**
   * Search vectors by query
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async search(query, options) {
    throw new Error(
      `cencori.storage.vectors.search() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
  /**
   * Upsert vectors
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async upsert(vectors) {
    throw new Error(
      `cencori.storage.vectors.upsert() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
  /**
   * Delete vectors by ID
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async delete(ids) {
    throw new Error(
      `cencori.storage.vectors.delete() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
};
var KnowledgeNamespace = class {
  /**
   * Query the knowledge base
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async query(question) {
    throw new Error(
      `cencori.storage.knowledge.query() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
  /**
   * Add documents to knowledge base
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async add(documents) {
    throw new Error(
      `cencori.storage.knowledge.add() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
};
var FilesNamespace = class {
  /**
   * Upload a file
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async upload(file, name) {
    throw new Error(
      `cencori.storage.files.upload() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
  /**
   * Process a file (extract text, OCR, etc.)
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async process(fileId) {
    throw new Error(
      `cencori.storage.files.process() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
};
var StorageNamespace = class {
  constructor() {
    /**
     * Vector database operations
     */
    this.vectors = new VectorsNamespace();
    /**
     * Knowledge base operations (RAG)
     */
    this.knowledge = new KnowledgeNamespace();
    /**
     * File storage and processing
     */
    this.files = new FilesNamespace();
  }
};
export {
  StorageNamespace
};
//# sourceMappingURL=index.mjs.map