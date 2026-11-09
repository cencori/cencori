import { readFileSync } from 'fs';
import { z } from 'zod';
import { Agent, createAgentChatHandler, tool } from '@/packages/sdk/src/agents-sdk';

/**
 * Local-only playground for <AgentChat> (cencori/react) against this dev
 * server. Not served in production.
 */

const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const PRODUCTS = ['Gateway', 'Agents', 'Memory', 'Voice'];
const sales = MONTHS.map((month, i) => ({
    month,
    Gateway: 21000 + i * 2400 + (i % 2) * 900,
    Agents: 6000 + i * 3100,
    Memory: 3200 + i * 650,
    Voice: 1800 + (i % 3) * 700 + i * 300,
}));
const customers = [
    { name: 'Paystack', country: 'NG', plan: 'Enterprise', mrr: 12400, status: 'active' },
    { name: 'Moniepoint', country: 'NG', plan: 'Team', mrr: 8200, status: 'active' },
    { name: 'Flutterwave', country: 'NG', plan: 'Team', mrr: 6900, status: 'trial' },
    { name: 'Andela', country: 'KE', plan: 'Pro', mrr: 2100, status: 'active' },
    { name: 'Chipper Cash', country: 'GH', plan: 'Pro', mrr: 1650, status: 'past_due' },
];

const getSales = tool({
    name: 'get_sales',
    description: 'Monthly revenue in USD by product, May to November 2026.',
    parameters: z.object({ product: z.enum(['all', ...PRODUCTS] as [string, ...string[]]).optional() }),
    execute: async ({ product }) => (product && product !== 'all'
        ? sales.map((s) => ({ month: s.month, revenue: s[product as keyof typeof s] }))
        : sales),
});

const getCustomers = tool({
    name: 'get_customers',
    description: 'Top customers with plan, monthly recurring revenue (USD) and status.',
    parameters: z.object({}),
    execute: async () => customers,
});

const issueCredit = tool({
    name: 'issue_credit',
    description: 'Give a customer account credit in USD.',
    parameters: z.object({ customer: z.string(), amount_usd: z.number() }),
    needsApproval: true,
    execute: async ({ customer, amount_usd }) => ({ ok: true, customer, amount_usd, reference: `CR-${Math.floor(Math.random() * 90000 + 10000)}` }),
});

const analyst = new Agent({
    name: 'Analyst',
    instructions: 'You are a revenue analyst for Cencori. Use the tools for real numbers, and answer with UI (render_ui) whenever data reads better as a chart, table, stat or list. Keep text short.',
    tools: [getSales, getCustomers, issueCredit],
    widgets: true,
});

function localKey(): string {
    return readFileSync('/private/tmp/claude-501/-Users-apple-cencori/9796c975-99a8-4057-b23b-0a6223406d57/scratchpad/.local-cencori-key', 'utf8').trim();
}

export async function POST(req: Request) {
    if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });
    const handler = createAgentChatHandler(analyst, { apiKey: localKey(), baseUrl: 'http://localhost:3000' });
    return handler(req);
}
