import { Agent, tool } from 'cencori/agents';
import { z } from 'zod';
import { findOrder, listOrders, monthlyRevenue, refundOrder } from './store';

/** Tools run on your server, with your data. The model only sees their results. */

const getRevenue = tool({
    name: 'get_revenue',
    description: 'Monthly revenue in USD for the last six months, split into online and wholesale.',
    parameters: z.object({}),
    execute: async () => monthlyRevenue(),
});

const getOrders = tool({
    name: 'get_orders',
    description: 'Recent orders, optionally filtered by status.',
    parameters: z.object({ status: z.enum(['paid', 'shipped', 'delivered', 'refunded']).optional() }),
    execute: async ({ status }) => listOrders(status),
});

// A tool can return its own widget: a design you control, filled with real data.
const showOrder = tool({
    name: 'show_order',
    description: 'Show one order to the user as a card.',
    parameters: z.object({ id: z.string() }),
    execute: async ({ id }) => {
        const order = await findOrder(id);
        if (!order) return `There is no order ${id}.`;
        return {
            status: order.status,
            widget: {
                type: 'Card',
                title: `Order #${order.id}`,
                subtitle: `${order.customer} · ${order.placedAt}`,
                status: order.status,
                children: [
                    { type: 'Stat', label: 'Total', value: order.total, format: 'currency', currency: 'USD' },
                    { type: 'Text', value: `${order.items} item${order.items === 1 ? '' : 's'} · ${order.email}`, color: 'muted', size: 'sm' },
                ],
                actions: order.status === 'refunded' ? [] : [
                    { type: 'Button', label: 'Refund this order', variant: 'outline', action: { type: 'refund', payload: { id: order.id } } },
                ],
            },
        };
    },
});

// needsApproval: the chat shows an approval card, and nothing runs until the user decides.
const issueRefund = tool({
    name: 'issue_refund',
    description: 'Refund an order in full.',
    parameters: z.object({ id: z.string() }),
    needsApproval: true,
    execute: async ({ id }) => refundOrder(id),
});

export const storeAgent = new Agent({
    name: 'Store assistant',
    instructions: [
        'You help the team running an online store.',
        'Use the tools for every number: never guess.',
        'Answer with UI when it helps: charts for trends, tables for lists, stats for headline numbers.',
        'Keep text to a sentence or two.',
    ].join(' '),
    tools: [getRevenue, getOrders, showOrder, issueRefund],
    widgets: true,
});
