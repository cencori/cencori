# Cencori Scan — Feature Roadmap & Competitive Research

## Competitive Landscape

### Claude Code Security (Anthropic, Feb 2026) — Direct Competitor

Anthropic launched **Claude Code Security** in February 2026. This is the bar to beat:

- Reasons about code like a human security researcher — traces data flows, understands component interactions
- Multi-stage verification to minimize false positives
- GitHub Action for CI/CD — scans on every PR
- Catches memory corruption, auth bypasses, and logic errors (not just secrets/XSS regex hits)
- Confidence ratings on each finding
- Human-approved patches required before merging

### Other Key Players

| Tool | Killer Feature | Weakness |
|------|---------------|----------|
| **Snyk** | Developer-first SCA, IDE integration, auto-fix PRs | Expensive at scale, noisy false positives |
| **Semgrep** | 96% AI triage accuracy, custom rule language, fast monorepo scanning | Steep learning curve for custom rules |
| **CodeQL** | Deep semantic analysis, GitHub-native, incremental PR scanning | Complex, GitHub-only |
| **SonarQube** | Real-time IDE feedback, data flow vulnerability detection | Enterprise-heavy, complex setup |

---

## Features That Would Draw Developers

### Tier 1 — Build These First (Highest Impact)

#### 1. GitHub Action for PR Comments
Every PR gets automatic security review comments posted inline on changed files. Semgrep does this. Claude Code does this. It is now table stakes — and the highest-visibility surface to put Cencori in front of developers.

- Create a `cencori-scan` GitHub Action
- Post inline PR review comments on findings in changed files only
- Include severity badge and one-click fix suggestion link

#### 2. Dependency Scanning (SCA)
Currently the scanner only analyzes first-party code. Scanning `package.json`, `requirements.txt`, `go.mod` against known CVE databases would surface vulnerable dependencies — Snyk's #1 revenue driver. Every real codebase has critical CVEs in node_modules.

- Integrate with OSV (Google), NVD, or npm audit API
- Show affected version, fixed version, CVSS score
- Include in the fix PR when patches are available

#### 3. AI Confidence Scoring & Finding Reranking
Use the AI to rerank findings by actual exploitability, not just pattern match. Surface the one SQL injection that's actually reachable from user input over the ten console.logs that are noise.

- Assign 0–100 confidence to each finding
- Semgrep Assistant achieved 96% triage accuracy with this approach
- Dramatically reduces alert fatigue — the #1 developer complaint about security tools

---

### Tier 2 — Differentiated and Unique

#### 4. Git History Secret Scanning
Scan the last N commits, not just HEAD. A secret committed and deleted is still in git history and is fully compromised. No mainstream consumer-grade tool surfaces this cleanly.

#### 5. Fix Confidence Score on Auto-Fix PRs
When generating a fix PR, attach an explicit confidence score to each change.
> *"95% confident on the env var substitution — 67% confident on the SQL rewrite, please review carefully."*

No competitor does this transparently. Increases developer trust in automated fixes.

#### 6. Slack / Discord Security Alerts
Post a formatted summary to Slack or Discord when a scan completes or when score drops. The webhook infrastructure is already wired in — this is ~2 hours of implementation and makes the product feel alive in their workflow.

#### 7. SBOM Generation (Software Bill of Materials)
Export a CycloneDX or SPDX-format SBOM. Enterprise buyers and government contractors require this for compliance (NIST, SOC 2, EO 14028). None of the approachable tools do this well.

---

### Tier 3 — Longer-Term Moat

#### 8. Continuous Monitoring (Always-On)
Auto-scan on every push to main. Score regressions trigger alerts. Turns Cencori from a "scan once" tool into an always-on security dashboard — fundamentally changing the retention model.

#### 9. Security Score Over Time
A time-series graph of the project's security score (A→F) over the last 30/90 days. Developers and CTOs love seeing improvement they can point to. Also reveals regressions before they ship.

#### 10. Whole-Codebase AI Security Researcher
A chat interface where a developer asks *"does my app have an IDOR vulnerability?"* and the AI traces auth checks across the entire codebase to answer definitively — not per-file pattern matching but holistic reasoning.

This is what Claude Code Security is building toward. Cencori already has the chat infrastructure and can get there faster.

---

## Priority Order (Recommended)

1. **GitHub Action** — highest visibility, lowest cost, viral distribution
2. **Dependency scanning** — unlocks a whole new category of findings, expected by most developers
3. **AI confidence reranking** — directly improves accuracy perception
4. **Continuous monitoring** — transforms retention model
5. **Slack/Discord alerts** — low effort, high stickiness
6. **Git history scanning** — unique differentiator
7. **Fix confidence scores** — builds trust in auto-fix
8. **SBOM export** — opens enterprise sales motion
9. **Score over time** — engagement / retention feature
10. **Whole-codebase AI researcher** — long-term moat, most complex to build
