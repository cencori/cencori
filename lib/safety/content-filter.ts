/**
 * PII detection for gateway input.
 *
 * The only built-in protection Cencori offers, and only when a project turns
 * it on. Detection is binary: any PII found blocks the request. No scoring or
 * keyword heuristics — those produced false positives and added latency.
 */

export interface SafetyResult {
    safe: boolean;
    reasons: string[];
}

const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    // Obfuscated email: "john dot smith at company dot org" or "john.smith [at] company [dot] org"
    emailObfuscated: /\b[A-Za-z0-9]+\s*(?:dot|\[dot\]|\(dot\)|\.)\s*[A-Za-z0-9]+\s*(?:at|\[at\]|\(at\)|@)\s*[A-Za-z0-9.-]+\s*(?:dot|\[dot\]|\(dot\)|\.)\s*[A-Za-z]{2,}\b/i,
    phone: /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
};

/**
 * Luhn algorithm check for credit card validity
 */
function isLuhnValid(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i]);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}

/** Returns one reason per PII type found; safe when none. */
export function detectPII(text: string): SafetyResult {
    if (!text) return { safe: true, reasons: [] };

    const reasons: string[] = [];
    if (PII_PATTERNS.email.test(text)) reasons.push('Email address detected');
    if (PII_PATTERNS.emailObfuscated.test(text)) reasons.push('Obfuscated email address detected');
    if (PII_PATTERNS.phone.test(text)) reasons.push('Phone number detected');
    if (PII_PATTERNS.ssn.test(text)) reasons.push('SSN detected');

    const ccMatches = text.match(PII_PATTERNS.creditCard) || [];
    const hasCardContext = /\b(?:credit|debit|payment|card(?:\s+number)?)\b/i.test(text);
    if (ccMatches.some(isLuhnValid) || (ccMatches.length > 0 && hasCardContext)) {
        reasons.push('Card number detected');
    }

    return { safe: reasons.length === 0, reasons };
}
