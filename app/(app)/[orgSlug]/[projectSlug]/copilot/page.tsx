import { cookies } from 'next/headers';
import { COPILOT_CONVERSATION_COOKIE } from '@/lib/console/copilot';
import { CopilotPageClient } from './CopilotPageClient';

export default async function CopilotPage() {
    // The conversation the panel had open, so going full screen continues it.
    const conversationId = (await cookies()).get(COPILOT_CONVERSATION_COOKIE)?.value || null;
    return <CopilotPageClient initialConversationId={conversationId} />;
}
