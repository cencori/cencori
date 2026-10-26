import { describe, expect, it } from 'vitest';
import { fillPlaceholders } from '@/components/dashboard/CopilotActionCard';

describe('Copilot multi-step actions', () => {
    it('fills ids from earlier steps into later paths and bodies', () => {
        const step = { method: 'POST', path: '/api/projects/p1/embedded-agents/{{agent_id}}/knowledge', body: { version_id: '{{version_id}}', name: 'Menu', text: 'Asun {{not_a_var}}' } };
        expect(fillPlaceholders(step, { agent_id: 'a-123', version_id: 'v-9' })).toEqual({
            method: 'POST',
            path: '/api/projects/p1/embedded-agents/a-123/knowledge',
            body: { version_id: 'v-9', name: 'Menu', text: 'Asun {{not_a_var}}' },
        });
    });

    it('leaves text with quotes and newlines intact', () => {
        const body = { text: 'Jollof "special"\nChapman ₦3,500' };
        expect(fillPlaceholders(body, {})).toEqual(body);
    });
});
