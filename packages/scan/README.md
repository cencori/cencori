# @cencori/scan

**Security scanner for AI apps.** Detect hardcoded secrets, PII leaks, exposed routes, and security vulnerabilities — with AI-powered auto-fix.

[![npm version](https://img.shields.io/npm/v/@cencori/scan.svg)](https://www.npmjs.com/package/@cencori/scan)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
npx @cencori/scan
```

That's it. Run it in any project directory to instantly scan for security issues.

## Features

- **Pattern-based scanning** - Detects 50+ types of secrets, PII, and vulnerabilities
- **Cencori AI auto-fix** - Automatically fixes issues with one command
- **Fast** - Scans thousands of files in seconds
- **Zero config** - Works out of the box
- **Security scoring** - A through F tier grading

## Installation

```bash
# Run directly (recommended)
npx @cencori/scan

# Or install globally
npm install -g @cencori/scan

# Or as a dev dependency
npm install -D @cencori/scan
```

## Usage

### Basic Scan

```bash
# Scan current directory
npx @cencori/scan

# Scan specific path
npx @cencori/scan ./my-project

# Output JSON (for CI/CD)
npx @cencori/scan --json

# Quiet mode (score only)
npx @cencori/scan --quiet

# Skip interactive prompts
npx @cencori/scan --no-prompt
```

### AI Auto-Fix (Pro)

After scanning, you'll be prompted:

```
? Would you like Cencori to auto-fix these issues? (y/n)
```

Enter `y` and you'll be asked for your API key (if not already saved):

```
? Enter your Cencori API key: ************************
```

The AI will:
1. Analyze each issue for false positives
2. Generate secure code fixes
3. Apply fixes automatically

Your API key is saved to `~/.cencorirc` for future scans.

**Get your free API key at [cencori.com/dashboard](https://cencori.com/dashboard)**

## What It Detects

### API Keys & Secrets

| Provider | Pattern |
|----------|---------|
| OpenAI | `sk-...`, `sk-proj-...` |
| Anthropic | `sk-ant-...` |
| Google AI | `AIza...` |
| Supabase | `eyJh...` (service role) |
| Stripe | `sk_live_...`, `sk_test_...` |
| AWS | `AKIA...` |
| GitHub | `ghp_...`, `gho_...` |
| Firebase | `firebase-adminsdk-...` |
| And 20+ more... | |

### PII (Personal Identifiable Information)

- Email addresses in code
- Phone numbers
- Social Security Numbers
- Credit card numbers

### Exposed Routes

- Next.js API routes without authentication
- Express routes without auth middleware
- Sensitive files in `/public` folders
- Dashboard/admin routes without protection

### Security Vulnerabilities

- SQL injection patterns
- XSS vulnerabilities (innerHTML, dangerouslySetInnerHTML)
- Insecure CORS configuration (`Access-Control-Allow-Origin: *`)
- Hardcoded passwords
- Debug modes in production

## Security Score

| Score | Meaning | Action Required |
|-------|---------|-----------------|
| **A-Tier** | Excellent | No security issues detected |
| **B-Tier** | Good | Minor improvements recommended |
| **C-Tier** | Fair | Some concerns need attention |
| **D-Tier** | Poor | Significant issues found |
| **F-Tier** | Critical | Secrets or major vulnerabilities exposed |

## Changelog Generation

Generate AI-powered changelogs from your git commit history.

```bash
# Generate weekly changelog
npx @cencori/scan changelog

# Custom time range
npx @cencori/scan changelog --since="2 weeks ago"

# Output to file
npx @cencori/scan changelog --output=CHANGELOG.md

# JSON format
npx @cencori/scan changelog --format=json
```

### Example Output

```markdown
## Changelog (Jan 23, 2026 - Jan 30, 2026)

### Features

- Added AI-powered changelog generation
- New security scanning patterns for AWS secrets

### Bug Fixes

- Fixed telemetry not sending before process exit

### Documentation

- Updated README with new examples
```

### Pro Tier (with API key)

Get human-readable, summarized changelogs with AI:
- Converts developer commit messages to user-facing language
- Intelligently groups related changes
- Highlights breaking changes automatically

## Example Output

```
  Cencori Scan
  v0.3.4

✔ Scanned 142 files

  ┌─────────────────────────────────────────────┐
  │   Security Score: D-Tier                    │
  └─────────────────────────────────────────────┘

  Poor! Significant security issues found.

  SECRETS (3)
  ├─ src/api.ts:12  sk-proj-****
  │  Hardcoded API key - use environment variables
  ├─ src/lib.ts:5   eyJh****
  │  Supabase service role key exposed
  └─ .env.local:3   ANTH****
     Anthropic API key in tracked file

  VULNERABILITIES (2)
  ├─ src/db.ts:45  `SELECT * FROM users WHERE id = ${userId}`
  │  Potential SQL injection - use parameterized queries
  └─ src/page.tsx:23  dangerouslySetInnerHTML={{ __html: content }}
     XSS vulnerability - sanitize content first

  ─────────────────────────────────────────────

  Summary
    Files scanned: 142
    Scan time: 89ms

  Recommendations:
    - Use environment variables for secrets
    - Never commit API keys to version control
    - Sanitize user input before rendering HTML

? Would you like Cencori to auto-fix these issues? (y/n)
```

## Programmatic Usage

```typescript
import { scan } from '@cencori/scan';

const result = await scan('./my-project');

console.log(result.score);        // 'A' | 'B' | 'C' | 'D' | 'F'
console.log(result.issues);       // Array of detected issues
console.log(result.filesScanned); // Number of files scanned
console.log(result.scanDuration); // Time in milliseconds
```

### TypeScript Types

```typescript
interface ScanResult {
  score: 'A' | 'B' | 'C' | 'D' | 'F';
  tierDescription: string;
  issues: ScanIssue[];
  filesScanned: number;
  scanDuration: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface ScanIssue {
  type: 'secret' | 'pii' | 'route' | 'config' | 'vulnerability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  name: string;
  match: string;
  file: string;
  line: number;
  description?: string;
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Scan

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Cencori Scan
        run: npx @cencori/scan --json > scan-results.json
      - name: Check for failures
        run: |
          SCORE=$(jq -r '.score' scan-results.json)
          if [[ "$SCORE" == "F" ]]; then
            echo "Security scan failed with F-Tier score"
            exit 1
          fi
```

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npx @cencori/scan --quiet --no-prompt
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CENCORI_API_KEY` | API key for AI features (optional) |

### Config File

API keys are automatically saved to `~/.cencorirc`:

```
api_key=your_cencori_api_key
```

## Privacy

Cencori Scan collects **anonymous usage metrics** to improve the product:
- Number of files scanned
- Number of issues found
- Security score
- Platform (macOS/Linux/Windows)

**No code, file paths, or sensitive data is ever transmitted.**

## Links

- **Documentation**: [cencori.com/docs](https://cencori.com/docs)
- **Dashboard**: [cencori.com/dashboard](https://cencori.com/dashboard)
- **Web Scanner**: [scan.cencori.com](https://scan.cencori.com)

## License

MIT - [Cencori](https://cencori.com)
