import { describe, expect, it } from 'vitest';
import { asNestedFunctionTool, unnamedFunctionToolIndex } from '@/lib/gateway/function-tools';

describe('function tool shapes', () => {
    const parameters = { type: 'object', properties: { city: { type: 'string' } } };

    it('rewrites a Responses-style tool into the nested shape', () => {
        expect(asNestedFunctionTool({ type: 'function', name: 'weather', description: 'Look it up', parameters, needsApproval: true }))
            .toEqual({ type: 'function', function: { name: 'weather', description: 'Look it up', parameters }, needsApproval: true });
    });

    it('leaves nested and built-in tools alone', () => {
        const nested = { type: 'function', function: { name: 'weather', description: '', parameters } };
        const builtIn = { type: 'web_search' };
        expect(asNestedFunctionTool(nested)).toBe(nested);
        expect(asNestedFunctionTool(builtIn)).toBe(builtIn);
    });

    it('points at a function tool that has no name', () => {
        const tools = [{ type: 'web_search' }, asNestedFunctionTool({ type: 'function', name: 'ok', parameters }), { type: 'function' }];
        expect(unnamedFunctionToolIndex(tools)).toBe(2);
        expect(unnamedFunctionToolIndex(tools.slice(0, 2))).toBe(-1);
    });
});
