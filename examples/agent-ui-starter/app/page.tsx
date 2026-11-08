'use client';

import { AgentChat } from 'cencori/react';

export default function Home() {
    return (
        <main style={{ height: '100dvh', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
            <AgentChat
                api="/api/chat"
                greeting="What do you want to know about the store?"
                prompts={[
                    'How is revenue trending?',
                    'Which orders still need shipping?',
                    'Show me order 1044',
                    'Refund order 1045',
                ]}
                toolLabels={{
                    get_revenue: 'Reading revenue',
                    get_orders: 'Reading orders',
                    show_order: 'Opening the order',
                    issue_refund: 'Refund the order',
                }}
            />
        </main>
    );
}
