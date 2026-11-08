/** What tools, guardrails and dynamic instructions receive during a run. */
export interface RunContext<Ctx = unknown> {
    /** Your own value from run(..., { context }): a user, a db handle, anything. Never sent to Cencori. */
    context: Ctx;
    /**
     * The Cencori session this run lives in. Empty in input guardrails and
     * instructions of a new run: the session is created with its first turn.
     */
    sessionId: string;
    /** Name of the agent currently answering. */
    agentName: string;
    /** Aborts with the run. */
    signal?: AbortSignal;
}
