export interface OutputScanResult {
    safe: boolean;
    reasons: string[];
    blockedContent?: {
        type: string;
        examples: string[];
    };
    riskScore: number;
    confidence: number;
}

export interface ScanContext {
    inputText?: string;
    jailbreakRisk?: number;
    conversationHistory?: Array<{ role: string; content: string }>;
}

// PII patterns (more comprehensive than input filtering)
const OUTPUT_PII_PATTERNS = {
    // Standard email format
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // Obfuscated email formats
    emailObfuscated: /\b[A-Za-z0-9._%+-]+\s*(dot|at|\[at\]|\(at\))\s*[A-Za-z0-9.-]+\s*(dot|\[dot\])\s*[A-Za-z]{2,}\b/gi,

    // Phone numbers
    phone: /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,

    // SSN
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

    // Credit card
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,

    // Street addresses (simplified)
    address: /\b\d{1,5}\s+[\w\s]+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/gi,
};

// Patterns indicating the model is teaching PII exfiltration
const INSTRUCTION_LEAKAGE_PATTERNS = [
    'here are.*ways to',
    'methods.*to share',
    'how.*could.*mention',
    'techniques.*for',
    'strategies.*to',
    'append.*@',
    'for example.*@',
    'such as.*@',
    'like.*@.*\\.',
    'would be.*@',
];

// Harmful content generation patterns
const HARMFUL_OUTPUT_PATTERNS = [
    'here\'s how to bypass',
    'to circumvent',
    'hack',
    'exploit this',
    'vulnerability',
    'backdoor',
    'social engineering technique',
    'phishing',
];

/**
 * Scan AI model output for security violations
 */
export function scanOutput(
    outputText: string,
    context?: ScanContext
): OutputScanResult {
    const reasons: string[] = [];
    let riskScore = 0;
    const blockedExamples: string[] = [];
    let blockedType: string | undefined;

    // 1. Check for PII in output
    const emailMatches = outputText.match(OUTPUT_PII_PATTERNS.email);
    if (emailMatches && emailMatches.length > 0) {
        reasons.push(`Output contains ${emailMatches.length} email address(es)`);
        blockedExamples.push(...emailMatches.slice(0, 3)); // Store first 3 examples
        blockedType = 'email';
        riskScore += 0.5;
    }

    const emailObfuscatedMatches = outputText.match(OUTPUT_PII_PATTERNS.emailObfuscated);
    if (emailObfuscatedMatches && emailObfuscatedMatches.length > 0) {
        reasons.push('Output contains obfuscated email format (dot/at notation)');
        blockedExamples.push(...emailObfuscatedMatches.slice(0, 3));
        blockedType = 'email_obfuscated';
        riskScore += 0.6; // Higher risk - deliberately trying to bypass filters
    }

    const phoneMatches = outputText.match(OUTPUT_PII_PATTERNS.phone);
    if (phoneMatches && phoneMatches.length > 0) {
        reasons.push(`Output contains ${phoneMatches.length} phone number(s)`);
        blockedExamples.push(...phoneMatches.slice(0, 3));
        blockedType = 'phone';
        riskScore += 0.5;
    }

    const ssnMatches = outputText.match(OUTPUT_PII_PATTERNS.ssn);
    if (ssnMatches && ssnMatches.length > 0) {
        reasons.push('Output contains SSN');
        blockedExamples.push(...ssnMatches.slice(0, 3));
        blockedType = 'ssn';
        riskScore += 0.8; // Very high risk
    }

    const creditCardMatches = outputText.match(OUTPUT_PII_PATTERNS.creditCard);
    if (creditCardMatches && creditCardMatches.length > 0) {
        reasons.push('Output contains credit card number');
        blockedExamples.push(...creditCardMatches.slice(0, 3));
        blockedType = 'credit_card';
        riskScore += 0.8;
    }

    const addressMatches = outputText.match(OUTPUT_PII_PATTERNS.address);
    if (addressMatches && addressMatches.length > 0) {
        reasons.push(`Output contains ${addressMatches.length} street address(es)`);
        blockedExamples.push(...addressMatches.slice(0, 3));
        blockedType = 'address';
        riskScore += 0.4;
    }

    // 2. Check for instruction leakage (teaching how to share PII)
    const lowerOutput = outputText.toLowerCase();
    for (const pattern of INSTRUCTION_LEAKAGE_PATTERNS) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(outputText)) {
            // Check if it's teaching PII sharing techniques
            const hasEmailContext = lowerOutput.includes('@') ||
                lowerOutput.includes('email') ||
                lowerOutput.includes('contact');

            if (hasEmailContext) {
                reasons.push('Output teaches PII exfiltration techniques');
                blockedType = 'instruction_leakage';
                riskScore += 0.7; // Very high risk - this is the Wisc attack
                break;
            }
        }
    }

    // 3. Check for harmful content generation
    for (const pattern of HARMFUL_OUTPUT_PATTERNS) {
        if (lowerOutput.includes(pattern)) {
            reasons.push(`Output contains harmful pattern: "${pattern}"`);
            riskScore += 0.4;
        }
    }

    // 4. Context-aware scoring
    if (context) {
        // If jailbreak was detected in input, be more strict on output
        if (context.jailbreakRisk && context.jailbreakRisk > 0.5) {
            riskScore += 0.2;
            reasons.push('Elevated scrutiny due to jailbreak risk in input');
        }

        // If input asked about PII sharing, and output contains PII, high risk
        if (context.inputText) {
            const inputLower = context.inputText.toLowerCase();
            const askingAboutSharing =
                inputLower.includes('how to share') ||
                inputLower.includes('how to mention') ||
                inputLower.includes('naturally weave') ||
                inputLower.includes('subtle way');

            if (askingAboutSharing && (emailMatches || phoneMatches)) {
                reasons.push('Output provides PII in response to suspicious input');
                riskScore += 0.3;
            }
        }
    }

    // 5. Pattern density check - multiple PII instances is very suspicious
    const totalPIICount =
        (emailMatches?.length || 0) +
        (phoneMatches?.length || 0) +
        (ssnMatches?.length || 0) +
        (creditCardMatches?.length || 0);

    if (totalPIICount >= 3) {
        reasons.push(`Output contains ${totalPIICount} PII instances - likely teaching exfiltration`);
        riskScore += 0.4;
    }

    // Calculate confidence based on pattern strength
    const confidence = reasons.length > 0 ? Math.min(reasons.length * 0.25, 0.95) : 0;

    // Determine if safe (threshold: 0.6 for output is stricter than input)
    const safe = riskScore < 0.6;

    return {
        safe,
        reasons,
        blockedContent: blockedExamples.length > 0 ? {
            type: blockedType || 'unknown',
            examples: blockedExamples,
        } : undefined,
        riskScore: Math.min(riskScore, 1.0),
        confidence,
    };
}

/**
 * Check if output scan failed critically (should block response)
 */
export function shouldBlockOutput(result: OutputScanResult): boolean {
    // Block if:
    // 1. Not safe
    // 2. High confidence (avoid false positives)
    // 3. OR if instruction leakage detected (always block)
    const hasInstructionLeakage = result.reasons.some(r =>
        r.includes('instruction leakage') || r.includes('exfiltration')
    );

    return !result.safe && (result.confidence >= 0.5 || hasInstructionLeakage);
}
