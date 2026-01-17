import { W as WorkflowTriggerOptions } from '../types-Be_rWV2h.js';

/**
 * Workflow Namespace - AI Pipelines & Orchestration
 *
 * 🚧 Coming Soon
 *
 * @example
 * await cencori.workflow.trigger('data-enrichment', {
 *   data: { userId: '123' }
 * });
 */

declare class WorkflowNamespace {
    /**
     * Trigger a workflow
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    trigger(workflowId: string, options?: WorkflowTriggerOptions): Promise<never>;
    /**
     * Create a new workflow
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    create(config: {
        name: string;
        steps: unknown[];
    }): Promise<never>;
    /**
     * Get workflow run status
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    status(runId: string): Promise<never>;
    /**
     * List workflows
     *
     * 🚧 Coming Soon - This feature is not yet available.
     */
    list(): Promise<never>;
}

export { WorkflowNamespace };
