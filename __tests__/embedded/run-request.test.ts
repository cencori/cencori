import { describe, expect, it } from 'vitest';
import { decodeRunRequest, encodeRunRequest, isRunResponseFormat, sameRunRequestBody, stableStringify } from '@/lib/embedded/run-request';
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

    it('compares idempotency bodies independent of key order (jsonb round-trip)', () => {
        const input = { b: 1, a: { y: 2, x: 1 }, prompt: 'hello' };
        const encoded = encodeRunRequest(input, undefined, 'background');
        // Simulate Postgres jsonb key reordering on read-back.
        const reordered = { mode: 'background', input: { prompt: 'hello', a: { x: 1, y: 2 }, b: 1 }, __cencori_run_request_v1: true };
        expect(JSON.stringify(encoded) === JSON.stringify(reordered)).toBe(false);
        expect(stableStringify(encoded)).toBe(stableStringify(reordered));
        expect(sameRunRequestBody(reordered, encoded)).toBe(true);
    });

    it('rejects genuinely different bodies', () => {
        const a = encodeRunRequest({ prompt: 'one' }, undefined, 'background');
        const b = encodeRunRequest({ prompt: 'two' }, undefined, 'background');
        expect(sameRunRequestBody(b, a)).toBe(false);
    });
});
