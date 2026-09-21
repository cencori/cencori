/**
 * Embedded Agents quickstart: multi-tenant company copilot.
 *
 * Run with: CENCORI_API_KEY=csk_... npx tsx examples/embedded-copilot.ts
 */
import { Cencori } from '../src/index';

async function main() {
    const cencori = new Cencori({});

    // 1. Unified registry (invokable-only for pickers)
    const { data: models } = await cencori.models.list({ available: true });
    console.log(`invokable models: ${models.length}`);

    // 2. Tenant (idempotent)
    const tenant = await cencori.tenants.create(
        { external_id: 'company_123', name: 'Acme Nigeria Ltd' },
        'tenant-acme-v1',
    );
    console.log('tenant:', tenant.id);

    // 3. Knowledge + grant
    const kb = (await cencori.knowledge.createBase({ name: 'Company handbook', tenant_id: tenant.id })) as { id: string };
    await cencori.knowledge.addInlineSource(kb.id, 'Refunds are processed within 30 days of purchase.');
    const hits = await cencori.knowledge.search(kb.id, { query: 'refund policy', top_k: 3 });
    console.log('citations:', hits.data.length);

    // 4. Install + browser token + background run
    const installation = (await cencori.installations.create({ tenant_id: tenant.id, agent_id: 'agt_onboarding', knowledge_base_ids: [kb.id] })) as { id: string };
    const { token } = await cencori.clientTokens.mint({ tenant_id: tenant.id, external_user_id: 'employee_456', installation_ids: [installation.id] });
    console.log('browser token:', `${token.slice(0, 12)}...`);

    const run = (await cencori.runs.create('agt_onboarding', {
        installation_id: installation.id,
        mode: 'background',
        input: { type: 'business_plan', company_profile: { industry: 'logistics', country: 'NG' } },
    }, 'business-plan-company-123-2026')) as { id: string; status: string };
    console.log('run:', run.id, run.status);

    // 5. Usage
    const summary = await cencori.usage.summary({ days: 7 });
    console.log('usage groups:', (summary.groups as unknown[]).length);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
