type StreamTimeoutOptions = {
    signal?: AbortSignal;
    timeoutMs?: number;
};

/** Bounds silence between provider chunks, without limiting a healthy stream's total duration. */
export async function* streamWithTimeout<T>(
    createStream: (signal: AbortSignal) => AsyncIterable<T>,
    label: string,
    options: StreamTimeoutOptions = {},
): AsyncGenerator<T> {
    const timeoutMs = options.timeoutMs ?? 60_000;
    const controller = new AbortController();
    const signal = options.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal;
    const iterator = createStream(signal)[Symbol.asyncIterator]();
    try {
        while (true) {
            signal.throwIfAborted();
            let timer: ReturnType<typeof setTimeout> | undefined;
            let onAbort: (() => void) | undefined;
            try {
                const aborted = new Promise<never>((_, reject) => {
                    onAbort = () => reject(signal.reason);
                    signal.addEventListener('abort', onAbort, { once: true });
                    timer = setTimeout(() => {
                        controller.abort(new Error(`${label} next chunk timed out after ${timeoutMs}ms`));
                    }, timeoutMs);
                });
                const next = await Promise.race([iterator.next(), aborted]);
                if (next.done) return;
                // Stop the idle clock while the caller processes this chunk (e.g. output guards).
                clearTimeout(timer);
                if (onAbort) signal.removeEventListener('abort', onAbort);
                yield next.value;
            } finally {
                clearTimeout(timer);
                if (onAbort) signal.removeEventListener('abort', onAbort);
            }
        }
    } finally {
        controller.abort();
        // An async generator queues return() behind its pending next(). Awaiting it after a
        // timeout waits on the exact read that stalled, so the client never receives the error.
        // Abort provider HTTP work above and observe cleanup errors without blocking settlement.
        try {
            void Promise.resolve(iterator.return?.()).catch(() => {});
        } catch {
            // Synchronous cleanup failures must not replace the original stream error either.
        }
    }
}
