/**
 * In-process abort registry for embedded runs.
 *
 * Cancellation flips the run row (durable, cross-instance), but an already
 * running provider HTTP call only stops if its process holds an abort
 * signal. Executors register one controller per running run; the cancel
 * route aborts it best-effort. Same-instance in-flight work stops promptly
 * and the failover loop suppresses retries/fallbacks on abort (see
 * chat-executor signal checks); other instances rely on the conditional
 * terminal writes, which a concurrent cancel always wins.
 */

const controllers = new Map<string, AbortController>();

export function registerRunController(runId: string, controller: AbortController): void {
    controllers.set(runId, controller);
}

export function unregisterRunController(runId: string): void {
    controllers.delete(runId);
}

export function isRunAborted(runId: string): boolean {
    return controllers.get(runId)?.signal.aborted ?? false;
}

/** Abort the in-flight controller for a run, if this process holds one. */
export function abortRun(runId: string): boolean {
    const controller = controllers.get(runId);
    if (!controller || controller.signal.aborted) return false;
    controller.abort();
    return true;
}
