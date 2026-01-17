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

import type { ComputeRunOptions } from '../types';

export class ComputeNamespace {
    /**
     * Run a serverless function
     * 
     * 🚧 Coming Soon - This feature is not yet available.
     */
    async run(functionId: string, options?: ComputeRunOptions): Promise<never> {
        throw new Error(
            `cencori.compute.run() is coming soon! ` +
            `Function "${functionId}" cannot be executed yet. ` +
            `Join our waitlist at https://cencori.com/compute`
        );
    }

    /**
     * Deploy a function
     * 
     * 🚧 Coming Soon - This feature is not yet available.
     */
    async deploy(config: { name: string; code: string }): Promise<never> {
        throw new Error(
            `cencori.compute.deploy() is coming soon! ` +
            `Join our waitlist at https://cencori.com/compute`
        );
    }

    /**
     * List deployed functions
     * 
     * 🚧 Coming Soon - This feature is not yet available.
     */
    async list(): Promise<never> {
        throw new Error(
            `cencori.compute.list() is coming soon! ` +
            `Join our waitlist at https://cencori.com/compute`
        );
    }
}
