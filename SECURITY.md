# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

To report a vulnerability, please email **security@cencori.com** with:

1.  A description of the vulnerability
2.  Steps to reproduce the issue
3.  Potential impact assessment
4.  Any suggested fixes (optional)

### Response Timeline

| Stage | Target Time |
|-------|-------------|
| Acknowledgment | 24 hours |
| Triage & Impact Assessment | 72 hours |
| Fix Development | 7-14 days |
| Coordinated Disclosure | 30 days |

We are committed to working with security researchers and will acknowledge your contribution when the fix is released.

## Security Measures

Cencori implements the following security measures by default:

- **PII Detection**: Automatic filtering of emails, SSNs, phone numbers
- **Prompt Injection Protection**: Pattern-based detection of jailbreak attempts
- **Audit Logging**: Immutable logs of all AI requests
- **Rate Limiting**: Per-user and per-project request limits
- **Encryption**: All data encrypted in transit (TLS 1.3) and at rest

## Bug Bounty

We are evaluating a formal bug bounty program. In the meantime, responsible disclosures may be eligible for recognition and swag.

---

## Cencori Scan

In addition to our platform security measures, we provide **Cencori Scan** — a proactive security scanner for your codebase.

```bash
npx @cencori/scan
```

**What it detects:**
- Hardcoded secrets (50+ providers: OpenAI, Anthropic, AWS, Stripe, etc.)
- PII exposure (emails, SSNs, phone numbers, credit cards)
- Exposed routes and endpoints
- SQL injection, XSS, and other vulnerabilities

**Learn more:** [Cencori Scan Documentation](https://cencori.com/docs/security/scan)
