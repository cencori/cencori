function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // Return immediately if request succeeded or if it's a client error (4xx)
            if (response.ok || (response.status >= 400 && response.status < 500)) {
                return response;
            }

            // Retry on 5xx errors
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

            // Don't retry on last attempt
            if (attempt === maxRetries - 1) {
                return response;
            }

            // Exponential backoff: 1s, 2s, 4s
            await sleep(Math.pow(2, attempt) * 1000);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Don't retry on last attempt
            if (attempt === maxRetries - 1) {
                throw lastError;
            }

            // Exponential backoff
            await sleep(Math.pow(2, attempt) * 1000);
        }
    }

    throw lastError || new Error('Max retries reached');
}
