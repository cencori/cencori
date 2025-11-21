import type { ChatParams, ChatResponse } from '../types/ai';
import type { CencoriClient } from '../client';

export class AIModule {
    constructor(private client: CencoriClient) { }

    async chat(params: ChatParams): Promise<ChatResponse> {
        return this.client.request<ChatResponse>('/api/ai/chat', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }
}
