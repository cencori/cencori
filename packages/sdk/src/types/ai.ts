export interface ChatParams {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  role: string;
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
