import { describe, expect, it } from 'vitest';
import { buildSpans, formatTick, niceTicks, packLanes, traceBounds } from '@/lib/sessions/trace-spans';
import type { TimelineTurn } from '@/lib/sessions/observability';

const at = (ms: number) => new Date(Date.UTC(2026, 10, 8, 12, 0, 0, ms)).toISOString();
const turn = (n: number, start: number, end: number | null, extra: Partial<TimelineTurn> = {}): TimelineTurn => ({
    turn: n, model: 'gpt-oss-120b', startedAt: at(start), endedAt: end === null ? null : at(end), durationMs: end === null ? null : end - start,
    input: null, resumedFrom: null, text: '', toolCalls: [], status: end === null ? 'running' : 'completed', pauseReason: null, resolution: null,
    error: null, usage: null, agent: null,
    trace: { requestId: null, provider: null, model: null, usedFallback: false, costUsd: null, ttftMs: null, modelMs: null, rounds: null },
    ...extra,
});

describe('trace spans', () => {
    const turns = [
        turn(1, 0, 900, {
            agent: 'Triage', status: 'paused',
            toolCalls: [{ id: 'h1', name: 'transfer_to_billing', arguments: '', result: 'ok', handoff: true, needsApproval: false, executedBy: 'caller', startedAt: at(900), endedAt: at(1100), durationMs: 200, resolution: null }],
        }),
        turn(2, 1100, 2000, {
            agent: 'Billing', status: 'paused',
            toolCalls: [{ id: 'r1', name: 'issue_refund', arguments: '{}', result: null, handoff: false, needsApproval: true, executedBy: 'caller', startedAt: at(2000), endedAt: at(5000), durationMs: 3000, resolution: 'rejected' }],
        }),
        turn(3, 5000, 5600, { agent: 'Billing' }),
    ];

    it('builds the session > model call > tool hierarchy on one axis', () => {
        const spans = buildSpans('Support', turns, [{ id: 's2', status: 'completed', agent: 'Researcher', created_at: at(1200), updated_at: at(1800) }], 'active');
        expect(spans.map((s) => [s.id, s.kind, s.depth, s.parentId])).toEqual([
            ['session', 'session', 0, null],
            ['turn:1', 'generation', 1, 'session'],
            ['tool:h1', 'handoff', 2, 'turn:1'],
            ['turn:2', 'generation', 1, 'session'],
            ['tool:r1', 'tool', 2, 'turn:2'],
            ['turn:3', 'generation', 1, 'session'],
            ['agent:s2', 'agent', 1, 'session'],
        ]);
        expect(spans[1]).toMatchObject({ name: 'Triage · turn 1', detail: 'gpt-oss-120b' });
        expect(spans[2]).toMatchObject({ name: '→ billing', detail: 'handoff' });
        expect(spans[4]).toMatchObject({ status: 'rejected', detail: 'your code' });
        // The session ends with its last span.
        expect(spans[0].end! - spans[0].start).toBe(5600);
        expect(traceBounds(spans)).toMatchObject({ span: 5600 });
    });

    it('packs non-overlapping spans of a depth into one lane', () => {
        const spans = buildSpans('S', turns, [{ id: 's2', status: 'completed', agent: 'R', created_at: at(1200), updated_at: at(1800) }], 'completed');
        const lanes = packLanes(spans);
        expect(lanes.map((lane) => lane.map((s) => s.id))).toEqual([
            ['session'],
            ['turn:1', 'turn:2', 'turn:3'],
            ['agent:s2'], // overlaps turn 2, so a second lane at depth 1
            ['tool:h1', 'tool:r1'],
        ]);
    });

    it('keeps a running session open', () => {
        const spans = buildSpans('S', [turn(1, 0, null)], [], 'active');
        expect(spans[0].end).toBeNull();
        expect(traceBounds(spans, Date.parse(at(3000))).span).toBe(3000);
    });

    it('picks readable ruler ticks', () => {
        expect(niceTicks(67.92)).toEqual([0, 20, 40, 60]);
        expect(niceTicks(5600)).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
        expect(formatTick(0)).toBe('0');
        expect(formatTick(20)).toBe('20ms');
        expect(formatTick(1500)).toBe('1.5s');
        expect(formatTick(2000)).toBe('2s');
    });
});
