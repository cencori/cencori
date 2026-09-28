type StreamTimeoutOptions = {
    signal?: AbortSignal;
    timeoutMs?: number;
    /** Transport heartbeats cannot keep a stream with no decoded progress alive forever. */
    maxPendingMs?: number;
};

/** Bounds network silence and heartbeat-only stalls, without limiting total stream duration. */
export async function* streamWithTimeout<T>(
    createStream: (signal: AbortSignal, reportActivity: () => void) => AsyncIterable<T>,
    label: string,
    options: StreamTimeoutOptions = {},
): AsyncGenerator<T> {
    const timeoutMs = options.timeoutMs ?? 60_000;
    const maxPendingMs = options.maxPendingMs ?? 180_000;
    const controller = new AbortController();
    const signal = options.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal;
    let resetIdle: (() => void) | undefined;
    // SDKs discard SSE comments. Count real bytes even when they contain no model delta.
    const iterator = createStream(signal, () => resetIdle?.())[Symbol.asyncIterator]();
    try {
        while (true) {
            signal.throwIfAborted();
            let idleTimer: ReturnType<typeof setTimeout> | undefined;
            let progressTimer: ReturnType<typeof setTimeout> | undefined;
            let onAbort: (() => void) | undefined;
            const clearDeadline = () => {
                resetIdle = undefined;
                clearTimeout(idleTimer);
                clearTimeout(progressTimer);
                if (onAbort) signal.removeEventListener('abort', onAbort);
            };
            try {
                const aborted = new Promise<never>((_, reject) => {
                    onAbort = () => reject(signal.reason);
                    signal.addEventListener('abort', onAbort, { once: true });
                    resetIdle = () => {
                        clearTimeout(idleTimer);
                        if (!signal.aborted) {
                            idleTimer = setTimeout(() => {
                                controller.abort(new Error(`${label} next chunk timed out after ${timeoutMs}ms`));
                            }, timeoutMs);
                        }
                    };
                    resetIdle();
                    progressTimer = setTimeout(() => {
                        controller.abort(new Error(`${label} made no stream progress after ${maxPendingMs}ms`));
                    }, maxPendingMs);
                });
                const next = await Promise.race([iterator.next(), aborted]);
                if (next.done) return;
                // Output guards and caller processing are not provider silence.
                clearDeadline();
                yield next.value;
            } finally {
                clearDeadline();
            }
        }
    } finally {
        controller.abort();
        // return() can queue behind the stalled next(). Do not block error settlement on it.
        try {
            void Promise.resolve(iterator.return?.()).catch(() => {});
        } catch {
            // Cleanup failures must not replace the original stream error.
        }
    }
}
