import { describe, expect, it } from 'vitest';
import { applyApprovalPolicy, readApprovalPolicy, ruleForTool, validateApprovalPolicy } from '@/lib/embedded/approval-policy';

const fn = (name: string, needsApproval?: boolean) => ({ type: 'function', function: { name }, ...(needsApproval ? { needsApproval: true } : {}) });

describe('installation approval rules', () => {
    it('accepts auto, required and deny, and says what is wrong otherwise', () => {
        expect(validateApprovalPolicy(undefined)).toEqual({ ok: true });
        expect(validateApprovalPolicy({})).toEqual({ ok: true });
        expect(validateApprovalPolicy({ default: 'required', tools: { send_email: 'auto', drop_table: 'deny' } })).toEqual({ ok: true });
        expect(validateApprovalPolicy({ tools: { send_email: 'allow' } })).toMatchObject({ ok: false, message: expect.stringContaining('send_email') });
        expect(validateApprovalPolicy({ default: 'ask' })).toMatchObject({ ok: false });
        expect(validateApprovalPolicy({ tools: ['send_email'] })).toMatchObject({ ok: false });
        expect(validateApprovalPolicy('required')).toMatchObject({ ok: false });
    });

    it('picks the most specific rule: exact name, then longest prefix, then the default', () => {
        const policy = readApprovalPolicy({ default: 'required', tools: { 'gmail_*': 'auto', 'gmail_send_*': 'required', gmail_send_draft: 'deny' } });
        expect(ruleForTool(policy, 'gmail_send_draft')).toBe('deny');
        expect(ruleForTool(policy, 'gmail_send_email')).toBe('required');
        expect(ruleForTool(policy, 'gmail_list')).toBe('auto');
        expect(ruleForTool(policy, 'book_meeting')).toBe('required');
        expect(ruleForTool(readApprovalPolicy({ tools: { a: 'auto' } }), 'b')).toBeNull();
    });

    it('matches a hosted tool by its own name or the name the model sees', () => {
        const policy = readApprovalPolicy({ tools: { send_email: 'auto', conn__ab12cd34__deleteContact: 'deny' } });
        expect(ruleForTool(policy, 'mcp__9f8e7d6c__send_email')).toBe('auto');
        expect(ruleForTool(policy, 'conn__ab12cd34__deleteContact')).toBe('deny');
        expect(ruleForTool(policy, 'conn__ffffffff__deleteContact')).toBeNull();
    });

    it('removes denied tools, marks required ones, clears auto ones, and leaves the rest', () => {
        const tools = [fn('search'), fn('send_email', true), fn('delete_contact', true), fn('book_meeting'), { type: 'web_search_preview' }];
        const out = applyApprovalPolicy(tools, readApprovalPolicy({ tools: { send_email: 'auto', delete_contact: 'deny', book_meeting: 'required' } }));
        expect(out).toEqual([fn('search'), fn('send_email'), fn('book_meeting', true), { type: 'web_search_preview' }]);
    });

    it('changes nothing without rules, and ignores stored values that are not rules', () => {
        const tools = [fn('send_email', true)];
        expect(applyApprovalPolicy(tools, readApprovalPolicy({}))).toBe(tools);
        expect(applyApprovalPolicy(tools, readApprovalPolicy({ connection_id: 'con_1', tools: { send_email: 'sometimes' } }))).toBe(tools);
    });
});
