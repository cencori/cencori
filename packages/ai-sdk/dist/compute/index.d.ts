import { f as ComputeRunOptions } from '../types-Be_rWV2h.js';

/**
 * Compute Namespace - Serverless Functions & GPU Access
 *
 * 🚧 Coming Soon
 *
 * @example
 * const result = await cencori.compute.run('my-function', {
 *   input: { data: 'hello' }
 * });
 */

declare class ComputeNamespace {
    /**
     * Run a serverless function
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    run(functionId: string, options?: ComputeRunOptions): Promise<never>;
    /**
     * Deploy a function
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    deploy(config: {
        name: string;
        code: string;
    }): Promise<never>;
    /**
     * List deployed functions
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    list(): Promise<never>;
}

export { ComputeNamespace };
