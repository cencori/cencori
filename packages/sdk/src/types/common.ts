export interface CencoriConfig {
    apiKey: string;
    baseUrl?: string;
}

export interface RequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: string;
    headers?: Record<string, string>;
}
