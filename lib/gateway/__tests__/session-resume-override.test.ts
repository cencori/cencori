import { describe, it, expect } from 'vitest';
import { applyInstructionsOverride, parseResumeOverride } from '@/lib/gateway/session-resume-override';

describe('parseResumeOverride', () => {
    it('accepts nothing', () => {
        expect(parseResumeOverride(undefined)).toEqual({ ok: true, value: undefined });
    });

    it('normalizes function tools and keeps needsApproval only when true', () => {
        const parsed = parseResumeOverride({
            instructions: 'You handle billing.',
            model: ' gpt-4o ',
            tools: [
                { type: 'function', function: { name: 'issue_refund' }, needsApproval: true },
                { type: 'function', function: { name: 'get_invoice', description: 'Find one', parameters: { type: 'object' } }, needsApproval: 'yes' },
            ],
        });
        expect(parsed).toEqual({ ok: true, value: {
            instructions: 'You handle billing.',
            model: 'gpt-4o',
            tools: [
                { type: 'function', function: { name: 'issue_refund', description: '', parameters: { type: 'object', properties: {} } }, needsApproval: true },
                { type: 'function', function: { name: 'get_invoice', description: 'Find one', parameters: { type: 'object' } } },
            ],
        } });
    });

    it.each([
        ['a string', 'billing'],
        ['a bad tool name', { tools: [{ type: 'function', function: { name: 'has space' } }] }],
        ['a non-function tool', { tools: [{ type: 'web_search' }] }],
        ['an empty model', { model: '  ' }],
        ['too many tools', { tools: Array.from({ length: 129 }, (_, i) => ({ type: 'function', function: { name: `t${i}` } })) }],
    ])('rejects %s', (_label, raw) => {
        expect(parseResumeOverride(raw).ok).toBe(false);
    });
});

describe('applyInstructionsOverride', () => {
    const messages = [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Hi' },
    ];

    it('replaces the system message that held the previous instructions', () => {
        expect(applyInstructionsOverride(messages, 'Be brief.', 'You handle billing.')).toEqual([
            { role: 'system', content: 'You handle billing.' },
            { role: 'user', content: 'Hi' },
        ]);
    });

    it('leads with the new instructions when the old ones are not found', () => {
        expect(applyInstructionsOverride(messages, undefined, 'New.')[0]).toEqual({ role: 'system', content: 'New.' });
        expect(applyInstructionsOverride(messages, undefined, 'New.')).toHaveLength(3);
    });
});
