import { describe, expect, it } from 'vitest';
import { decodeRunRequest, encodeRunRequest, isRunResponseFormat, sameRunRequestBody, stableStringify } from '@/lib/embedded/run-request';
import { dePrefixId, withPrefix } from '@/lib/embedded/http';
import { PROVIDER_CONNECTION_PREFIX, PROVIDER_SYNC_PREFIX, TENANT_PREFIX, USER_PREFIX } from '@/lib/embedded/types';

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
        expect(dePrefixId('prc__abc')).toBe('abc');
        expect(dePrefixId('pms__abc')).toBe('abc');
        expect(dePrefixId('mcp__abc')).toBe('abc');
    });

    it('round-trips MCP server IDs issued at registration', () => {
        const uuid = '6c8b4af4-dcf3-4bd3-8629-179b4a0bf824';
        expect(withPrefix('mcp', uuid)).toBe(`mcp_${uuid}`);
        // The exact failure from the field: id-routes 404d on the registered id.
        expect(dePrefixId(`mcp_${uuid}`)).toBe(uuid);
        expect(dePrefixId(uuid)).toBe(uuid);
    });

    it('emits single-separator provider IDs and round-trips double-prefixed input', () => {
        const uuid = '1c4a8041-cd14-48ea-9c4f-28ec3795cba2';
        expect(withPrefix(PROVIDER_CONNECTION_PREFIX, uuid)).toBe(`prc_${uuid}`);
        // Legacy constant form with trailing underscore must not double up.
        expect(withPrefix('prc_', uuid)).toBe(`prc_${uuid}`);
        expect(withPrefix(PROVIDER_SYNC_PREFIX, uuid)).toBe(`pms_${uuid}`);
        // Double-prefixed IDs seen in the wild normalize to single.
        expect(withPrefix(PROVIDER_CONNECTION_PREFIX, `prc__${uuid}`)).toBe(`prc_${uuid}`);
        expect(dePrefixId(`prc_${uuid}`)).toBe(uuid);
        expect(dePrefixId(`prc__${uuid}`)).toBe(uuid);
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
