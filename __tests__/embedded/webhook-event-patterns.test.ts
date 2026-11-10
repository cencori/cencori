import { describe, expect, it } from 'vitest';
import { webhookEventPatterns } from '@/lib/webhooks/deliver';

describe('webhook subscription matching', () => {
    it('matches the exact event, its family wildcard, and the catch-all', () => {
        expect(webhookEventPatterns('run.completed')).toEqual(['run.completed', 'run.*', '*']);
        expect(webhookEventPatterns('knowledge_source.ready')).toEqual(['knowledge_source.ready', 'knowledge_source.*', '*']);
    });

    it('does not invent a family for a name without one', () => {
        expect(webhookEventPatterns('ping')).toEqual(['ping', '*']);
    });
});
