# Volume 4: Public Site Architecture and Design Doctrine

> Status: Canonical blueprint v1
> Locked: September 11, 2026
> Audience: design, brand, product, engineering, marketing, and founders
> Scope: the public Cencori website. Dashboard and documentation interfaces may inherit the system, but retain their own usability requirements.

---

## DES-01: Design Objective

The website must make Cencori feel like a deep technology company with a focused product wedge, a serious technical thesis, visible proof, and a credible path into physical infrastructure.

The desired impression is not “well-designed AI SaaS.” It is:

- frontier computing laboratory
- industrial infrastructure company
- rigorous scientific institution
- new African technological power
- builders with unreasonable conviction

The website should create scale through clarity, technical artifacts, and controlled tension—not decorative futurism.

---

## DES-02: Current-Site Diagnosis

The current homepage begins to express the larger ambition, then collapses back into a Gateway-company structure.

Primary issues:

- the hero says “global AI” is already running on Cencori while the public denominator is extrapolated
- provider logos make Cencori look downstream of other AI companies
- Gateway is presented as the central product instead of the live foundation
- pricing appears before the technical company thesis is established
- the navigation exposes too many product and audience fragments
- equal columns, bordered boxes, and repeated CTAs create a familiar SaaS template rhythm
- the site has almost no expression of Models, workload architecture, research, physical systems, Africa, or the infrastructure horizon
- blog cards are used as filler instead of evidence tied to company claims

The redesign must reverse this hierarchy.

---

## DES-03: Primary Navigation

The locked desktop navigation is:

```text
[Cencori]   Models   Infrastructure   Industries   Research   Company   Developers      Console   Talk to us
```

Navigation behavior:

- **Models** is the first company/product destination.
- **Infrastructure** explains the system and contains the live Gateway entry point.
- **Industries** shows where Cencori intends to apply the infrastructure without pretending every vertical is already deployed.
- **Research** publishes technical work and the longer research agenda.
- **Company** contains the thesis, Africa, team, news, and careers.
- **Developers** leads to the developer hub and documentation.
- **Console** is a quiet utility action.
- **Talk to us** is the institutional CTA.

Pricing is not a primary navigation item. Gateway and any self-serve Models pricing remain discoverable on their product pages and in the footer.

On mobile, the navigation becomes a full-height index with status labels and short descriptions. It does not become a cramped accordion of every legacy route.

---

## DES-04: Site Map

### Primary public routes

| Route | Role |
| --- | --- |
| `/` | establish belief, company, wedge, invention, proof, horizon, and origin |
| `/models` | explain the flagship model lifecycle product and its technical differentiation |
| `/infrastructure` | show how control plane, workload system, runtime, compute, edge, and future hardware connect |
| `/ai-gateway` | sell and document the live Gateway foundation |
| `/industries` | organize priority problem spaces and guarantees by industry |
| `/research` | publish technical themes, experiments, papers, benchmarks, and prototypes |
| `/company` | company thesis, Africa, principles, team, timeline, and careers |
| `/developers` | developer entry point across docs, SDKs, examples, status, and console |

### Utility and evidence routes

- `/docs`
- `/blog`
- `/changelog`
- `/customers`
- `/security`
- `/status`
- `/contact`
- `/careers`
- `/partners`
- `/pricing`

### Route discipline

- Only **Live** and substantial **In development** products receive standalone marketing pages.
- **Next**, **Long-term**, and **Research horizon** work appears inside Infrastructure or Research until there is enough technical substance for a dedicated page.
- Existing useful routes remain operational during the transition; later implementation should map them into the new hierarchy or redirect them intentionally.
- No navigation item may lead to an empty promise page.

---

## DES-05: Homepage Narrative Layout

The homepage is one continuous argument. Every section should answer the question created by the section above it.

### Desktop wireframe

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ DETACHED STRUCTURAL NAVIGATION                                              │
├──────────────────────────────────────────────┬─────────────────────────────-┤
│ 01 / HERO — 7 columns                        │ LIVING WORKLOAD SYSTEM — 5   │
│ The infrastructure AI runs on.               │ model / data / code / policy │
│ Short supporting line                        │ resolving into execution     │
│ [Explore Models]  [Talk to Cencori]          │ nodes and physical targets   │
├─────────────────────────────────────────────────────────────────────────────┤
│ VERIFIED PROOF RAIL — only sourced, dated operating or adoption evidence    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 02 / BELIEF                                                                 │
│ AI is moving into every enterprise, industry, critical system, and machine. │
│                                        We are building what it will run on. │
├──────────────────────────────┬──────────────────────────────────────────────┤
│ 03 / WE BEGIN WITH MODELS    │ Train → Fine-tune → Evaluate → Deploy → Run  │
│ Product thesis + status      │ Interactive model lifecycle artifact         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 04 / TECHNICAL INVENTION                                                    │
│ Define the workload. Cencori assembles the system.                          │
│ [inputs] → [portable workload graph] → [compiler/runtime] → [targets]       │
├──────────────────────────────────────────────┬───────────────────────────── ┤
│ 05 / LIVE FOUNDATION                        │ REAL TELEMETRY / TRACE        │
│ Gateway, control, security, observability    │ Build with Gateway           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 06 / INFRASTRUCTURE HORIZON                                                 │
│ Model → Runtime → Compute fabric → Edge/regions → Hardware → New substrates │
│ Exact status label attached to every horizon                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 07 / INDUSTRIES — asymmetric problem matrix, not equal marketing cards      │
│ enterprise / government / energy / finance / health / mobility / research   │
├──────────────────────────────┬──────────────────────────────────────────────┤
│ 08 / AFRICA                  │ A NEW CENTER OF COMPUTING                    │
│ real places, constraints,    │ strategic thesis + physical infrastructure   │
│ partners, and field evidence │ consequence                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 09 / BUILT. MEASURED. DEPLOYED.                                             │
│ Research notes / benchmark / deployment / changelog — each tied to evidence │
├─────────────────────────────────────────────────────────────────────────────┤
│ 10 / CLOSE                                                                  │
│ Build what comes next.     [Explore Models] [Build with Gateway] [Talk]     │
├─────────────────────────────────────────────────────────────────────────────┤
│ MINIMAL EVIDENCE-LED FOOTER                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Section rules

#### 01. Hero

- The headline is exactly “The computing infrastructure AI runs on.”
- The hero is asymmetric: language occupies roughly seven columns; the system artifact occupies five.
- The visual is an operational workload diagram, not particles, an orb, a brain, a robot, or an invented chip.
- Primary CTA: **Explore Models**.
- Secondary CTA: **Talk to Cencori**.
- Gateway is not the hero.

#### Proof rail

- May include three to five verified signals.
- Each signal carries an as-of date or time window.
- If strong proof is not available, use one substantial technical artifact instead of weak numbers or borrowed logos.

#### 02. Belief

- A single large statement with aggressive negative space.
- No supporting card grid.
- Motion can reveal the sentence in two conceptual halves: where AI is moving, then what Cencori is building.

#### 03. Models

- Present the complete lifecycle, not a model catalog.
- Show input artifacts and constraints becoming a running deployment.
- Clearly label the product **In development** until launch status changes.
- Provide an interest, design-partner, or waitlist CTA appropriate to the real program.

#### 04. Technical invention

- This is the intellectual center of the site.
- The workload graph should be inspectable: selecting latency, cost, residency, or reliability changes the execution path shown.
- Use real architectural vocabulary without drowning the reader in implementation detail.

#### 05. Live foundation

- Show Gateway as proof that Cencori already operates in the path of AI workloads.
- Use a real request trace or anonymized operational view.
- Provider marks may appear inside the architecture as endpoints, never as the site's primary social proof.

#### 06. Infrastructure horizon

- Use a horizontal or scroll-linked system cutaway.
- Every layer carries one of the five canonical status labels.
- Do not attach speculative release dates.
- Hardware and quantum appear only at the far research edge, with restrained language.

#### 07. Industries

- Organize by difficult system requirement, then show industries that share it.
- Example requirements: sovereignty, real-time operation, regulated data, physical autonomy, variable connectivity, scientific throughput.
- This avoids pretending Cencori already sells a separate finished solution to every vertical.

#### 08. Africa

- Use real geography, infrastructure conditions, builders, research, and field work.
- No decorative outline of the continent and no generic stock imagery.
- Lead with why the geography changes the technical system and why that matters globally.

#### 09. Evidence

- A benchmark, field note, deployment, or release is more valuable than three generic blog cards.
- Each item states what was built or learned.
- Research and engineering writing should feel like part of the product, not content marketing.

#### 10. Close

- End with participation, not a pricing comparison.
- Route developers, technical partners, and institutions through separate actions.

---

## DES-06: Models Page Layout

The Models page must make clear why Cencori Models is not a prettier GPU rental or managed endpoint.

```text
01 Hero: From model to production, as one system.
   Status + Train / Fine-tune / Evaluate / Deploy / Run

02 The input contract
   Model + data + repository + constraints + target environment

03 The workload graph
   Inspectable technical artifact showing the portable representation

04 One lifecycle
   Experiment → checkpoint → evaluation → registry → optimization → release

05 The constraint-aware runtime
   Cost / latency / residency / reliability decisions and resulting topology

06 Deployment targets
   Shared cloud / dedicated / sovereign / edge, shown with honest statuses

07 Controls
   Security / observability / policy / billing / recovery

08 Proof
   Benchmarks, workload traces, design partners, or technical milestones

09 CTA
   Apply as a design partner / join access / talk to the team
```

The page should expose technical depth progressively: a clear first read for leadership, then details for infrastructure engineers.

---

## DES-07: Infrastructure Page Layout

```text
01 Hero: One system beneath the workload.
02 System map: Control plane / workload graph / runtime / capacity / targets
03 Live foundation: Gateway and verified control-plane capability
04 Next system: Models, runtime, managed compute
05 Distributed future: regions, sovereignty, edge, physical AI
06 Dedicated future: hardware and silicon driven by workload evidence
07 Research horizon: new computing substrates
08 Status ledger: every layer and its exact public status
09 CTA: build, partner, or research with Cencori
```

The infrastructure map must show causal relationships. It should never become a wall of independent product cards.

---

## DES-08: Industries Page Layout

The industry architecture starts from system requirements rather than sales verticals.

```text
01 Hero: Intelligence is becoming part of the world's critical systems.
02 Requirement matrix
   sovereignty / real-time / regulated / physical / resilient / scientific
03 Industry territories
   financial systems / government / energy and industry / healthcare /
   mobility and robotics / telecommunications / research and science
04 Deployment patterns
   cloud / sovereign / on-premise / edge
05 Proof by territory
   only real pilots, deployments, and partnerships
06 CTA: describe the system you need to run
```

Dedicated industry pages should be created only after Cencori has proof or a defined solution package for that territory.

---

## DES-09: Research and Company Layouts

### Research

```text
01 Research position: computing systems for intelligence
02 Active themes
   model systems / efficient inference / workload scheduling /
   edge and physical AI / dedicated hardware / frontier substrates
03 Published artifacts
   papers / benchmarks / experiments / prototypes / technical notes
04 Collaboration
   universities / researchers / institutions / open technical problems
```

Research horizon topics must look more restrained than live product surfaces, not more cinematic.

### Company

```text
01 Company definition and mission
02 The belief and company thesis
03 The sequence: workload before server, server before silicon
04 A new center of computing — the Africa thesis
05 Principles and operating standard
06 Team and real working environment
07 Company timeline and build evidence
08 Careers / partnerships / contact
```

The Company page absorbs the strongest parts of the current About and Manifesto pages into one coherent institutional story.

---

## DES-10: Visual Doctrine

### Name

The visual direction is **Precision Industrial Editorial**.

It combines institutional typography, computing-system diagrams, physical material cues, and editorial restraint. It must not look like cyberpunk, gaming hardware, a crypto protocol, or a generic dark AI template.

### Palette

- carbon black as the primary field, never absolute browser black
- mineral white for text and occasional technical-paper surfaces
- graphite and steel neutrals
- one signal green reserved for verified live state, measured activity, and successful system flow
- amber and red remain semantic warnings, not brand accents

The signal color is functional. It is not sprayed across headings, gradients, buttons, and decoration.

### Typography

- one characterful variable grotesk for display and body
- one precise mono face for telemetry, statuses, coordinates, and technical annotations
- the wordmark remains a distinct brand asset
- no decorative serif italics as a recurring AI-website device
- large headlines use tight tracking and approximately 0.9–0.98 line height
- body copy stays within roughly 60–68 characters
- numbers use tabular figures

Final font files should be selected after visual prototype testing against the Cencori wordmark. The locked requirement is the typographic behavior, not an untested font name.

### Imagery

Use:

- real machines and compute infrastructure
- real engineering environments and prototypes
- real builders, institutions, and locations
- field deployments and physical systems
- macro material photography
- technical diagrams, workload traces, benchmark plots, and system cutaways

Do not use:

- glowing brains
- generic AI particles
- floating glass cards
- robot stock imagery
- fake server rooms
- fabricated chip photographs presented as product evidence
- decorative maps of Africa with no technical meaning

### Graphic language

- workload nodes and execution graphs
- rack coordinates and system labels
- measured lines, crop marks, and registration details used sparingly
- topology maps and deployment cutaways
- diagrams that reveal causality
- no random circuit-board texture behind every section

### Motion

Motion should feel mechanical and computational:

- execution paths resolve
- nodes bind to targets
- workload state progresses
- traces accumulate
- diagrams reveal in controlled stages

Use transform and opacity, custom physical easing, and reduced-motion fallbacks. Avoid infinite logo marquees, constant particle fields, scroll hijacking, and decorative motion with no informational purpose.

---

## DES-11: Layout System

### Desktop

- 12-column grid
- maximum canvas around 1440 px
- primary content width around 1240–1320 px
- responsive gutters from 32–80 px
- section spacing from 144–224 px when the narrative needs scale
- frequent 7/5, 5/7, and 8/4 asymmetry
- full-width statements only when a single idea deserves dominance

### Mobile

- one-column reading order
- 20–24 px side gutters
- 72–112 px section spacing
- system diagrams become horizontally inspectable or step through states; they do not shrink into illegibility
- status, product name, and CTA remain visible without hover
- no rotated overlaps or touch-conflicting z-axis effects

### Component grammar

The core public components are:

- `StatusLabel`
- `ProofMetric`
- `ProofArtifact`
- `WorkloadNode`
- `SystemTrace`
- `ArchitectureCutaway`
- `HorizonRail`
- `IndustryRequirementMatrix`
- `ResearchEntry`
- `InstitutionalCTA`

Cards are not the default content container. Use rails, matrices, cutaways, annotated imagery, and open editorial composition.

---

## DES-12: Footer Architecture

The footer is evidence-led and compact.

```text
Cencori
The infrastructure AI runs on.

Build                 Company              Evidence               Work with us
Models                Thesis               Research               Enterprise
Gateway               Africa               Changelog              Government
Infrastructure        Team                 Customers              Partnerships
Developers / Docs     Careers              Status / Security      Contact

Legal / Privacy / Terms / Social / ©
```

Do not expose every internal product experiment or legacy route in the footer.

---

## DES-13: Launch Scope

The first redesign release should fully design and implement:

1. Homepage
2. Models
3. Infrastructure
4. Industries
5. Research
6. Company
7. Global navigation and footer
8. Gateway integration into the new public shell

Developers, documentation, blog, changelog, security, status, contact, legal, and console can retain existing functionality while inheriting the new shell in controlled passes.

The visual redesign must not break live product flows or rewrite the application dashboard.

---

## DES-14: Design Review Test

Before approving a page, ask:

1. Does the page express a specific Cencori idea or a generic AI-company pattern?
2. Is the most ambitious claim paired with the most serious artifact?
3. Can the reader identify what is live, in development, next, long-term, and research?
4. Does the design make provider brands more prominent than Cencori?
5. Are diagrams explanatory or decorative?
6. Does Africa change the strategic argument, or appear as an afterthought?
7. Is the page still compelling with every animation disabled?
8. Does the mobile layout preserve the argument instead of merely stacking boxes?
9. Is every visible number verifiable?
10. Does the result feel difficult to imitate because the thinking is specific, not because the effects are expensive?
