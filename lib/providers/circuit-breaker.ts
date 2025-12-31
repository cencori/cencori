/**
 * Circuit Breaker Pattern for Provider Failover
 * 
 * Tracks provider health and prevents cascading failures
 * by opening circuit when failure threshold is reached.
 */

interface CircuitState {
    failures: number;
    lastFailure: number;
    state: 'closed' | 'open' | 'half-open';
    lastSuccess: number;
}

// In-memory circuit state (reset on cold start)
// For production, consider Redis for shared state across instances
const circuits: Map<string, CircuitState> = new Map();

// Configuration
const FAILURE_THRESHOLD = 5;       // Failures before circuit opens
const TIMEOUT_MS = 60 * 1000;      // 60 seconds circuit open time
const HALF_OPEN_MAX_REQUESTS = 1;  // Requests allowed in half-open state

/**
 * Get or create circuit state for a provider
 */
function getCircuit(provider: string): CircuitState {
    if (!circuits.has(provider)) {
        circuits.set(provider, {
            failures: 0,
            lastFailure: 0,
            state: 'closed',
            lastSuccess: Date.now(),
        });
    }
    return circuits.get(provider)!;
}

/**
 * Check if the circuit is open (provider should not be used)
 */
export function isCircuitOpen(provider: string): boolean {
    const circuit = getCircuit(provider);

    // If circuit is open, check if timeout has passed
    if (circuit.state === 'open') {
        const timeSinceFailure = Date.now() - circuit.lastFailure;

        if (timeSinceFailure >= TIMEOUT_MS) {
            // Transition to half-open (allow one test request)
            circuit.state = 'half-open';
            console.log(`[CircuitBreaker] ${provider}: Open → Half-Open (timeout elapsed)`);
            return false; // Allow the test request
        }

        return true; // Circuit still open
    }

    return false; // Circuit closed or half-open
}

/**
 * Record a successful request to a provider
 */
export function recordSuccess(provider: string): void {
    const circuit = getCircuit(provider);

    if (circuit.state === 'half-open') {
        // Test request succeeded, close the circuit
        circuit.state = 'closed';
        circuit.failures = 0;
        console.log(`[CircuitBreaker] ${provider}: Half-Open → Closed (success)`);
    }

    circuit.lastSuccess = Date.now();
}

/**
 * Record a failed request to a provider
 */
export function recordFailure(provider: string): void {
    const circuit = getCircuit(provider);

    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (circuit.state === 'half-open') {
        // Test request failed, reopen circuit
        circuit.state = 'open';
        console.log(`[CircuitBreaker] ${provider}: Half-Open → Open (test failed)`);
    } else if (circuit.failures >= FAILURE_THRESHOLD) {
        // Threshold reached, open circuit
        circuit.state = 'open';
        console.log(`[CircuitBreaker] ${provider}: Closed → Open (${circuit.failures} failures)`);
    }
}

/**
 * Get current circuit state for monitoring
 */
export function getCircuitState(provider: string): CircuitState {
    return getCircuit(provider);
}

/**
 * Get health status for all providers
 */
export function getAllCircuitStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    circuits.forEach((state, provider) => {
        states[provider] = { ...state };
    });
    return states;
}

/**
 * Reset circuit for a provider (manual intervention)
 */
export function resetCircuit(provider: string): void {
    circuits.set(provider, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        lastSuccess: Date.now(),
    });
    console.log(`[CircuitBreaker] ${provider}: Reset to Closed`);
}
