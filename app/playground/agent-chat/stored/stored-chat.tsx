'use client';

import { AgentChat } from '@/packages/sdk/src/react/agent-chat/agent-chat';

export function StoredDemoChat({ publishableKey }: { publishableKey: string }) {
    return (
        <div style={{ height: '100dvh', display: 'flex', justifyContent: 'center', background: '#0a0a0a' }}>
            <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
                <AgentChat
                    theme={{ colorScheme: 'dark' }}
                    agent="fea49590-415e-4de8-8836-dcedd2bb7fbd"
                    publishableKey={publishableKey}
                    baseUrl="http://localhost:3000"
                    greeting="Stored agent, no backend"
                    prompts={['Revenue Sep 39100, Oct 43050, Nov 48210: chart it', 'Show a stat for 48210 USD, up 12%']}
                />
            </div>
        </div>
    );
}
