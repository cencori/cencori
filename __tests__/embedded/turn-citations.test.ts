import { describe, expect, it } from 'vitest';
import {
    buildKnowledgeBlock,
    retrieveTurnKnowledge,
    TURN_KNOWLEDGE_MAX_CITATIONS,
} from '@/lib/embedded/turn-knowledge';

describe('turn knowledge citations', () => {
    it('builds a numbered citation block', () => {
        const block = buildKnowledgeBlock(['Refunds take 30 days.', 'Contact support.']);
        expect(block).toContain('[1] Refunds take 30 days.');
        expect(block).toContain('[2] Contact support.');
    });

    it('returns null block for no snippets', () => {
        expect(buildKnowledgeBlock([])).toBeNull();
    });

    it('returns empty citations without an installation', async () => {
        const result = await retrieveTurnKnowledge({} as never, {
            projectId: 'p',
            organizationId: 'o',
            installationId: null,
            queryText: 'refund policy',
        });
        expect(result).toEqual({ block: null, citations: [] });
    });

    it('returns empty citations for blank queries', async () => {
        const result = await retrieveTurnKnowledge({} as never, {
            projectId: 'p',
            organizationId: 'o',
            installationId: 'ins_1',
            queryText: '   ',
        });
        expect(result.citations).toEqual([]);
    });

    it('caps citations at the configured maximum', () => {
        expect(TURN_KNOWLEDGE_MAX_CITATIONS).toBeLessThanOrEqual(5);
    });
});
