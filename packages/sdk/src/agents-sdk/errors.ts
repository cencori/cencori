/** Base class for errors thrown by cencori/agents. */
export class AgentsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AgentsError';
    }
}

/** The run used up maxTurns model calls without a final answer. */
export class MaxTurnsExceededError extends AgentsError {
    readonly sessionId: string;
    constructor(maxTurns: number, sessionId: string) {
        super(`The run exceeded maxTurns (${maxTurns}) without a final answer. Raise maxTurns or check for a tool loop.`);
        this.name = 'MaxTurnsExceededError';
        this.sessionId = sessionId;
    }
}

/** A guardrail's tripwire fired; the run stopped. */
export class GuardrailTripwireTriggered extends AgentsError {
    readonly guardrail: string;
    readonly kind: 'input' | 'output';
    readonly outputInfo: unknown;
    constructor(kind: 'input' | 'output', guardrail: string, outputInfo: unknown) {
        super(`${kind === 'input' ? 'Input' : 'Output'} guardrail "${guardrail}" tripped.`);
        this.name = kind === 'input' ? 'InputGuardrailTripwireTriggered' : 'OutputGuardrailTripwireTriggered';
        this.guardrail = guardrail;
        this.kind = kind;
        this.outputInfo = outputInfo;
    }
}

/**
 * Cencori refused or failed a request, or the turn failed (a project policy
 * blocked it, the model provider errored, credits ran out...).
 */
export class CencoriRunError extends AgentsError {
    readonly status?: number;
    readonly code?: string;
    readonly sessionId?: string;
    constructor(message: string, details: { status?: number; code?: string; sessionId?: string } = {}) {
        super(message);
        this.name = 'CencoriRunError';
        this.status = details.status;
        this.code = details.code;
        this.sessionId = details.sessionId;
    }
}
