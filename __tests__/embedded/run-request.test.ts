import { describe, expect, it } from 'vitest';
import { decodeRunRequest, encodeRunRequest, isRunResponseFormat } from '@/lib/embedded/run-request';
import { dePrefixId, withPrefix } from '@/lib/embedded/http';
import { TENANT_PREFIX, USER_PREFIX } from '@/lib/embedded/types';

describe('embedded resource IDs', () => {
    it('returns canonical tenant and user IDs that round-trip', () => {
        expect(withPrefix(TENANT_PREFIX, 'abc')).toBe('ten_abc');
        expect(withPrefix(USER_PREFIX, 'abc')).toBe('usr_abc');
        expect(dePrefixId('ten_abc')).toBe('abc');
        expect(dePrefixId('usr_abc')).toBe('abc');
    });

    it('accepts previously returned double-underscore IDs', () => {
        expect(dePrefixId('ten__abc')).toBe('abc');
        expect(dePrefixId('usr__abc')).toBe('abc');
    });
});

describe('run request persistence', () => {
    const format = {
        type: 'json_schema' as const,
        json_schema: { name: 'answer', schema: { type: 'object', properties: { selected: { type: 'string' } }, required: ['selected'], additionalProperties: false } },
    };

    it('preserves the complete input and response schema separately', () => {
        const input = { messages: [{ role: 'system', content: 'padding '.repeat(1200) }, { role: 'user', content: 'FINAL-USER-7482' }] };
        const decoded = decodeRunRequest(encodeRunRequest(input, format));
        expect(decoded.input).toEqual(input);
        expect(JSON.stringify(decoded.input)).toContain('FINAL-USER-7482');
        expect(decoded.responseFormat).toEqual(format);
    });

    it('continues to read old input-only run rows', () => {
        expect(decodeRunRequest({ prompt: 'hello' })).toEqual({ input: { prompt: 'hello' } });
    });

    it('rejects malformed schema requests', () => {
        expect(isRunResponseFormat({ type: 'json_schema', json_schema: {} })).toBe(false);
        expect(isRunResponseFormat(format)).toBe(true);
    });
});
