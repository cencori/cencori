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
    // Vercel
    {
        name: 'Vercel Access Token',
        provider: 'Vercel',
        pattern: /vercel_[a-zA-Z0-9]{24,}/gi,
        severity: 'critical',
    },
    // Cloudflare
    {
        name: 'Cloudflare API Token',
        provider: 'Cloudflare',
        pattern: /[a-zA-Z0-9_-]{40}(?=.*cloudflare)/gi,
        severity: 'critical',
    },
    {
        name: 'Cloudflare Global API Key',
        provider: 'Cloudflare',
        pattern: /CF_API_KEY\s*[:=]\s*["'][a-fA-F0-9]{37}["']/gi,
        severity: 'critical',
    },
    // Azure
    {
        name: 'Azure Storage Account Key',
        provider: 'Azure',
        pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88}/g,
        severity: 'critical',
    },
    {
        name: 'Azure AD Client Secret',
        provider: 'Azure',
        pattern: /AZURE_CLIENT_SECRET\s*[:=]\s*["'][a-zA-Z0-9~._-]{34,}["']/gi,
        severity: 'critical',
    },
    // DigitalOcean
    {
        name: 'DigitalOcean Access Token',
        provider: 'DigitalOcean',
        pattern: /dop_v1_[a-fA-F0-9]{64}/g,
        severity: 'critical',
    },
    {
        name: 'DigitalOcean OAuth Token',
        provider: 'DigitalOcean',
        pattern: /doo_v1_[a-fA-F0-9]{64}/g,
        severity: 'critical',
    },
    // Datadog
    {
        name: 'Datadog API Key',
        provider: 'Datadog',
        pattern: /DD_API_KEY\s*[:=]\s*["'][a-fA-F0-9]{32}["']/gi,
        severity: 'high',
    },
    // PlanetScale
    {
        name: 'PlanetScale Database Token',
        provider: 'PlanetScale',
        pattern: /pscale_tkn_[a-zA-Z0-9_-]{43}/g,
        severity: 'critical',
    },
    {
        name: 'PlanetScale OAuth Token',
        provider: 'PlanetScale',
        pattern: /pscale_otkn_[a-zA-Z0-9_-]{43}/g,
        severity: 'critical',
    },
    // Neon
    {
        name: 'Neon Database Connection String',
        provider: 'Neon',
        pattern: /postgres(ql)?:\/\/[^\s"']*neon\.tech[^\s"']*/g,
        severity: 'critical',
    },
    // Pinecone
    {
        name: 'Pinecone API Key',
        provider: 'Pinecone',
        pattern: /PINECONE_API_KEY\s*[:=]\s*["'][a-fA-F0-9-]{36}["']/gi,
        severity: 'critical',
    },
    // Resend
    {
        name: 'Resend API Key',
        provider: 'Resend',
        pattern: /re_[a-zA-Z0-9]{32,}/g,
        severity: 'high',
    },
    // Clerk
    {
        name: 'Clerk Secret Key',
        provider: 'Clerk',
        pattern: /sk_live_[a-zA-Z0-9]{24,}/g,
        severity: 'critical',
    },
    {
        name: 'Clerk Publishable Key (if hardcoded)',
        provider: 'Clerk',
        pattern: /pk_live_[a-zA-Z0-9]{24,}/g,
        severity: 'medium',
    },
    // Upstash
    {
        name: 'Upstash Redis Token',
        provider: 'Upstash',
        pattern: /UPSTASH_REDIS_REST_TOKEN\s*[:=]\s*["'][A-Za-z0-9=]+["']/gi,
        severity: 'critical',
    },
    // Turso
    {
        name: 'Turso Database Token',
        provider: 'Turso',
        pattern: /TURSO_AUTH_TOKEN\s*[:=]\s*["'][a-zA-Z0-9._-]+["']/gi,
        severity: 'critical',
    },
    // Linear
    {
        name: 'Linear API Key',
        provider: 'Linear',
        pattern: /lin_api_[a-zA-Z0-9]{40,}/g,
        severity: 'high',
    },
    // Convex
    {
        name: 'Convex Deploy Key',
        provider: 'Convex',
        pattern: /CONVEX_DEPLOY_KEY\s*[:=]\s*["'][a-zA-Z0-9|:]+["']/gi,
        severity: 'critical',
    },
    // Railway
    {
        name: 'Railway API Token',
        provider: 'Railway',
        pattern: /RAILWAY_TOKEN\s*[:=]\s*["'][a-fA-F0-9-]{36}["']/gi,
        severity: 'critical',
    },
    // npm
    {
        name: 'npm Access Token',
        provider: 'npm',
        pattern: /npm_[a-zA-Z0-9]{36}/g,
        severity: 'critical',
    },
    // PyPI
    {
        name: 'PyPI API Token',
        provider: 'PyPI',
        pattern: /pypi-AgEIcHlwaS5vcmc[a-zA-Z0-9_-]{50,}/g,
        severity: 'critical',
    },
    // Doppler
    {
        name: 'Doppler Service Token',
        provider: 'Doppler',
        pattern: /dp\.st\.[a-zA-Z0-9_-]{40,}/g,
        severity: 'critical',
    },
    // Fly.io
    {
        name: 'Fly.io Access Token',
        provider: 'Fly.io',
        pattern: /FLY_ACCESS_TOKEN\s*[:=]\s*["'][a-zA-Z0-9_-]{40,}["']/gi,
        severity: 'critical',
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
    // Debug artifacts
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
    // ── SSRF ──
    {
        name: 'SSRF via User-Controlled URL',
        category: 'ssrf',
        pattern: /fetch\s*\(\s*(?:req\.|request\.|params\.|query\.|body\.|url|input)/gi,
        severity: 'critical',
        description: 'Fetch with user-controlled URL — risk of server-side request forgery',
    },
    {
        name: 'SSRF via Axios Request',
        category: 'ssrf',
        pattern: /axios\s*\.\s*(?:get|post|put|delete|patch|request)\s*\(\s*(?:req\.|request\.|params\.|body\.|url|input)/gi,
        severity: 'critical',
        description: 'Axios call with user-controlled URL — SSRF risk',
    },
    // ── Path Traversal ──
    {
        name: 'Path Traversal in File Operations',
        category: 'path-traversal',
        pattern: /(?:readFile|readFileSync|createReadStream|readdir|writeFile|writeFileSync|unlink|unlinkSync)\s*\(\s*(?:req\.|request\.|params\.|query\.|body\.|input|userPath|filePath)/gi,
        severity: 'critical',
        description: 'File operation with user-controlled path — directory traversal risk',
    },
    {
        name: 'Path Join with User Input',
        category: 'path-traversal',
        pattern: /path\.(?:join|resolve)\s*\([^)]*(?:req\.|request\.|params\.|query\.|body\.|input)/gi,
        severity: 'high',
        description: 'path.join/resolve with user input — validate path does not escape base directory',
    },
    // ── Prototype Pollution ──
    {
        name: 'Prototype Pollution via __proto__',
        category: 'prototype-pollution',
        pattern: /\[\s*["']__proto__["']\s*\]/g,
        severity: 'critical',
        description: 'Direct __proto__ access — prototype pollution vector',
    },
    {
        name: 'Prototype Pollution via constructor.prototype',
        category: 'prototype-pollution',
        pattern: /\bconstructor\s*\.\s*prototype\b/g,
        severity: 'high',
        description: 'Accessing constructor.prototype — prototype pollution risk',
    },
    {
        name: 'Recursive Merge without Sanitization',
        category: 'prototype-pollution',
        pattern: /(?:deepMerge|merge|extend|defaultsDeep)\s*\([^)]*(?:req\.|request\.|body\.|input|user)/gi,
        severity: 'high',
        description: 'Deep merge with user input — prototype pollution risk',
    },
    // ── Open Redirect ──
    {
        name: 'Open Redirect via res.redirect',
        category: 'open-redirect',
        pattern: /res\.redirect\s*\(\s*(?:req\.|request\.|params\.|query\.|body\.|url|redirect)/gi,
        severity: 'high',
        description: 'Redirect with user-controlled URL — validate against allowlist',
    },
    {
        name: 'Open Redirect via window.location',
        category: 'open-redirect',
        pattern: /(?:window\.location|location\.href)\s*=\s*(?:(?!['"]).)+/g,
        severity: 'medium',
        description: 'Dynamic location assignment — potential open redirect',
    },
    // ── Insecure Deserialization ──
    {
        name: 'JSON.parse of Unsanitized Input',
        category: 'deserialization',
        pattern: /JSON\.parse\s*\(\s*(?:req\.|request\.|body\.|input|user|data(?!\.))/gi,
        severity: 'high',
        description: 'JSON.parse of user-controlled input — validate before parsing',
    },
    {
        name: 'Python Pickle Deserialization',
        category: 'deserialization',
        pattern: /pickle\.loads?\s*\(/g,
        severity: 'critical',
        description: 'Pickle deserialization — arbitrary code execution risk',
    },
    {
        name: 'YAML Unsafe Load',
        category: 'deserialization',
        pattern: /yaml\.(?:load|unsafe_load)\s*\(/g,
        severity: 'critical',
        description: 'Unsafe YAML deserialization — use safe_load instead',
    },
    // ── Weak Cryptography ──
    {
        name: 'MD5 for Security',
        category: 'weak-crypto',
        pattern: /createHash\s*\(\s*["']md5["']\s*\)/gi,
        severity: 'high',
        description: 'MD5 is cryptographically broken — use SHA-256 or bcrypt',
    },
    {
        name: 'SHA1 for Security',
        category: 'weak-crypto',
        pattern: /createHash\s*\(\s*["']sha1["']\s*\)/gi,
        severity: 'medium',
        description: 'SHA-1 has known collision attacks — use SHA-256+',
    },
    {
        name: 'Math.random for Security Token',
        category: 'weak-crypto',
        pattern: /Math\.random\s*\(\s*\).*(?:token|secret|key|password|nonce|salt|session|csrf)/gi,
        severity: 'high',
        description: 'Math.random() is not cryptographically secure — use crypto.randomBytes',
    },
    {
        name: 'Weak Cipher Algorithm',
        category: 'weak-crypto',
        pattern: /createCipher(?:iv)?\s*\(\s*["'](?:des|rc4|rc2|blowfish)["']/gi,
        severity: 'critical',
        description: 'Weak cipher algorithm — use AES-256-GCM',
    },
    // ── Command Injection ──
    {
        name: 'Shell Command with Template Literal',
        category: 'command-injection',
        pattern: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*`[^`]*\$\{/g,
        severity: 'critical',
        description: 'Shell command with interpolated values — command injection risk',
    },
    {
        name: 'Shell Command with String Concat',
        category: 'command-injection',
        pattern: /(?:exec|execSync)\s*\(\s*["'][^"']*["']\s*\+/g,
        severity: 'critical',
        description: 'Shell command built with string concatenation',
    },
    {
        name: 'Python os.system',
        category: 'command-injection',
        pattern: /os\.system\s*\(/g,
        severity: 'high',
        description: 'os.system is vulnerable to injection — use subprocess with shell=False',
    },
    {
        name: 'Python subprocess with shell=True',
        category: 'command-injection',
        pattern: /subprocess\.(?:Popen|call|run)\s*\([^)]*shell\s*=\s*True/g,
        severity: 'critical',
        description: 'subprocess with shell=True — command injection risk',
    },
    // ── Regex DoS ──
    {
        name: 'ReDoS Vulnerable Pattern',
        category: 'redos',
        pattern: /new\s+RegExp\s*\(\s*(?:req\.|request\.|params\.|query\.|body\.|input|user)/gi,
        severity: 'high',
        description: 'User-controlled regex — ReDoS denial-of-service risk',
    },
    // ── Insecure Authentication ──
    {
        name: 'JWT Algorithm None',
        category: 'insecure-auth',
        pattern: /algorithm\s*:\s*["']none["']/gi,
        severity: 'critical',
        description: 'JWT with algorithm "none" — signature verification disabled',
    },
    {
        name: 'Bcrypt Low Rounds',
        category: 'insecure-auth',
        pattern: /(?:bcrypt|genSalt)\s*\(\s*[1-9]\s*[),]/g,
        severity: 'high',
        description: 'Bcrypt with rounds < 10 — increase to at least 10',
    },
    {
        name: 'Hardcoded CSRF Disable',
        category: 'insecure-auth',
        pattern: /csrf\s*[:=]\s*(?:false|disabled)/gi,
        severity: 'high',
        description: 'CSRF protection disabled — re-enable for state-changing requests',
    },
    {
        name: 'Password Comparison with ==',
        category: 'timing-attack',
        pattern: /(?:password|secret|token|apiKey|api_key)\s*===?\s*(?:req\.|request\.|body\.|input|params\.)/gi,
        severity: 'high',
        description: 'Non-constant-time comparison — use crypto.timingSafeEqual',
    },
    // ── Template Injection ──
    {
        name: 'Server-Side Template Injection',
        category: 'template-injection',
        pattern: /(?:render|compile|template)\s*\(\s*(?:req\.|request\.|body\.|input|user)/gi,
        severity: 'critical',
        description: 'Template rendering with user input — server-side template injection risk',
    },
    // ── Sensitive Logging ──
    {
        name: 'Password Logged',
        category: 'sensitive-logging',
        pattern: /console\.(?:log|info|debug|warn)\s*\([^)]*(?:password|passwd|pwd|secret|token|apiKey|api_key|accessToken|access_token|private_key|privateKey)/gi,
        severity: 'high',
        description: 'Sensitive data in console output — remove before production',
    },
    // ── Insecure Cookie Configuration ──
    {
        name: 'Cookie without Secure Flag',
        category: 'insecure-cookie',
        pattern: /secure\s*:\s*false/gi,
        severity: 'high',
        description: 'Cookie not marked secure — will be sent over HTTP',
    },
    {
        name: 'Cookie without HttpOnly',
        category: 'insecure-cookie',
        pattern: /httpOnly\s*:\s*false/gi,
        severity: 'high',
        description: 'Cookie accessible to JavaScript — XSS exfiltration risk',
    },
    {
        name: 'Cookie SameSite None',
        category: 'insecure-cookie',
        pattern: /sameSite\s*:\s*["'](?:none|None)["']/g,
        severity: 'medium',
        description: 'Cookie sent on cross-site requests — CSRF risk',
    },
    // ── Mass Assignment ──
    {
        name: 'Mass Assignment via Request Body',
        category: 'mass-assignment',
        pattern: /\.create\s*\(\s*(?:req\.body|request\.body)\s*\)|\.(update|insert)\s*\(\s*(?:req\.body|request\.body)/gi,
        severity: 'high',
        description: 'ORM operation with raw request body — whitelist allowed fields',
    },
    // ── Missing Security Headers ──
    {
        name: 'X-Frame-Options Missing (Clickjacking)',
        category: 'security-headers',
        pattern: /helmet\s*\(\s*\{[^}]*frameguard\s*:\s*false/gi,
        severity: 'medium',
        description: 'Clickjacking protection disabled — enable frameguard',
    },
    // ── Insecure File Upload ──
    {
        name: 'File Upload without Validation',
        category: 'file-upload',
        pattern: /multer\s*\(\s*\{[^}]*(?!fileFilter)/g,
        severity: 'medium',
        description: 'File upload without file type validation — add fileFilter',
    },
    // ── Hardcoded IP Binding ──
    {
        name: 'Server Listening on 0.0.0.0',
        category: 'network',
        pattern: /\.listen\s*\([^)]*["']0\.0\.0\.0["']/g,
        severity: 'medium',
        description: 'Server bound to all interfaces — restrict in production',
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
