import { createAgentChatHandler } from 'cencori/agents';
import { storeAgent } from '@/lib/agent';

// Serves the agent to <AgentChat>. Add auth here: `context` and `user` get the request.
export const POST = createAgentChatHandler(storeAgent);
