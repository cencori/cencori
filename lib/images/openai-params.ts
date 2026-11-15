export interface OpenAIImageInput {
    prompt: string;
    n?: number;
    size?: string;
    quality?: string;
    style?: 'vivid' | 'natural';
    responseFormat?: 'url' | 'b64_json';
}

/** `standard` and `hd` are the older names for `medium` and `high`. */
export function mapOpenAIQuality<Q extends string>(quality?: Q): 'low' | 'medium' | 'high' | undefined {
    if (!quality) return undefined;
    if (quality === 'standard') return 'medium';
    if (quality === 'hd') return 'high';
    return quality as 'low' | 'medium' | 'high';
}

/**
 * The body for OpenAI's image endpoint. The gpt-image models always return
 * base64 and refuse `response_format` and `style` outright ("400 Unknown
 * parameter: 'response_format'"), so neither is sent for them.
 */
export function openAIImageParams(request: OpenAIImageInput, apiModel: string): Record<string, unknown> {
    const isGptImage = apiModel.startsWith('gpt-image');
    return {
        model: apiModel,
        prompt: request.prompt,
        n: isGptImage ? 1 : (request.n ?? 1),
        size: request.size || '1024x1024',
        quality: isGptImage ? mapOpenAIQuality(request.quality) : request.quality,
        ...(isGptImage ? {} : { style: request.style, response_format: request.responseFormat || 'url' }),
    };
}
