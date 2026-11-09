'use client';

import { AgentChat } from '@/packages/sdk/src/react/agent-chat/agent-chat';

export function DemoChat() {
    return (
        <div style={{ height: '100dvh', display: 'flex', justifyContent: 'center', background: '#0a0a0a' }}><div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
            <AgentChat
                theme={{ colorScheme: 'dark' }}
                api="/api/dev/agent-chat"
                greeting="Ask about Cencori's revenue"
                prompts={['Revenue by product this year', 'Who are our top customers?', 'How did Agents grow month over month?', 'Give Chipper Cash a $200 credit']}
                toolLabels={{ get_sales: 'Reading sales', get_customers: 'Reading customers', issue_credit: 'Issue account credit' }}
            />
        </div></div>
    );
}
