# @cencori/scan

Security scanner for AI apps. Detect hardcoded secrets, PII leaks, and exposed routes.

## Installation

```bash
# Run directly with npx
npx @cencori/scan

# Or install globally
npm install -g @cencori/scan
```

## Usage

```bash
# Scan current directory
cencori-scan

# Scan specific path
cencori-scan ./my-project

# Output JSON
cencori-scan --json

# Quiet mode (score only)
cencori-scan --quiet
```

## What It Detects

### API Keys & Secrets
- OpenAI, Anthropic, Google AI
- Supabase, Firebase
- Stripe, AWS, GitHub
- And 20+ more providers

### PII (Personal Identifiable Information)
- Email addresses
- Phone numbers
- Social Security Numbers
- Credit card numbers

### Exposed Routes
- Next.js API routes without auth
- Express routes without middleware
- Sensitive files in public folders

## Security Score

| Score | Meaning |
|-------|---------|
| A-Tier | Excellent - No issues found |
| B-Tier | Good - Minor improvements needed |
| C-Tier | Fair - Some concerns |
| D-Tier | Poor - Significant issues |
| F-Tier | Critical - Leaking secrets |

## Example Output

```
Cencori Scan
v0.1.0

Scanned 142 files

┌─────────────────────────────────────────────┐
│   Security Score: F-Tier                    │
└─────────────────────────────────────────────┘

SECRETS (3)
├─ src/api.ts:12  sk-proj-****
├─ src/lib.ts:5   eyJh****
└─ .env.local:3   ANTH****

Recommendations:
  - Use environment variables for secrets
  - Never commit API keys to version control

Share: https://scan.cencori.com
Docs:  https://cencori.com/docs
```

## Programmatic Usage

```typescript
import { scan } from '@cencori/scan';

const result = await scan('./my-project');

console.log(result.score);  // 'A' | 'B' | 'C' | 'D' | 'F'
console.log(result.issues); // Array of detected issues
```

## License

MIT - Cencori
