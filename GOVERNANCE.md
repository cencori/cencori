# Cencori Project Governance

> **Version**: 1.0  
> **Status**: Active  
> **Last Updated**: 2026-02-04

This document describes the governance model for the Cencori project.

---

## Mission

Cencori is the **unified infrastructure for AI production**. Our mission is to make shipping production-grade AI as easy as deploying a web app.

---

## Decision Making

### Core Maintainers

The project is led by a small group of Core Maintainers who have final authority on:

- Architecture and API design
- Release schedules
- Security policies
- Community standards

| Role | Responsibility |
|------|----------------|
| **Project Lead** | Overall direction, final decisions on disputes |
| **Tech Lead** | Architecture, code quality, technical standards |
| **Security Lead** | Vulnerability response, security audits |

### Request for Comments (RFC)

Major changes to the platform require an RFC (Request for Comments) before implementation.

**What requires an RFC:**
- New Primitives (e.g., a 6th primitive)
- Breaking API changes
- New authentication methods
- Changes to the security layer

**RFC Process:**
1.  Create a document in `/docs/rfcs/RFC-XXXX-title.md`
2.  Open a Pull Request for discussion
3.  Gather feedback for a minimum of 5 business days
4.  Core Maintainers approve or request changes
5.  Implement after approval

---

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking API changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, security patches

### Release Cadence

| Type | Frequency |
|------|-----------|
| Patch Releases | As needed (security) |
| Minor Releases | Bi-weekly |
| Major Releases | Quarterly (with deprecation notice) |

---

## Security Policy

### Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1.  **Do NOT** open a public GitHub issue.
2.  Email: `security@cencori.com`
3.  Include: Description, reproduction steps, potential impact.

We aim to acknowledge reports within **24 hours** and provide a fix timeline within **72 hours**.

### Disclosure Timeline

| Day | Action |
|-----|--------|
| 0 | Report received, acknowledgment sent |
| 1-7 | Triage and impact assessment |
| 7-30 | Develop and test fix |
| 30+ | Coordinated public disclosure |

---

## Code of Conduct

All contributors must adhere to the [Contributor Covenant](https://www.contributor-covenant.org/).

**Summary:**
- Be respectful and inclusive
- Assume good intent
- Focus on the work, not the person
- No harassment, discrimination, or personal attacks

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

**Quick Start:**
1.  Fork the repository
2.  Create a feature branch
3.  Write tests for new functionality
4.  Submit a Pull Request
5.  Address review feedback
