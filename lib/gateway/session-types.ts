import type { ResponsesRequest } from '@/lib/gateway/v1-responses-execute';
import type { MemoryDirectiveInput } from '@/lib/memory';
import type { SecurityCheckResult } from '@/lib/safety/multi-layer-check';

export type SessionEventType =
    | 'turn.started'
    | 'output_text.delta'
    | 'tool_call.started'
    | 'tool_call.completed'
    | 'turn.paused'
    | 'turn.resumed'
    | 'turn.completed'
    | 'turn.failed'
    | 'turn.checkpoint';

export interface SessionEventPayloadMap {
    'turn.started': { turn_number: number; model: string; instructions?: string; input_text?: string; input_messages?: Array<{ role: string; content: string | null }>; input_security?: SecurityCheckResult; input_token_map?: Record<string, string> };
    'output_text.delta': { delta: string; index?: number };
    // `arguments` and `output` are optional because the stateless /v1/responses path records the
    // shape of a turn without duplicating its content: the prompt, the response and the tool
    // arguments are already written to ai_requests, masked by the project's own rules. Copying them
    // here would mean a second copy of the most sensitive text in the system and a second masking
    // path to keep in step with the first. The timeline carries what ai_requests cannot: ordering,
    // and how long each step took.
    'tool_call.started': { tool: string; arguments?: Record<string, unknown>; action_id?: string; call_id?: string; arguments_bytes?: number };
    'tool_call.completed': { tool?: string; output?: unknown; action_id?: string; call_id?: string; output_bytes?: number };
    /**
     * reason: 'approval_required' = a needsApproval tool was called and a human must rule;
     * 'tool_results_required' = only the caller's own tools were called, run them and resume.
     * Pauses recorded before 2026-11 always say 'approval_required' and carry no needs_approval.
     */
    'turn.paused': { reason: 'approval_required' | 'tool_results_required' | (string & {}); action_id: string; tool: string; arguments: Record<string, unknown>; actions?: Array<{ action_id: string; tool: string; arguments: string; needs_approval?: boolean }> };
    'turn.resumed': { action_id: string; resolution: 'approved' | 'rejected' };
    'turn.completed': { turn_number: number; output?: unknown; usage?: { input_tokens: number; output_tokens: number; total_tokens: number }; knowledge_citations?: Array<{ chunk_id: string; source_id: string; ord?: number | null; score: number }> };
    'turn.failed': { turn_number: number; output: { error: string }; usage: { input_tokens: number; output_tokens: number; total_tokens: number } };
    'turn.checkpoint': { turn_number: number; messages: Array<{ role: string; content: string | null }> };
}

export interface TurnRequestBody {
    input: ResponsesRequest['input'];
    tools?: ResponsesRequest['tools'];
    instructions?: string;
    agent_id?: string;
    model?: string;
    temperature?: number;
    max_output_tokens?: number;
    top_p?: number;
    tool_choice?: ResponsesRequest['tool_choice'];
    response_format?: ResponsesRequest['response_format'];
    store?: boolean;
    metadata?: Record<string, string>;
    user?: string;
    stream?: boolean;
    parallel_tool_calls?: boolean;
    truncation?: 'auto' | 'disabled';
    pause_on_tool_calls?: boolean;
    /** Gateway memory directive — presence opts the turn into memory (retrieve + write). */
    memory?: MemoryDirectiveInput;
    /** How hard a reasoning model thinks; lower is faster. An installed agent's own setting wins. */
    reasoning_effort?: 'none' | 'low' | 'medium' | 'high';
    /** Give the model the built-in render_ui tool, so it can answer with UI (widgets). */
    widgets?: boolean;
}

export interface CreateSessionRequest {
    /** Run this first turn in the same request; the response is the turn's stream. */
    turn?: Record<string, unknown>;
    agent_id?: string;
    metadata?: Record<string, unknown>;
    /** M0 embedded scope (secret-key path only; ect_ tokens derive this from claims). */
    tenant_id?: string;
    installation_id?: string;
    external_user_id?: string;
}

