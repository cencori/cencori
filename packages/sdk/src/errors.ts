export class CencoriError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public code?: string
    ) {
        super(message);
        this.name = 'CencoriError';
        Object.setPrototypeOf(this, CencoriError.prototype);
    }
}

export class AuthenticationError extends CencoriError {
    constructor(message = 'Invalid API key') {
        super(message, 401, 'INVALID_API_KEY');
        this.name = 'AuthenticationError';
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

export class RateLimitError extends CencoriError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
        this.name = 'RateLimitError';
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}

export class SafetyError extends CencoriError {
    constructor(message = 'Content safety violation', public reasons?: string[]) {
        super(message, 400, 'SAFETY_VIOLATION');
        this.name = 'SafetyError';
        Object.setPrototypeOf(this, SafetyError.prototype);
    }
}
