/**
 * Judgment API — structured decisions from decision models.
 *
 * Send a state plus typed questions (noul / choice / score) and get back
 * probabilities — never generated text. Any `judgment`-type catalog model
 * works here through the same endpoint (TypeSafe's Jev today).
 *
 * @example
 *   const result = await cencori.judgment.judge({
 *       state: 'I was charged twice. Please refund the duplicate.',
 *       questions: {
 *           department: {
 *               type: 'choice',
 *               instructions: 'Which team should handle this?',
 *               criteria: { billing: 'Payments, invoicing, refunds', technical: 'Bugs, outages' },
 *           },
 *           requests_refund: { type: 'noul', instructions: 'Does the customer request a refund?' },
 *       },
 *   });
 *   console.log(result.answers.department.choice); // 'billing'
 *
 * @example
 *   const { data: models } = await cencori.judgment.listModels();
 */

import type { CencoriConfig } from '../types';

export type JudgmentQuestionType = 'noul' | 'choice' | 'score';

/** Text, a JSON object, or an array of text values. */
export type JudgmentState = string | Record<string, unknown> | unknown[];

export interface NoulQuestion {
    type: 'noul';
    instructions: string | Record<string, unknown>;
    criteria?: { true?: string | Record<string, unknown> | null; false?: string | Record<string, unknown> | null } | null;
}

export interface ChoiceQuestion {
    type: 'choice';
    instructions: string | Record<string, unknown>;
    /** 1–255 options: option name → rubric description (`null` needs none). */
    criteria: Record<string, string | Record<string, unknown> | null>;
}

export interface ScoreQuestion {
    type: 'score';
    instructions: string | Record<string, unknown>;
    /** 2–10 ordered level descriptions, lowest first. */
    criteria: string[];
}

export type JudgmentQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export interface JudgeRequest {
    /** What the questions are about: text, a JSON object, or an array. */
    state: JudgmentState;
    /** Non-empty map of question id → typed question. Answers come back under the same ids. */
    questions: Record<string, JudgmentQuestion>;
    /** Judgment model id. Default: `jev-latest`. */
    model?: string;
}

export interface NoulAnswer {
    type: 'noul';
    /** Probability the answer is yes, 0–1. */
    noul: number;
}

export interface ChoiceAnswer {
    type: 'choice';
    choice: string;
    confidence: number;
    probabilities: Record<string, number>;
}

export interface ScoreAnswer {
    type: 'score';
    score: number;
    confidence: number;
    legend: Record<string, string>;
    probabilities: Record<string, number>;
}

export type JudgmentAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface JudgmentUsage {
    input_tokens: number;
    output_tokens: number;
}

export interface JudgeResult {
    object: 'judgment';
    /** The model id that answered (aliases resolve upstream, e.g. `jev-latest` → `jev-1.13.0`). */
    model: string;
    answers: Record<string, JudgmentAnswer>;
    usage: JudgmentUsage;
    uses_byok?: boolean;
}

export interface JudgmentModelInfo {
    id: string;
    owned_by: string;
    type: 'judgment';
    context_window: number;
    available: boolean;
    unavailable_reason?: string;
    pricing: {
        input_per_million: number | null;
        output_per_million: number | null;
        currency: 'USD';
        input_display: string;
        output_display: string;
        note: string;
    };
}

export interface JudgmentModelsResponse {
    object: 'list';
    endpoint: string;
    context_tokens: number;
    data: JudgmentModelInfo[];
    question_types: JudgmentQuestionType[];
    default_model: string;
}

export class JudgmentNamespace {
    private config: Required<CencoriConfig>;

    constructor(config: Required<CencoriConfig>) {
        this.config = config;
    }

    /**
     * Judge a state against typed questions. Returns one answer per
     * question id with probabilities your code can branch on.
     */
    async judge(request: JudgeRequest): Promise<JudgeResult> {
        if (request.state === undefined || request.state === null) {
            throw new Error('judgment.judge requires `state`');
        }
        if (!request.questions || Object.keys(request.questions).length === 0) {
            throw new Error('judgment.judge requires a non-empty `questions` object');
        }
        const response = await fetch(`${this.config.baseUrl}/api/v1/judgments`, {
            method: 'POST',
            headers: {
                'CENCORI_API_KEY': this.config.apiKey,
                'Content-Type': 'application/json',
                ...this.config.headers,
            },
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            throw await this.error(response, 'judgment.judge');
        }
        return (await response.json()) as JudgeResult;
    }

    /** List the judgment models with their pricing. No API key required. */
    async listModels(): Promise<JudgmentModelsResponse> {
        const response = await fetch(`${this.config.baseUrl}/api/v1/judgments`, {
            headers: this.config.headers,
        });
        if (!response.ok) {
            throw await this.error(response, 'judgment.listModels');
        }
        return (await response.json()) as JudgmentModelsResponse;
    }

    private async error(response: Response, op: string): Promise<Error> {
        const data = await response.json().catch(() => ({}));
        const message =
            (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string')
                ? data.message
                : `${op} failed with status ${response.status}`;
        const code =
            (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string')
                ? data.error
                : 'request_failed';
        const err = new Error(message) as Error & { code?: string; details?: unknown };
        err.code = code;
        err.details = data;
        return err;
    }
}
