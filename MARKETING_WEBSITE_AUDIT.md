# Cencori marketing website audit

Source review · September 29, 2026 · Preparation for the pitch deck

The website communicates a serious, long-term computing mission. Its strongest current product story is the infrastructure between a model call and a working AI business: routing, security, state, tools, observability, governance, and billing. The main weakness is the bridge between that concrete foundation and the much larger computing company described on the homepage.

Preserve the ambition. Make the present product, its evidence, and the path into broader computing easier to understand.

## Scope and method

Reviewed public copy, navigation, page composition, capability dictionaries, pricing, customer/partner content, and selected announcements in the repository. The main inventory covers 83 page files: 62 marketing, 11 product, and 10 solution files. Additional review covered the homepage, Basecode and its plans, pricing, comparison, newsletter, Academy, documentation entry points, and legal branding. Reviewed the titles/excerpts of all 55 published newsroom files and read the announcements most relevant to the company/product story.

This is a source-based content audit. It does not establish deployed behavior, visual quality, backend implementation, customer contracts, certification status, or the accuracy of third-party comparisons. Documentation was reviewed as supporting product evidence, without auditing every reference or tutorial. Authenticated applications, internal tools, and the existing pitch deck are outside this phase.

The expanded inventory is in [MARKETING_WEBSITE_INVENTORY.md](/Users/apple/cencori/MARKETING_WEBSITE_INVENTORY.md). No product code was changed.

## What the company is saying

| Layer | Current public story | Assessment |
| --- | --- | --- |
| Company | The computing infrastructure AI runs on; accessible to everyone, everywhere | Coherent ambition with room to become a large company. |
| Thesis | AI moves from something people access to something the world operates | Strong explanation of why reliability, state, locality, control, and eventually hardware matter. |
| Present foundation | Gateway, security, governance, observability, memory, sessions, multimodal capabilities, and developer tooling | The clearest account appears in the company introduction and product announcements, rather than the homepage. |
| Agent infrastructure | Arcie, agent runtime, embedded agents, tools, memory, and durable execution | Promising, but the relationship and availability of these offerings need a simple explanation. |
| Expansion | Compute, private/sovereign/cloud/edge infrastructure, model lifecycle, research, and hardware | Present as an expansion path with explicit milestones and evidence. |
| First-party application | Basecode | Could demonstrate what the infrastructure enables. The public page needs a clearer workflow and reason to choose it. |

The [company introduction](/Users/apple/cencori/content/blog/2024-11-introducing-cencori.mdx:35) provides the best narrative discipline: it names what exists, then explicitly says the wider deployment vision does not exist yet. The [thesis](/Users/apple/cencori/content/thesis.mdx:567) also states that the mission is larger than today's products. Those distinctions should guide the deck.

## Findings across the public surface

| Pages / family | What works | What needs attention |
| --- | --- | --- |
| Homepage | Memorable category statement, consistent mission, product entry points, ecosystem logos, stories | It describes ambition before explaining the present product or a concrete customer problem. There is no concise mechanism or measured outcome in the opening proposition. |
| Thesis / manifesto | A coherent reason for infrastructure to expand across software and physical systems | The thesis is much longer than a pitch narrative. The manifesto's sweeping claims about future silicon and intelligent systems need the same availability discipline as the company introduction. |
| About | Founders are named; the Africa-origin story connects infrastructure access with who gets to build | The team section supplies names and roles, but little evidence of why this team can execute the mission. |
| Developers | Composable adoption; changing an existing API endpoint; practical FAQs | Training, hosting, GPU management, and physical-system use cases can read as current capabilities, while other pages describe them as future work. Several primary action paths terminate at placeholders. |
| AI Gateway / model catalog | A concrete integration story; routing, protection, monitoring, and end-user billing in one request path | Model/provider counts drift across pages. Interactive examples and sample security scores are illustrations, not traction or benchmark evidence. |
| Memory | Clear pain: lost context between sessions. Works independently of inference or through one gateway flag. Privacy/lifecycle controls are specific | Retrieval timings, regional guarantees, and competitive migration claims need measured support before reuse in slides. Its quota-based packaging needs to fit the platform pricing explanation. |
| Arcie | Explicitly distinguishes the available framework from the managed API in development | Navigation calls it a framework; its page calls it model-agnostic agent infrastructure. Explain how the framework, managed Arcie API, Sessions, and Embedded Agents relate. |
| Embedded Agents | The announcement identifies a concrete buyer/problem: SaaS teams rebuilding tenant isolation, versions, approvals, runs, and metering | This potentially valuable current product is buried in an announcement and docs; the main Agents page is a placeholder. Avoid equating its release with the availability of the separate Arcie managed API. |
| Cencori Web / MCP | Owned retrieval infrastructure and evidence provenance support a deeper infrastructure story | Web Tools and MCP navigation destinations are placeholders despite substantive public release articles and documentation. Corpus quality, usage, economics, and customer outcomes are missing from the landing story. |
| Basecode | Product screenshot, accessible Nigerian pricing, explicit model-cost weighting | The page gives a broad coding-agent promise but little workflow explanation or differentiation. Its download links target an absent section in the reviewed source. |
| Scan | A distinct security product; data-flow framing, remediation, and security history | Claims such as sub-100ms analysis, 32 PII types, and 500+ secret patterns need their measurement context. Scan is absent from the main product navigation despite being called live elsewhere. |
| Enterprise / Security | Describes real buyer concerns and a useful Gateway → Compute → Cloud sequence. Certification qualifications are explicit here | Older sales/enterprise pages contradict those qualifications. Regional and procurement claims need a consistent current/contractual/planned distinction. |
| Compute | Waitlist and enterprise roadmap provide an availability cue | GPU types, 200+ edge locations, cold starts, and uptime statistics are presented alongside a future offer. A visitor could mistake planned specifications for delivered infrastructure. |
| Workflow / Integration / Edge | Pages label upcoming capabilities and show intended use | Existing SDKs and future connectors/builders are bundled together. Explain which parts are usable now. |
| Older AI / Audit / Insights / Knight / Network / Sandbox / Developer Tools pages | Capture the original security and production-infrastructure pains | Vocabulary and branding differ from the current site: Protect, Knight, standalone primitives, and FohnAI support addresses. Consolidate or clearly place them in the current product map. |
| Solution pages | AI builders, developers, and fintech describe concrete operational problems and adoption mechanics | Developer/startup/security claims conflict with the pricing matrix. Numerous audiences are presented without corresponding case evidence; clinical/financial deployment claims should be scoped precisely. |
| Industries | Communicates the breadth of the thesis | All 10 sectors and 87 subsectors use the placeholder template. This is market territory, not evidence of vertical deployments. |
| Governments / Universities / Critical Systems / Edge & Physical AI | Important future environments | All four hubs and their 32 child destinations use placeholders. Product and deployment maturity are not established by their presence in navigation. |
| Agents / other capability pages | A comprehensive operating model is laid out | The Agents hub and its 10 children, 11 developer capability pages, 11 infrastructure pages, and 8 model capability pages are placeholders. |
| Research | Public engineering/research articles about caching and the owned web stack offer concrete substance | Six programs, 50 areas, and four research index pages use placeholders. Phrases about “credibility beyond startup AI” and the future identity of a research organization expose internal positioning intent instead of research results. |
| Stories / Customers | Three named stories: Eleven, Spitch, YPIT. Spitch includes an attributed volume quote | Stories are brief and lack measured before/after outcomes. Customers is generic filler despite an existing Stories surface. Distinguish a provider, customer, community program, and ecosystem partner. |
| Partners | Integration use cases and the RagMetrics proposition are specific | The directory mixes Cursor, Claude, and RagMetrics, while the homepage lists Spitch, Univad, and Celo. Integration compatibility and formal partnerships need distinct labels. Some regulatory and exclusivity assertions require external evidence. |
| Pricing | Freemium subscription with separately paid model usage; Free, Pro ($29/month), Team ($99/month), Enterprise | Pro/Team capabilities contradict blanket free-security promises. Team is priced but the footer says it is launching soon. Memory, Basecode, provider spend, and future compute need one understandable commercial map. |
| Newsroom / changelog / developer blog | A visible shipping history and specific product explanations | Model announcements dominate. Surface more original engineering, customer outcomes, and operational evidence. Two published Vision files share a slug. |
| Shipped / Events / Careers | Public destinations exist | Shipped and Events contain descriptive filler rather than releases/events. Careers clearly says no listings; that is more honest and useful. |
| Examples / docs / Academy | Low-friction entry into building; docs give a clearer request-layer explanation than the homepage | These support developer adoption. They do not substitute for customer outcomes or a moat argument in an investor deck. |
| Contact / contact sales | The new contact form accommodates different workloads | Two sales stories coexist; the older page leads with AI observability and an unqualified certification claim. |
| Status / newsletter / brand / legal | Supporting trust, distribution, and brand surfaces exist | Current status is not historical uptime evidence. The brand guideline download lacks a matching local asset in this source snapshot. Legal pages still identify Cencori as a FohnAI product while the footer says Cencori, Inc.; reconcile the public entity/brand description. |

## Highest-priority inconsistencies

1. **Certification status.** [Security](/Users/apple/cencori/app/(marketing)/security/page.tsx:121) says SOC 2 Type II is in progress. [Contact sales](/Users/apple/cencori/app/(marketing)/contact/sales/page.tsx:89) says compliant, and [the older enterprise solution](/Users/apple/cencori/app/solutions/enterprise/page.tsx:33) displays an unqualified SOC 2 Type II badge. Establish the actual status and use the same wording everywhere.
2. **Security availability by plan.** [Pricing](/Users/apple/cencori/components/landing/Pricing.tsx:158) excludes jailbreak detection, PII redaction, output scanning, and audit trails from Free. [Vibe-coder copy](/Users/apple/cencori/app/solutions/vibe-coders/page.tsx:184) promises security active on every request with zero configuration, and [Security](/Users/apple/cencori/app/(marketing)/security/page.tsx:216) says every control applies to every workload. Clarify the baseline and paid capabilities.
3. **Compute and broader deployment.** [Enterprise](/Users/apple/cencori/app/(marketing)/enterprise/page.tsx:222) marks Compute early access for Q4 2026 and Cloud preview for 2027. [Developers](/Users/apple/cencori/components/developers/DevelopersBuild.tsx:67) describes training and deploying custom models in the same way as usable product paths. Make availability explicit at the point of the claim.
4. **Evidence and counts.** [Developer solutions](/Users/apple/cencori/app/solutions/developers/page.tsx:197) claims 10,000+ developers; [fintech](/Users/apple/cencori/app/solutions/fintech/page.tsx:570) claims use by fintechs serving millions of customers. The reviewed customer material does not substantiate those totals. Model/provider counts also vary. Use a dated, attributable source for every number reused in the deck.
5. **Conversion paths.** [Basecode](/Users/apple/cencori/app/basecode/page.tsx:57) and its plans link to `#download`; neither source component defines that section. Navigation also advertises `/infrastructure/on-premise`, which has no matching entry in the reviewed capability dictionary or local redirect. `/models` deliberately redirects to a model catalog although navigation describes a training/deployment product; this creates an expectation mismatch rather than a missing route.
6. **Discoverability.** All 234 placeholder destinations appear in navigation data. The sitemap still favors older products and omits many current product/capability families. It also lists paths such as `/knight`, `/sandbox`, `/network`, and `/product-developer-tools` that do not match the page routes found in the repository. Reconcile discovery with the intended public product map.

The placeholder count describes page content, not whether the underlying capabilities are implemented. The copy itself says “We are building this page. Check back soon.” See [CapabilityStub](/Users/apple/cencori/components/marketing/CapabilityStub.tsx:29).

## Material worth carrying into the pitch

- **The transition:** AI moves from an interface people access to infrastructure the world operates. More capable models increase the need for reliable computing.
- **The present entry point:** Cencori removes repeated production work around models and agents. Existing applications can adopt it incrementally.
- **The mechanism:** model access + state/memory + tools + policy/approvals + observability + billing. Describe how these operate together, not simply how many features exist.
- **The deeper technology:** owned web retrieval, scoped/versioned embedded agents, persistent memory, durable sessions, and governed execution offer stronger technical substance than a provider-count headline. These are public product claims requiring implementation/results verification in a later phase.
- **The access story:** built from Africa for a global market, with concrete local-language voice capabilities and local pricing/distribution. Explain the advantage this produces rather than relying on geography alone.
- **Early evidence:** named stories, the attributed Spitch quote, the shipping record, the open-source framework, and NVIDIA Inception membership. Confirm the scope and attribution of each; membership alone is not an investment or customer relationship.
- **The expansion:** today's request and agent infrastructure grows into model lifecycle, compute, and private/regional/edge deployment. Show what each step requires and how the current foundation helps reach it.

## Missing evidence before writing investor claims

The reviewed marketing material does not provide a consistent, dated account of revenue, paying customers, retention, usage growth, gross margin, production reliability, or demonstrated savings. Sample dashboards, projected markup examples, and hypothetical request volumes are not company metrics. In particular, examples of an app developer marking up model usage describe that customer's economics; they do not establish Cencori's revenue or margin. The platform subscription, Basecode subscription, and proposed compute usage charges need to be explained separately.

For the next phase, assemble actual commercial and operating figures; classify the named organizations by relationship; obtain two detailed customer outcomes; document the important technical advantages and benchmarks; establish the initial buyer/acquisition path; and connect the proposed expansion to milestones, required capital, and team capability.

The deck should explain **why this future requires infrastructure, what Cencori operates today, who relies on it, why the technology is difficult to replace, and how that foundation expands into the broader mission**. The website already contains the ingredients. They need one consistent hierarchy and stronger evidence.
