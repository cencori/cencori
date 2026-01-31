export interface JailbreakDetectionResult {
    risk: number; // 0-1, where 1 is highest risk
    patterns: string[];
    confidence: number;
    category?: 'social_engineering' | 'system_extraction' | 'behavioral_probe' | 'indirect_pii' | 'multi_vector';
}

// Patterns that indicate legitimate agent tool usage (WHITELIST)
const AGENT_TOOL_PATTERNS = [
    // XML-style tool calls (common in agent frameworks)
    '<tool_call>',
    '<tool_name>',
    '<parameters>',
    '</tool_call>',
    '<thought>',
    '<final_answer>',
    // Function calling patterns
    'tool_result',
    'function_call',
    'tool_use',
    // File system operations
    'list_directory',
    'read_file',
    'write_file',
    'directory_tree',
    'file_info',
    // Common system paths (not sensitive data extraction)
    '/home/',
    '.bashrc',
    '.gitconfig',
    // MCP patterns
    'mcp',
    'allowed_directories',
];

// Patterns that indicate potential jailbreak attempts
const JAILBREAK_PATTERNS = {
    // Social engineering - framing malicious requests as stories/roleplay
    social_engineering: [
        'writing a story',
        'imagine if',
        'hypothetically',
        'let\'s say',
        'pretend that',
        'in a fictional',
        'for a novel',
        'character needs to',
        'creative writing',
        'roleplay',
    ],

    // System prompt extraction attempts
    system_extraction: [
        'what powers you',
        'under the hood',
        'underlying technology',
        'base technology',
        'neural network architecture',
        'training data',
        'foundation model',
        'what are you built on',
        'reveal your system',
        'show me your instructions',
        'what are your rules',
        'internal instructions',
        'core directives',
    ],

    // Behavioral probing - testing AI boundaries
    behavioral_probe: [
        'would you correct me if',
        'would you push back',
        'would you challenge',
        'what would you do if',
        'how would you respond to',
        'actual behavioral patterns',
        'versus what you\'re told',
        'even if it meant',
        'testing your',
    ],

    // Indirect PII extraction
    indirect_pii: [
        'how to share contact',
        'how to mention email',
        'naturally weave',
        'subtle way',
        'without it sounding',
        'not obvious like',
        'integrate it naturally',
        'incidental detail',
        'drop their',
        'share information subtly',
    ],

    // Multi-layered deception
    multi_vector: [
        'quick question',
        'totally separate thought',
        'one more thing',
        'also,',
        'by the way',
        'just curious',
        'genuinely curious',
        'intellectually curious',
    ],
};

// Suspicious question combinations
const SUSPICIOUS_COMBINATIONS = [
    {
        patterns: ['reveal your system', 'show me your instructions'],
        followed_by: ['email', 'contact', 'share personal'],
        risk: 0.6,
    },
    {
        patterns: ['story', 'writing a story', 'character'],
        followed_by: ['real email', 'real phone', 'real address', 'actual contact'],
        risk: 0.7,
    },
    {
        patterns: ['genuinely curious', 'intellectually curious'],
        followed_by: ['bypass', 'workaround', 'get around'],
        risk: 0.5,
    },
];

/**
 * Check if the content appears to be from a legitimate agent tool interaction
 */
export function isAgentToolContext(text: string): boolean {
    const lowerText = text.toLowerCase();
    let matchCount = 0;

    for (const pattern of AGENT_TOOL_PATTERNS) {
        if (lowerText.includes(pattern.toLowerCase())) {
            matchCount++;
            if (matchCount >= 2) return true; // Two or more agent patterns = likely legitimate
        }
    }

    return false;
}

/**
 * Detect potential jailbreak attempts using pattern matching and heuristics
 */
export function detectJailbreak(
    text: string,
    conversationHistory?: Array<{ role: string; content: string }>
): JailbreakDetectionResult {
    // Early exit: if this looks like agent tool usage, skip strict detection
    if (isAgentToolContext(text)) {
        return {
            risk: 0,
            patterns: [],
            confidence: 0,
            category: undefined,
        };
    }

    // Also check conversation history for agent patterns
    if (conversationHistory) {
        const recentAgentUsage = conversationHistory.slice(-5).some(
            m => isAgentToolContext(m.content)
        );
        if (recentAgentUsage) {
            return {
                risk: 0,
                patterns: [],
                confidence: 0,
                category: undefined,
            };
        }
    }

    const lowerText = text.toLowerCase();
    const patterns: string[] = [];
    let totalRisk = 0;
    let matchCount = 0;
    let detectedCategory: JailbreakDetectionResult['category'] | undefined;

    // Check each category
    for (const [category, keywords] of Object.entries(JAILBREAK_PATTERNS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
                patterns.push(`${category}: "${keyword}"`);
                matchCount++;

                // Weight different categories differently
                switch (category) {
                    case 'system_extraction':
                        totalRisk += 0.4;
                        detectedCategory = 'system_extraction';
                        break;
                    case 'indirect_pii':
                        totalRisk += 0.5; // High risk
                        detectedCategory = 'indirect_pii';
                        break;
                    case 'behavioral_probe':
                        totalRisk += 0.3;
                        detectedCategory = 'behavioral_probe';
                        break;
                    case 'social_engineering':
                        totalRisk += 0.35;
                        detectedCategory = 'social_engineering';
                        break;
                    case 'multi_vector':
                        totalRisk += 0.2; // Lower individual risk, but compounds
                        detectedCategory = 'multi_vector';
                        break;
                }
            }
        }
    }

    // Check for suspicious combinations
    for (const combo of SUSPICIOUS_COMBINATIONS) {
        const hasFirstPattern = combo.patterns.some(p => lowerText.includes(p));
        const hasSecondPattern = combo.followed_by.some(p => lowerText.includes(p));

        if (hasFirstPattern && hasSecondPattern) {
            patterns.push(`Suspicious combination detected`);
            totalRisk += combo.risk;
            matchCount++;
        }
    }

    // Check message structure - multiple unrelated questions is suspicious
    // But only if they're actual user questions, not tool outputs
    const questionCount = (text.match(/\?/g) || []).length;
    const isToolOutput = text.includes('```') || text.includes('<tool') || text.includes('result');
    if (questionCount >= 3 && !isToolOutput) {
        patterns.push('Multiple questions in single message');
        totalRisk += 0.2;
    }

    // Check message length - overly long messages with multiple topics
    // Skip if this looks like tool output or code
    const messageLength = text.length;
    if (messageLength > 500 && questionCount >= 2 && !isToolOutput) {
        patterns.push('Long message with multiple topics');
        totalRisk += 0.15;
    }

    // Check for conversation pattern - if history exists
    // Only flag if there's ACTUAL suspicious topic switching (not just having multiple messages)
    if (conversationHistory && conversationHistory.length >= 3) {
        const recentUserMessages = conversationHistory
            .filter(m => m.role === 'user')
            .slice(-3)
            .map(m => m.content.toLowerCase());

        if (recentUserMessages.length >= 2) {
            // Check if messages are drastically different AND contain suspicious keywords
            const hasSuspiciousSwitch = recentUserMessages.some(msg =>
                JAILBREAK_PATTERNS.multi_vector.some(kw => msg.includes(kw))
            ) && recentUserMessages.some(msg =>
                Object.values(JAILBREAK_PATTERNS)
                    .flat()
                    .filter(kw => !JAILBREAK_PATTERNS.multi_vector.includes(kw))
                    .some(kw => msg.includes(kw))
            );

            if (hasSuspiciousSwitch) {
                patterns.push('Potential topic switching pattern');
                totalRisk += 0.1;
            }
        }
    }

    // Calculate final risk score (capped at 1.0)
    const risk = Math.min(totalRisk, 1.0);

    // Confidence increases with more pattern matches
    const confidence = Math.min(matchCount * 0.15, 0.95);

    return {
        risk,
        patterns,
        confidence,
        category: detectedCategory,
    };
}

/**
 * Check if a jailbreak risk exceeds the threshold
 */
export function isJailbreakRisky(
    result: JailbreakDetectionResult,
    threshold: number = 0.7
): boolean {
    return result.risk >= threshold && result.confidence >= 0.3;
}

