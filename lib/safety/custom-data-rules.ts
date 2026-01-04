/**
 * Custom Data Rules - Matching Logic
 * 
 * Handles keywords, regex, JSON path, and AI detect matching
 * for user-defined sensitive data patterns.
 */

import { GeminiProvider } from '@/lib/providers';

export interface CustomDataRule {
    id: string;
    project_id: string;
    name: string;
    description?: string;
    match_type: 'keywords' | 'regex' | 'json_path' | 'ai_detect';
    pattern: string;
    case_sensitive: boolean;
    action: 'mask' | 'redact' | 'block';
    is_active: boolean;
    priority: number;
}

export interface MatchResult {
    matched: boolean;
    snippets: string[];
    rule: CustomDataRule;
}

export interface ProcessedContent {
    content: string;
    wasProcessed: boolean;
    matchedRules: MatchResult[];
    shouldBlock: boolean;
}

/**
 * Match keywords in text
 */
export function matchKeywords(
    text: string,
    keywordsStr: string,
    caseSensitive: boolean
): { matched: boolean; snippets: string[] } {
    const keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
    const searchText = caseSensitive ? text : text.toLowerCase();
    const snippets: string[] = [];

    for (const keyword of keywords) {
        const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
        const index = searchText.indexOf(searchKeyword);
        if (index !== -1) {
            // Extract the actual matched text from original
            const actualStart = Math.max(0, index - 10);
            const actualEnd = Math.min(text.length, index + keyword.length + 10);
            snippets.push(text.slice(actualStart, actualEnd));
        }
    }

    return { matched: snippets.length > 0, snippets };
}

/**
 * Match regex pattern in text
 */
export function matchRegex(
    text: string,
    pattern: string,
    caseSensitive: boolean
): { matched: boolean; snippets: string[] } {
    try {
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(pattern, flags);
        const matches = text.match(regex);

        return {
            matched: !!matches && matches.length > 0,
            snippets: matches || [],
        };
    } catch (error) {
        console.warn('[CustomRules] Invalid regex pattern:', pattern, error);
        return { matched: false, snippets: [] };
    }
}

/**
 * Match JSON paths in parsed JSON
 * Pattern format: "$.path.to.field, $.another.path"
 */
export function matchJsonPath(
    json: Record<string, unknown>,
    pathsStr: string
): { matched: boolean; snippets: string[] } {
    const paths = pathsStr.split(',').map(p => p.trim()).filter(Boolean);
    const snippets: string[] = [];

    for (const path of paths) {
        const value = getValueByPath(json, path);
        if (value !== undefined && value !== null) {
            snippets.push(`${path}=${JSON.stringify(value)}`);
        }
    }

    return { matched: snippets.length > 0, snippets };
}

/**
 * Get value from object by dot-notation path
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    // Remove $. prefix if present
    const cleanPath = path.startsWith('$.') ? path.slice(2) : path;
    const parts = cleanPath.split('.');

    let current: unknown = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }

    return current;
}

/**
 * AI Detect - Uses Gemini 2.5 Flash to classify sensitive data
 */
export async function matchAIDetect(
    text: string,
    sensitiveDescription: string
): Promise<{ matched: boolean; snippets: string[] }> {
    try {
        // Use Gemini 2.5 Flash for classification
        const gemini = new GeminiProvider();

        const response = await gemini.chat({
            model: 'gemini-2.5-flash',
            messages: [
                {
                    role: 'system',
                    content: `You are a data classifier. Analyze text and determine if it contains specific types of sensitive data.
                    
Respond ONLY with valid JSON in this exact format:
{"matched": true/false, "snippets": ["matched text 1", "matched text 2"]}`
                },
                {
                    role: 'user',
                    content: `Does this text contain: "${sensitiveDescription}"?

Text to analyze (first 2000 chars):
"""
${text.slice(0, 2000)}
"""

Respond with JSON only.`
                }
            ],
            temperature: 0,
            maxTokens: 200,
        });

        // Parse the response
        const content = response.content.trim();

        // Try to extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('[AI Detect] Could not parse response:', content);
            return { matched: false, snippets: [] };
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
            matched: Boolean(result.matched),
            snippets: Array.isArray(result.snippets) ? result.snippets : [],
        };
    } catch (error) {
        console.error('[AI Detect] Classification failed:', error);
        return { matched: false, snippets: [] };
    }
}

/**
 * Apply mask to text - replace matched snippets with ****
 */
export function applyMask(text: string, snippets: string[]): string {
    let result = text;

    for (const snippet of snippets) {
        if (snippet.length <= 4) {
            result = result.replace(snippet, '****');
        } else {
            // Show first 2 and last 2 chars
            const masked = snippet.slice(0, 2) + '*'.repeat(Math.min(snippet.length - 4, 10)) + snippet.slice(-2);
            result = result.replace(snippet, masked);
        }
    }

    return result;
}

/**
 * Apply redaction to text - replace matched snippets with [REDACTED]
 */
export function applyRedact(text: string, snippets: string[]): string {
    let result = text;

    for (const snippet of snippets) {
        result = result.replace(snippet, '[REDACTED]');
    }

    return result;
}

/**
 * Process all rules against text content
 */
export async function processCustomRules(
    text: string,
    rules: CustomDataRule[],
    json?: Record<string, unknown>
): Promise<ProcessedContent> {
    let processedText = text;
    const matchedRules: MatchResult[] = [];
    let shouldBlock = false;

    // Sort by priority (higher first)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
        if (!rule.is_active) continue;

        let matchResult: { matched: boolean; snippets: string[] };

        switch (rule.match_type) {
            case 'keywords':
                matchResult = matchKeywords(text, rule.pattern, rule.case_sensitive);
                break;
            case 'regex':
                matchResult = matchRegex(text, rule.pattern, rule.case_sensitive);
                break;
            case 'json_path':
                matchResult = json
                    ? matchJsonPath(json, rule.pattern)
                    : { matched: false, snippets: [] };
                break;
            case 'ai_detect':
                // AI detect runs async - for now, skip in sync processing
                // This will be handled in background job
                matchResult = { matched: false, snippets: [] };
                break;
            default:
                matchResult = { matched: false, snippets: [] };
        }

        if (matchResult.matched) {
            console.log(`[CustomRules] ✅ MATCHED: ${rule.name} (${rule.match_type}), snippets:`, matchResult.snippets);
            matchedRules.push({ ...matchResult, rule });

            // Apply action
            switch (rule.action) {
                case 'block':
                    shouldBlock = true;
                    break;
                case 'mask':
                    processedText = applyMask(processedText, matchResult.snippets);
                    break;
                case 'redact':
                    processedText = applyRedact(processedText, matchResult.snippets);
                    break;
            }
        } else {
            console.log(`[CustomRules] ❌ No match: ${rule.name} (${rule.match_type})`);
        }
    }

    return {
        content: processedText,
        wasProcessed: matchedRules.length > 0,
        matchedRules,
        shouldBlock,
    };
}

/**
 * Process AI Detect rules asynchronously (for background job)
 */
export async function processAIDetectRules(
    text: string,
    rules: CustomDataRule[]
): Promise<MatchResult[]> {
    const aiRules = rules.filter(r => r.match_type === 'ai_detect' && r.is_active);
    const results: MatchResult[] = [];

    for (const rule of aiRules) {
        const matchResult = await matchAIDetect(text, rule.pattern);
        if (matchResult.matched) {
            results.push({ ...matchResult, rule });
        }
    }

    return results;
}
