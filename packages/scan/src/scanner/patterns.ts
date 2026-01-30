/**
 * Secret detection patterns for common API keys and tokens
 */
export interface SecretPattern {
    name: string;
    provider: string;
    pattern: RegExp;
    severity: 'critical' | 'high' | 'medium' | 'low';
}

export const SECRET_PATTERNS: SecretPattern[] = [
    // OpenAI
    {
        name: 'OpenAI API Key',
        provider: 'OpenAI',
        pattern: /sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}/g,
        severity: 'critical',
    },
    {
        name: 'OpenAI Project Key',
        provider: 'OpenAI',
        pattern: /sk-proj-[a-zA-Z0-9_-]{80,}/g,
        severity: 'critical',
    },
    // Anthropic
    {
        name: 'Anthropic API Key',
        provider: 'Anthropic',
        pattern: /sk-ant-[a-zA-Z0-9-]{90,}/g,
        severity: 'critical',
    },
    // Google
    {
        name: 'Google API Key',
        provider: 'Google',
        pattern: /AIza[0-9A-Za-z_-]{35}/g,
        severity: 'critical',
    },
    // Supabase
    {
        name: 'Supabase Service Role Key',
        provider: 'Supabase',
        pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
        severity: 'critical',
    },
    {
        name: 'Supabase Anon Key (if hardcoded)',
        provider: 'Supabase',
        pattern: /SUPABASE_ANON_KEY\s*[:=]\s*["']eyJ[^"']+["']/g,
        severity: 'medium',
    },
    // Stripe
    {
        name: 'Stripe Secret Key',
        provider: 'Stripe',
        pattern: /sk_live_[0-9a-zA-Z]{24,}/g,
        severity: 'critical',
    },
    {
        name: 'Stripe Test Key',
        provider: 'Stripe',
        pattern: /sk_test_[0-9a-zA-Z]{24,}/g,
        severity: 'medium',
    },
    {
        name: 'Stripe Webhook Secret',
        provider: 'Stripe',
        pattern: /whsec_[a-zA-Z0-9]{24,}/g,
        severity: 'critical',
    },
    // AWS
    {
        name: 'AWS Access Key ID',
        provider: 'AWS',
        pattern: /AKIA[0-9A-Z]{16}/g,
        severity: 'critical',
    },
    {
        name: 'AWS Secret Access Key',
        provider: 'AWS',
        pattern: /aws_secret_access_key\s*[:=]\s*["'][A-Za-z0-9/+=]{40}["']/gi,
        severity: 'critical',
    },
    // GitHub
    {
        name: 'GitHub Personal Access Token',
        provider: 'GitHub',
        pattern: /ghp_[a-zA-Z0-9]{36}/g,
        severity: 'critical',
    },
    {
        name: 'GitHub OAuth Token',
        provider: 'GitHub',
        pattern: /gho_[a-zA-Z0-9]{36}/g,
        severity: 'critical',
    },
    {
        name: 'GitHub Webhook Secret',
        provider: 'GitHub',
        pattern: /sha256=[a-fA-F0-9]{64}/g,
        severity: 'high',
    },
    // Telegram
    {
        name: 'Telegram Bot Token',
        provider: 'Telegram',
        pattern: /[0-9]{9,10}:[a-zA-Z0-9_-]{35}/g,
        severity: 'high',
    },
    // Discord
    {
        name: 'Discord Bot Token',
        provider: 'Discord',
        pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g,
        severity: 'high',
    },
    // Slack
    {
        name: 'Slack Bot Token',
        provider: 'Slack',
        pattern: /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g,
        severity: 'high',
    },
    // SendGrid
    {
        name: 'SendGrid API Key',
        provider: 'SendGrid',
        pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
        severity: 'high',
    },
    // Twilio
    {
        name: 'Twilio API Key',
        provider: 'Twilio',
        pattern: /SK[a-fA-F0-9]{32}/g,
        severity: 'high',
    },
    // Mailgun
    {
        name: 'Mailgun API Key',
        provider: 'Mailgun',
        pattern: /key-[a-zA-Z0-9]{32}/g,
        severity: 'high',
    },
    // Firebase
    {
        name: 'Firebase Database URL',
        provider: 'Firebase',
        pattern: /https:\/\/[a-z0-9-]+\.firebaseio\.com/g,
        severity: 'medium',
    },
    // Generic patterns
    {
        name: 'Private Key',
        provider: 'Generic',
        pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        severity: 'critical',
    },
    {
        name: 'Generic API Key Assignment',
        provider: 'Generic',
        pattern: /(api_key|apikey|api_secret|secret_key)\s*[:=]\s*["'][a-zA-Z0-9_-]{20,}["']/gi,
        severity: 'high',
    },
    {
        name: 'Password Assignment',
        provider: 'Generic',
        pattern: /(password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/gi,
        severity: 'high',
    },
    // Replicate
    {
        name: 'Replicate API Token',
        provider: 'Replicate',
        pattern: /r8_[a-zA-Z0-9]{38}/g,
        severity: 'critical',
    },
    // Hugging Face
    {
        name: 'Hugging Face Token',
        provider: 'Hugging Face',
        pattern: /hf_[a-zA-Z0-9]{34}/g,
        severity: 'critical',
    },
    // JWT Secrets
    {
        name: 'JWT Secret Assignment',
        provider: 'Generic',
        pattern: /JWT_SECRET\s*[:=]\s*["'][^"']{16,}["']/gi,
        severity: 'critical',
    },
    {
        name: 'Hardcoded JWT Sign',
        provider: 'Generic',
        pattern: /jwt\.(sign|verify)\s*\([^,]+,\s*["'][^"']{10,}["']/gi,
        severity: 'critical',
    },
    // OAuth Secrets
    {
        name: 'OAuth Client Secret',
        provider: 'Generic',
        pattern: /client_secret\s*[:=]\s*["'][a-zA-Z0-9_-]{20,}["']/gi,
        severity: 'critical',
    },
    {
        name: 'Google Client Secret',
        provider: 'Google',
        pattern: /GOOGLE_CLIENT_SECRET\s*[:=]\s*["'][^"']+["']/gi,
        severity: 'critical',
    },
    // Database Connection Strings
    {
        name: 'MongoDB Connection String',
        provider: 'MongoDB',
        pattern: /mongodb(\+srv)?:\/\/[^@\s]+@[^\s"']+/g,
        severity: 'critical',
    },
    {
        name: 'PostgreSQL Connection String',
        provider: 'PostgreSQL',
        pattern: /postgres(ql)?:\/\/[^\s"']+/g,
        severity: 'critical',
    },
    {
        name: 'MySQL Connection String',
        provider: 'MySQL',
        pattern: /mysql:\/\/[^\s"']+/g,
        severity: 'critical',
    },
    {
        name: 'Redis Connection String',
        provider: 'Redis',
        pattern: /redis:\/\/[^\s"']+/g,
        severity: 'high',
    },
];

/**
 * PII detection patterns
 */
export interface PIIPattern {
    name: string;
    pattern: RegExp;
    severity: 'high' | 'medium' | 'low';
}

export const PII_PATTERNS: PIIPattern[] = [
    {
        name: 'Email Address',
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        severity: 'medium',
    },
    {
        name: 'Phone Number (US)',
        pattern: /(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        severity: 'medium',
    },
    {
        name: 'Phone Number (International)',
        pattern: /\+[1-9]\d{1,14}/g,
        severity: 'medium',
    },
    {
        name: 'Social Security Number',
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        severity: 'high',
    },
    {
        name: 'Credit Card Number',
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        severity: 'high',
    },
    {
        name: 'IP Address',
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        severity: 'low',
    },
];

/**
 * Exposed route patterns for common frameworks
 */
export interface RoutePattern {
    name: string;
    framework: string;
    pattern: RegExp;
    severity: 'high' | 'medium' | 'low';
    description: string;
}

export const ROUTE_PATTERNS: RoutePattern[] = [
    // Next.js API routes
    {
        name: 'Next.js API Route (check for auth)',
        framework: 'Next.js',
        pattern: /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g,
        severity: 'medium',
        description: 'API route handler - verify authentication is implemented',
    },
    // Express routes
    {
        name: 'Express Route without Auth Middleware',
        framework: 'Express',
        pattern: /app\.(get|post|put|delete|patch)\s*\(\s*["'`][^"'`]+["'`]\s*,\s*(?!.*auth)/gi,
        severity: 'medium',
        description: 'Express route - check if auth middleware is applied',
    },
    // Admin routes
    {
        name: 'Admin Route Exposed',
        framework: 'Generic',
        pattern: /["'`](\/admin|\/dashboard|\/internal|\/private)[^"'`]*["'`]/gi,
        severity: 'high',
        description: 'Sensitive route - ensure proper authentication',
    },
];

/**
 * Security vulnerability patterns
 */
export interface VulnerabilityPattern {
    name: string;
    category: string;
    pattern: RegExp;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
}

export const VULNERABILITY_PATTERNS: VulnerabilityPattern[] = [
    // Hardcoded URLs
    {
        name: 'Localhost URL in Code',
        category: 'hardcoded-url',
        pattern: /https?:\/\/localhost[:\d]*/gi,
        severity: 'medium',
        description: 'Development URL - should use environment variables',
    },
    {
        name: 'Staging/Dev URL in Code',
        category: 'hardcoded-url',
        pattern: /https?:\/\/(staging\.|dev\.|test\.)[^\s"']+/gi,
        severity: 'medium',
        description: 'Non-production URL in code',
    },
    // Debug artifacts (skip console.log - too many false positives for CLI tools)
    {
        name: 'Debug Flag Enabled',
        category: 'debug',
        pattern: /DEBUG\s*[:=]\s*(true|1|["']true["'])/gi,
        severity: 'medium',
        description: 'Debug mode enabled - disable in production',
    },
    {
        name: 'Hardcoded Development Mode',
        category: 'debug',
        pattern: /NODE_ENV\s*[:=]\s*["']development["']/gi,
        severity: 'medium',
        description: 'Hardcoded development mode',
    },
    // CORS issues
    {
        name: 'CORS Wildcard Origin',
        category: 'cors',
        pattern: /Access-Control-Allow-Origin['":\s]+\*/g,
        severity: 'high',
        description: 'Allows requests from any origin - security risk',
    },
    {
        name: 'Permissive CORS Config',
        category: 'cors',
        pattern: /cors\s*\(\s*\)/g,
        severity: 'medium',
        description: 'CORS with default (permissive) settings',
    },
    // SQL Injection
    {
        name: 'SQL String Concatenation',
        category: 'injection',
        pattern: /query\s*\(\s*[`'"].*\$\{.*\}/g,
        severity: 'critical',
        description: 'Potential SQL injection - use parameterized queries',
    },
    {
        name: 'SQL String Addition',
        category: 'injection',
        pattern: /(SELECT|INSERT|UPDATE|DELETE).*["']\s*\+\s*\w+/gi,
        severity: 'critical',
        description: 'SQL built with string concatenation',
    },
    // XSS Vulnerabilities
    {
        name: 'React dangerouslySetInnerHTML',
        category: 'xss',
        pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html/g,
        severity: 'high',
        description: 'Renders raw HTML - ensure input is sanitized',
    },
    {
        name: 'Direct innerHTML Assignment',
        category: 'xss',
        pattern: /\.innerHTML\s*=/g,
        severity: 'high',
        description: 'Direct HTML injection - use textContent instead',
    },
    {
        name: 'Vue v-html Directive',
        category: 'xss',
        pattern: /v-html\s*=\s*["'][^"']+["']/g,
        severity: 'high',
        description: 'Vue raw HTML binding - ensure input is sanitized',
    },
    {
        name: 'Document Write',
        category: 'xss',
        pattern: /document\.write\s*\(/g,
        severity: 'high',
        description: 'Deprecated and potentially dangerous',
    },
    // Eval and code execution
    {
        name: 'Eval Usage',
        category: 'injection',
        pattern: /\beval\s*\(/g,
        severity: 'critical',
        description: 'Code execution - major security risk',
    },
    {
        name: 'Function Constructor',
        category: 'injection',
        pattern: /new\s+Function\s*\(/g,
        severity: 'high',
        description: 'Dynamic code execution risk',
    },
];

/**
 * Files/patterns to ignore
 */
export const IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.venv',
    '__pycache__',
    '*.min.js',
    '*.min.css',
    '*.map',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
];

/**
 * File extensions to scan
 */
export const SCANNABLE_EXTENSIONS = [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.py',
    '.rb',
    '.go',
    '.java',
    '.php',
    '.env',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.xml',
    '.md',
    '.txt',
    '.sql',
    '.sh',
    '.bash',
    '.zsh',
    '.vue',
    '.svelte',
];
