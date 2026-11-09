import { readFileSync } from 'fs';
import { notFound } from 'next/navigation';
import { StoredDemoChat } from './stored-chat';

/** Local-only: <AgentChat> talking straight to a stored agent with a publishable key (no backend route). */
export default function StoredAgentDemoPage() {
    if (process.env.NODE_ENV === 'production') notFound();
    const publishableKey = readFileSync('/private/tmp/claude-501/-Users-apple-cencori/9796c975-99a8-4057-b23b-0a6223406d57/scratchpad/.local-cpk-key', 'utf8').trim();
    return <StoredDemoChat publishableKey={publishableKey} />;
}
