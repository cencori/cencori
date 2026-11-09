'use client';

import { AgentChat } from '@/packages/sdk/src/react/agent-chat/agent-chat';

export function ConsoleAgentChat() {
    return (
        <div style={{ height: '100dvh', display: 'flex', justifyContent: 'center', background: '#0a0a0a' }}>
            <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
                <AgentChat
                    theme={{ colorScheme: 'dark' }}
                    widgetKey="cwk_vytf2M6QlWanwfmgWLDbVg01"
                    baseUrl="http://localhost:3000"
                    greeting="Cencori Support (built in the console)"
                    prompts={['What is Cencori?', 'Compare your plans in a table']}
                />
            </div>
        </div>
    );
}
