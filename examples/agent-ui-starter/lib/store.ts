/**
 * Demo data for the store. Swap these functions for your database: the agent
 * only ever sees what the tools return.
 */

export interface Order {
    id: string;
    customer: string;
    email: string;
    total: number;
    status: 'paid' | 'shipped' | 'delivered' | 'refunded';
    items: number;
    placedAt: string;
}

const orders: Order[] = [
    { id: '1042', customer: 'Ada Okafor', email: 'ada@example.com', total: 129.5, status: 'shipped', items: 3, placedAt: '2026-11-02' },
    { id: '1043', customer: 'Tunde Bello', email: 'tunde@example.com', total: 64, status: 'delivered', items: 1, placedAt: '2026-11-03' },
    { id: '1044', customer: 'Grace Mensah', email: 'grace@example.com', total: 212.9, status: 'paid', items: 4, placedAt: '2026-11-05' },
    { id: '1045', customer: 'Ifeoma Eze', email: 'ifeoma@example.com', total: 38.25, status: 'paid', items: 1, placedAt: '2026-11-06' },
    { id: '1046', customer: 'Kwame Asante', email: 'kwame@example.com', total: 96, status: 'delivered', items: 2, placedAt: '2026-11-07' },
];

const revenue = [
    { month: 'Jun', online: 18200, wholesale: 6400 },
    { month: 'Jul', online: 19850, wholesale: 6900 },
    { month: 'Aug', online: 21100, wholesale: 7200 },
    { month: 'Sep', online: 23400, wholesale: 7050 },
    { month: 'Oct', online: 26900, wholesale: 8100 },
    { month: 'Nov', online: 29300, wholesale: 8800 },
];

export async function monthlyRevenue() {
    return revenue;
}

export async function listOrders(status?: Order['status']) {
    return status ? orders.filter((o) => o.status === status) : orders;
}

export async function findOrder(id: string) {
    return orders.find((o) => o.id === id.replace(/^#/, '')) ?? null;
}

export async function refundOrder(id: string) {
    const order = await findOrder(id);
    if (!order) throw new Error(`No order ${id}`);
    if (order.status === 'refunded') throw new Error(`Order ${id} is already refunded`);
    order.status = 'refunded';
    return { id: order.id, refunded: order.total, reference: `RF-${Date.now().toString(36).toUpperCase()}` };
}
