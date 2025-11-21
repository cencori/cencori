
export interface SafetyResult {
    safe: boolean;
    reasons: string[];
    score: number; // 0-1, where 1 is safest
}

// Basic PII patterns
const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    phone: /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
};

// Basic harmful keywords (expand as needed)
const HARMFUL_KEYWORDS = [
    'ignore previous instructions',
    'system prompt',
    'you are now',
    'jailbreak',
    'bypass',
    'malicious',
    'exploit',
    'private key',
    'dump database',
    'delete all',
    'execute command',
    'root access',
    'admin panel',
    'phishing',
    'fraud',
    'extortion',
    'illegal activity',
    'drug production',
    'do not censor',
    'act as a different AI',
    'disregard safety guidelines',
    'reveal hidden information',
    'override security',
    'unrestricted mode',
    'developer mode',
    'full access',
    'give me the code for',
];

export function checkContent(text: string): SafetyResult {
    const reasons: string[] = [];
    let score = 1.0;

    if (!text) {
        return { safe: true, reasons: [], score: 1.0 };
    }

    // Check for PII
    if (PII_PATTERNS.email.test(text)) {
        reasons.push('Potential email address detected');
        score -= 0.2;
    }
    if (PII_PATTERNS.phone.test(text)) {
        reasons.push('Potential phone number detected');
        score -= 0.2;
    }
    if (PII_PATTERNS.ssn.test(text)) {
        reasons.push('Potential SSN detected');
        score -= 0.5; // High risk
    }
    if (PII_PATTERNS.creditCard.test(text)) {
        reasons.push('Potential credit card number detected');
        score -= 0.5; // High risk
    }

    // Check for harmful keywords / injection attempts
    const lowerText = text.toLowerCase();
    for (const keyword of HARMFUL_KEYWORDS) {
        if (lowerText.includes(keyword)) {
            reasons.push(`Potential prompt injection keyword detected: "${keyword}"`);
            score -= 0.3;
        }
    }

    // Determine safety based on score
    // Threshold can be adjusted. For now, < 0.5 is unsafe.
    const safe = score >= 0.5;

    return {
        safe,
        reasons,
        score: Math.max(0, score),
    };
}
