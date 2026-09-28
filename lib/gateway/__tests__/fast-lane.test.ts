import { describe, expect, it } from 'vitest';
import {
    buildPassthroughInputPipeline,
    isFastLaneBody,
    isFastLaneRequest,
} from '@/lib/gateway/fast-lane';

describe('fast-lane passthrough', () => {
    it('is opt-in through body flags or headers', () => {
        expect(isFastLaneBody({})).toBe(false);
        expect(isFastLaneBody({ passthrough: true })).toBe(true);
        expect(isFastLaneBody({ fast_lane: true })).toBe(true);
        expect(isFastLaneBody({ passthrough: false })).toBe(false);

        const headers = new Headers();
        expect(isFastLaneRequest({}, headers)).toBe(false);
        headers.set('x-cencori-passthrough', 'true');
        expect(isFastLaneRequest({}, headers)).toBe(true);

        const fastHeaders = new Headers({ 'x-cencori-fast-lane': 'TRUE' });
        expect(isFastLaneRequest({}, fastHeaders)).toBe(true);

        // Body alone opts in, headers not required.
        expect(isFastLaneRequest({ passthrough: true }, new Headers())).toBe(true);
    });

    it('builds a pass-through input pipeline that skips guards', () => {
        const messages = [
            { role: 'user' as const, content: 'hello' },
            { role: 'assistant' as const, content: 'hi' },
            { role: 'user' as const, content: 'second turn' },
        ];
        const pipeline = buildPassthroughInputPipeline(messages);

        expect(pipeline.ok).toBe(true);
        if (!pipeline.ok) throw new Error('expected ok');
        expect(pipeline.messages).toBe(messages);
        expect(pipeline.inputText).toBe('second turn');
        expect(pipeline.inputSecurity.safe).toBe(true);
        expect(pipeline.customRules.rules).toEqual([]);
        expect(pipeline.customRules.inputResult.shouldBlock).toBe(false);
        expect(pipeline.tokenMap).toBeUndefined();
        expect(pipeline.route).toBeUndefined();
    });
});
