export interface JailbreakDetectionResult {
    risk: number; // 0-1, where 1 is highest risk
    patterns: string[];
    confidence: number;
    category?: 'social_engineering' | 'system_extraction' | 'behavioral_probe' | 'indirect_pii' | 'multi_vector';
}

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
        patterns: ['system', 'underlying', 'foundation'],
        followed_by: ['email', 'contact', 'share', 'information'],
        risk: 0.6,
    },
    {
        patterns: ['story', 'writing', 'character'],
        followed_by: ['email', 'phone', 'address', 'contact'],
        risk: 0.7,
    },
    {
        patterns: ['curious', 'intellectually'],
        followed_by: ['how to', 'ways to', 'methods'],
        risk: 0.5,
    },
];

/**
 * Detect potential jailbreak attempts using pattern matching and heuristics
 */
export function detectJailbreak(
    text: string,
    conversationHistory?: Array<{ role: string; content: string }>
): JailbreakDetectionResult {
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
    const questionCount = (text.match(/\?/g) || []).length;
    if (questionCount >= 3) {
        patterns.push('Multiple questions in single message');
        totalRisk += 0.2;
    }

    // Check message length - overly long messages with multiple topics
    const messageLength = text.length;
    if (messageLength > 500 && questionCount >= 2) {
        patterns.push('Long message with multiple topics');
        totalRisk += 0.15;
    }

    // Check for conversation pattern - if history exists
    if (conversationHistory && conversationHistory.length > 0) {
        // Rapid topic switching is suspicious
        const recentUserMessages = conversationHistory
            .filter(m => m.role === 'user')
            .slice(-3);

        if (recentUserMessages.length >= 2) {
            // Simple heuristic: if recent messages are very different in content
            // (This is a simplification - could be enhanced with semantic similarity)
            patterns.push('Potential topic switching pattern');
            totalRisk += 0.1;
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
