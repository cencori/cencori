import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
    CreateSessionParams,
    Session,
    SessionListParams,
} from '../../packages/sdk/src/sessions';

describe('TypeScript SDK session contract', () => {
    it('exposes tenant, user, and installation scope when creating and reading sessions', () => {
        const create: CreateSessionParams = {
            agent_id: 'agt_support',
            tenant_id: 'ten_acme',
            external_user_id: 'user_42',
            installation_id: 'ins_support',
        };
        const list: SessionListParams = { tenant_id: 'ten_acme' };

        expect(create.tenant_id).toBe('ten_acme');
        expect(list.tenant_id).toBe('ten_acme');
        expectTypeOf<Session['tenant_id']>().toEqualTypeOf<string | null>();
        expectTypeOf<Session['external_user_id']>().toEqualTypeOf<string | null>();
        expectTypeOf<Session['installation_id']>().toEqualTypeOf<string | null>();
    });
});
