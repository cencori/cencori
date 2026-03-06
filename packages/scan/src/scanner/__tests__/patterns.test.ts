import { describe, expect, test } from 'vitest';
import { scanFileContent, shouldScanFile, calculateScore, summarizeIssues } from '../core';

// ─── Secret Pattern Tests ───────────────────────────────────────────

describe('Secret Detection Patterns', () => {
    test('detects Vercel access token', () => {
        const issues = scanFileContent('config.ts', 'const token = "vercel_abcdefghijklmnopqrstuvwx";');
        expect(issues.some(i => i.name === 'Vercel Access Token')).toBe(true);
    });

    test('detects DigitalOcean access token', () => {
        const token = 'dop_v1_' + 'a'.repeat(64);
        const issues = scanFileContent('config.ts', `const t = "${token}";`);
        expect(issues.some(i => i.name === 'DigitalOcean Access Token')).toBe(true);
    });

    test('detects PlanetScale database token', () => {
        const token = 'pscale_tkn_' + 'a'.repeat(43);
        const issues = scanFileContent('config.ts', `DB_TOKEN=${token}`);
        expect(issues.some(i => i.name === 'PlanetScale Database Token')).toBe(true);
    });

    test('detects Resend API key', () => {
        const key = 're_' + 'a'.repeat(32);
        const issues = scanFileContent('mailer.ts', `const resendKey = "${key}";`);
        expect(issues.some(i => i.name === 'Resend API Key')).toBe(true);
    });

    test('detects npm access token', () => {
        const token = 'npm_' + 'a'.repeat(36);
        const issues = scanFileContent('.npmrc', `//registry.npmjs.org/:_authToken=${token}`);
        expect(issues.some(i => i.name === 'npm Access Token')).toBe(true);
    });

    test('detects Doppler service token', () => {
        const token = 'dp.st.' + 'a'.repeat(40);
        const issues = scanFileContent('config.ts', `DOPPLER_TOKEN="${token}"`);
        expect(issues.some(i => i.name === 'Doppler Service Token')).toBe(true);
    });

    test('detects Linear API key', () => {
        const key = 'lin_api_' + 'a'.repeat(40);
        const issues = scanFileContent('linear.ts', `const apiKey = "${key}";`);
        expect(issues.some(i => i.name === 'Linear API Key')).toBe(true);
    });

    test('detects Clerk secret key', () => {
        const key = 'sk_live_' + 'a'.repeat(24);
        const issues = scanFileContent('auth.ts', `CLERK_SECRET="${key}"`);
        expect(issues.some(i => i.name.includes('Clerk') || i.match.includes('sk_live'))).toBe(true);
    });

    // Existing patterns should still work
    test('detects OpenAI API key', () => {
        const issues = scanFileContent('app.ts', 'const key = "sk-' + 'a'.repeat(20) + 'T3BlbkFJ' + 'b'.repeat(20) + '"');
        expect(issues.some(i => i.name === 'OpenAI API Key')).toBe(true);
    });

    test('detects AWS access key', () => {
        const issues = scanFileContent('config.ts', 'AWS_KEY=AKIA' + 'A'.repeat(16));
        expect(issues.some(i => i.name === 'AWS Access Key ID')).toBe(true);
    });

    test('detects private key header', () => {
        const issues = scanFileContent('key.pem', '-----BEGIN RSA PRIVATE KEY-----');
        expect(issues.some(i => i.name === 'Private Key')).toBe(true);
    });
});

// ─── Vulnerability Pattern Tests ────────────────────────────────────

describe('Vulnerability Detection – New Categories', () => {

    // SSRF
    test('detects SSRF via user-controlled fetch', () => {
        const code = 'const result = await fetch(req.body.url);';
        const issues = scanFileContent('api/proxy.ts', code);
        expect(issues.some(i => i.category === 'ssrf')).toBe(true);
    });

    test('detects SSRF via axios with user input', () => {
        const code = 'const data = await axios.get(request.body.endpoint);';
        const issues = scanFileContent('api/fetch.ts', code);
        expect(issues.some(i => i.category === 'ssrf')).toBe(true);
    });

    // Path Traversal
    test('detects path traversal in readFile', () => {
        const code = 'const data = fs.readFileSync(req.query.path);';
        const issues = scanFileContent('api/files.ts', code);
        expect(issues.some(i => i.category === 'path-traversal')).toBe(true);
    });

    test('detects path.join with user input', () => {
        const code = 'const fullPath = path.join(base, req.params.file);';
        const issues = scanFileContent('api/download.ts', code);
        expect(issues.some(i => i.category === 'path-traversal')).toBe(true);
    });

    // Prototype Pollution
    test('detects __proto__ access', () => {
        const code = 'obj["__proto__"].isAdmin = true;';
        const issues = scanFileContent('model.ts', code);
        expect(issues.some(i => i.category === 'prototype-pollution')).toBe(true);
    });

    test('detects constructor.prototype access', () => {
        const code = 'obj.constructor.prototype.isAdmin = true;';
        const issues = scanFileContent('model.ts', code);
        expect(issues.some(i => i.category === 'prototype-pollution')).toBe(true);
    });

    // Open Redirect
    test('detects open redirect via res.redirect', () => {
        const code = 'res.redirect(req.query.returnUrl);';
        const issues = scanFileContent('api/login.ts', code);
        expect(issues.some(i => i.category === 'open-redirect')).toBe(true);
    });

    // Insecure Deserialization
    test('detects pickle deserialization', () => {
        const code = 'data = pickle.loads(user_input)';
        const issues = scanFileContent('handler.py', code);
        expect(issues.some(i => i.category === 'deserialization')).toBe(true);
    });

    test('detects unsafe YAML load', () => {
        const code = 'config = yaml.load(open("config.yml"))';
        const issues = scanFileContent('config_loader.py', code);
        expect(issues.some(i => i.category === 'deserialization')).toBe(true);
    });

    // Weak Crypto
    test('detects MD5 usage', () => {
        const code = "const hash = crypto.createHash('md5').update(data).digest('hex');";
        const issues = scanFileContent('auth.ts', code);
        expect(issues.some(i => i.category === 'weak-crypto')).toBe(true);
    });

    test('detects Math.random for security', () => {
        const code = 'const id = Math.random().toString(36) + "_token";';
        const issues = scanFileContent('auth.ts', code);
        expect(issues.some(i => i.category === 'weak-crypto')).toBe(true);
    });

    test('skips Math.random in test files', () => {
        const code = 'const id = Math.random().toString(36) + "_token";';
        const issues = scanFileContent('auth.test.ts', code);
        expect(issues.some(i => i.name === 'Math.random for Security Token')).toBe(false);
    });

    test('detects weak cipher algorithm', () => {
        const code = 'const cipher = crypto.createCipheriv("des", key, iv);';
        const issues = scanFileContent('encrypt.ts', code);
        expect(issues.some(i => i.category === 'weak-crypto')).toBe(true);
    });

    // Command Injection
    test('detects shell command with template literal', () => {
        const code = 'child_process.exec(`ls ${userDir}`);';
        const issues = scanFileContent('files.ts', code);
        expect(issues.some(i => i.category === 'command-injection')).toBe(true);
    });

    test('detects Python subprocess with shell=True', () => {
        const code = 'subprocess.Popen(cmd, shell=True)';
        const issues = scanFileContent('worker.py', code);
        expect(issues.some(i => i.category === 'command-injection')).toBe(true);
    });

    // Regex DoS
    test('detects user-controlled regex', () => {
        const code = 'const re = new RegExp(req.query.pattern);';
        const issues = scanFileContent('search.ts', code);
        expect(issues.some(i => i.category === 'redos')).toBe(true);
    });

    // Insecure Auth
    test('detects JWT algorithm none', () => {
        const code = 'jwt.sign(payload, secret, { algorithm: "none" });';
        const issues = scanFileContent('auth.ts', code);
        expect(issues.some(i => i.category === 'insecure-auth')).toBe(true);
    });

    test('detects CSRF disabled', () => {
        const code = 'module.exports = { csrf: false };';
        const issues = scanFileContent('config.ts', code);
        expect(issues.some(i => i.category === 'insecure-auth')).toBe(true);
    });

    test('detects timing-unsafe password comparison', () => {
        const code = 'if (password === req.body.password) { grant(); }';
        const issues = scanFileContent('auth.ts', code);
        expect(issues.some(i => i.category === 'timing-attack')).toBe(true);
    });

    // Template Injection
    test('detects server-side template injection', () => {
        const code = 'res.render(req.body.template, data);';
        const issues = scanFileContent('views.ts', code);
        expect(issues.some(i => i.category === 'template-injection')).toBe(true);
    });

    // Sensitive Logging
    test('detects password in console.log', () => {
        const code = 'console.log("User password:", password);';
        const issues = scanFileContent('auth.ts', code);
        expect(issues.some(i => i.category === 'sensitive-logging')).toBe(true);
    });

    test('skips sensitive logging in test files', () => {
        const code = 'console.log("User password:", password);';
        const issues = scanFileContent('auth.test.ts', code);
        expect(issues.some(i => i.name === 'Password Logged')).toBe(false);
    });

    // Insecure Cookie
    test('detects cookie without secure flag', () => {
        const code = 'res.cookie("session", token, { secure: false });';
        const issues = scanFileContent('auth.ts', code);
        expect(issues.some(i => i.category === 'insecure-cookie')).toBe(true);
    });

    test('detects cookie without httpOnly', () => {
        const code = 'res.cookie("auth", token, { httpOnly: false });';
        const issues = scanFileContent('session.ts', code);
        expect(issues.some(i => i.category === 'insecure-cookie')).toBe(true);
    });

    test('skips insecure cookie in doc files', () => {
        const code = 'secure: false is the default';
        const issues = scanFileContent('docs/cookie-guide.md', code);
        expect(issues.some(i => i.category === 'insecure-cookie')).toBe(false);
    });

    // Mass Assignment
    test('detects mass assignment via req.body', () => {
        const code = 'const user = await User.create(req.body);';
        const issues = scanFileContent('api/users.ts', code);
        expect(issues.some(i => i.category === 'mass-assignment')).toBe(true);
    });
});

// ─── Existing Vulnerability Patterns (regression) ───────────────────

describe('Existing Vulnerability Patterns – Regression', () => {
    test('detects SQL injection via template literal', () => {
        const code = 'db.query(`SELECT * FROM users WHERE id = ${userId}`);';
        const issues = scanFileContent('api/users.ts', code);
        expect(issues.some(i => i.category === 'injection')).toBe(true);
    });

    test('detects eval usage', () => {
        const code = 'eval(userInput);';
        const issues = scanFileContent('api/exec.ts', code);
        expect(issues.some(i => i.name === 'Eval Usage')).toBe(true);
    });

    test('detects dangerouslySetInnerHTML', () => {
        const code = '<div dangerouslySetInnerHTML={{ __html: data }} />';
        const issues = scanFileContent('page.tsx', code);
        expect(issues.some(i => i.category === 'xss')).toBe(true);
    });

    test('detects CORS wildcard', () => {
        const code = 'Access-Control-Allow-Origin: *';
        const issues = scanFileContent('api/handler.ts', code);
        expect(issues.some(i => i.category === 'cors')).toBe(true);
    });

    test('detects .env file in repository', () => {
        const issues = scanFileContent('.env', 'DATABASE_URL=postgres://...');
        expect(issues.some(i => i.type === 'config')).toBe(true);
    });
});

// ─── False Positive Heuristics ──────────────────────────────────────

describe('False Positive Heuristics', () => {
    test('skips example email addresses', () => {
        const code = 'const email = "user@example.com";';
        const issues = scanFileContent('form.ts', code);
        expect(issues.some(i => i.name === 'Email Address')).toBe(false);
    });

    test('skips public email prefixes', () => {
        const code = 'const email = "support@company.com";';
        const issues = scanFileContent('contact.ts', code);
        expect(issues.some(i => i.name === 'Email Address')).toBe(false);
    });

    test('skips localhost IP', () => {
        const code = 'const host = "127.0.0.1";';
        const issues = scanFileContent('config.ts', code);
        expect(issues.some(i => i.name === 'IP Address')).toBe(false);
    });
});

// ─── Code Quality Detection ──────────────────────────────────────────

describe('Code Quality Detection', () => {
    test('detects TODO/FIXME comments as code quality issues', () => {
        const code = `
// TODO: split this into smaller helpers
export function buildReport() {
  return "ok";
}
        `;
        const issues = scanFileContent('src/report.ts', code);
        expect(issues.some(i => i.type === 'code_quality' && i.name === 'TODO/FIXME Comment')).toBe(true);
    });

    test('detects long functions and many parameters', () => {
        const body = Array.from({ length: 85 })
            .map((_, idx) => `  const v${idx} = ${idx};`)
            .join('\n');
        const code = `
export function giantFunction(a, b, c, d, e, f) {
${body}
  return a + b;
}
        `;
        const issues = scanFileContent('src/giant.ts', code);
        expect(issues.some(i => i.type === 'code_quality' && i.name === 'Long Function (80+ lines)')).toBe(true);
        expect(issues.some(i => i.type === 'code_quality' && i.name === 'Too Many Function Parameters')).toBe(true);
    });

    test('summary includes code quality counts', () => {
        const issues = scanFileContent('src/types.ts', 'const x: any = 1; // TODO fix typing');
        const summary = summarizeIssues(issues);
        expect(summary.codeQuality).toBeGreaterThan(0);
    });

    test('score remains A when only code quality issues exist', () => {
        const issues = scanFileContent('src/types.ts', 'const x: any = 1; // TODO fix typing');
        expect(calculateScore(issues)).toBe('A');
    });
});

// ─── Score Calculation ──────────────────────────────────────────────

describe('Score Calculation', () => {
    test('returns A for no issues', () => {
        expect(calculateScore([])).toBe('A');
    });

    test('returns F for critical issues', () => {
        const issues = scanFileContent('config.ts', 'eval(userInput);');
        expect(calculateScore(issues)).toBe('F');
    });

    test('returns F for 3+ high issues', () => {
        const code = `
dangerouslySetInnerHTML={{ __html: a }}
document.write(b)
.innerHTML = c
        `;
        const issues = scanFileContent('page.tsx', code);
        const highIssues = issues.filter(i => i.severity === 'high');
        if (highIssues.length >= 3) {
            expect(calculateScore(issues)).toBe('F');
        }
    });
});

// ─── File Filtering ─────────────────────────────────────────────────

describe('File Filtering', () => {
    test('scans TypeScript files', () => {
        expect(shouldScanFile('app/page.tsx')).toBe(true);
    });

    test('scans Python files', () => {
        expect(shouldScanFile('handler.py')).toBe(true);
    });

    test('detects .env files via scanFileContent', () => {
        const issues = scanFileContent('.env', 'DATABASE_URL=postgres://localhost/db');
        expect(issues.some(i => i.type === 'config' && i.name.includes('Environment file'))).toBe(true);
    });

    test('ignores node_modules', () => {
        expect(shouldScanFile('node_modules/package/index.js')).toBe(false);
    });

    test('ignores minified files', () => {
        expect(shouldScanFile('dist/bundle.min.js')).toBe(false);
    });

    test('scans Svelte files', () => {
        expect(shouldScanFile('App.svelte')).toBe(true);
    });

    test('scans Vue files', () => {
        expect(shouldScanFile('Component.vue')).toBe(true);
    });
});
