"use client";

import Image from "next/image";
import { useEffect } from "react";

const competitors = [
  {
    company: "AWS",
    logo: "/pitch/logos/aws.svg",
    logoStyle: "aws",
    owns: "Cloud, compute, networking, custom AI chips",
    gap: "Optimized around AWS infrastructure",
    source: "https://aws.amazon.com/ai/infrastructure/",
  },
  {
    company: "Microsoft Azure",
    logo: "/pitch/logos/microsoft.svg",
    logoStyle: "microsoft",
    owns: "AI infrastructure from silicon to systems",
    gap: "Deep vertical stack, centered on Azure",
    source: "https://azure.microsoft.com/en-us/explore/global-infrastructure/silicon-systems",
  },
  {
    company: "NVIDIA",
    logo: "/pitch/logos/nvidia.svg",
    logoStyle: "nvidia",
    owns: "Chips, systems, networking, AI software",
    gap: "Extremely deep hardware stack, centered on NVIDIA infrastructure",
    source: "https://www.nvidia.com/en-us/solutions/ai-factories/",
  },
  {
    company: "Palantir",
    logo: "/pitch/logos/palantir.svg",
    logoStyle: "palantir",
    owns: "Enterprise data, models, agents, operations",
    gap: "Strong operational software layer, not neutral infrastructure across the entire compute stack",
    source: "https://www.palantir.com/docs/foundry/platform-overview/aip-capabilities",
  },
  {
    company: "Baseten / Modal",
    logo: "/pitch/logos/developer-infrastructure.jpg",
    logoStyle: "developer",
    owns: "Inference + developer compute",
    gap: "Strong developer infrastructure, but concentrated around inference/compute rather than the whole stack",
    source: "https://www.baseten.co/",
  },
] as const;

const recognitionSources = [
  {
    name: "TechCabal",
    logo: "/pitch/recognition/techcabal.png",
    width: 300,
    height: 67,
    style: "techcabal",
    article: "Meet the Nigerian startup trying to secure the age of vibe coding",
    url: "https://techcabal.com/2026/01/15/vibe-coding-and-nigerias-cencori/",
  },
  {
    name: "NVIDIA Inception",
    logo: "/pitch/logos/nvidia.svg",
    width: 163,
    height: 108,
    style: "nvidia",
    article: "Cencori joins NVIDIA Inception",
    url: "https://cencori.com/newsroom/cencori-joins-nvidia-inception",
  },
  {
    name: "Connecting Africa",
    logo: "/pitch/recognition/connecting.svg",
    width: 500,
    height: 147,
    style: "connecting",
    article: "Hot startup of the month: Nigeria's Cencori",
    url: "https://www.connectingafrica.com/ai/hot-startup-of-the-month-nigeria-s-cencori",
  },
  {
    name: "Afrolaunch",
    logo: "/pitch/recognition/afrolaunch.png",
    width: 379,
    height: 56,
    style: "afrolaunch",
    article: "Cencori — African Startup Directory",
    url: "https://afrolaunch.com/startups/cencori",
  },
  {
    name: "Tech With Africa",
    logo: "/pitch/recognition/tech-with-africa-horizontal.png",
    width: 272,
    height: 90,
    style: "tech-with-africa",
    article: "How Daniel Oreofe is Building Cencori & Dr. CV by Belycan",
    url: "https://www.techwithafrica.com/2026/06/09/how-daniel-oreofe-is-building-cencori-dr-cv-by-belycan/",
  },
  {
    name: "Africa Is Building",
    logo: "/pitch/recognition/africa-is-building.png",
    width: 192,
    height: 192,
    style: "africa-is-building",
    article: "Cencori — Africa Is Building",
    url: "https://www.africaisbuilding.com/products/cencori",
  },
] as const;

export default function PitchPage() {
  useEffect(() => {
    document.body.setAttribute("data-ready", "true");
    return () => document.body.removeAttribute("data-ready");
  }, []);

  return (
    <>
      <section className="pitch-section pitch-title" aria-labelledby="pitch-title">
        <div className="pitch-title-brand">
          <Image
            src="/logos/b.png"
            alt="Cencori"
            width={5237}
            height={628}
            sizes="100vw"
            priority
          />
        </div>

        <div className="pitch-title-bottom">
          <h1 id="pitch-title">The computing infrastructure AI runs on.</h1>
          <p className="pitch-title-meta">
            Bola Banjo
            <br />
            Pitch deck
            <br />
            2026
          </p>
        </div>
      </section>

      <section className="pitch-section pitch-thesis-split" aria-labelledby="pitch-thesis-title">
        <div className="pitch-thesis-top-left">
          <h2 id="pitch-thesis-title">Our thesis</h2>
          <p className="pitch-thesis-lead">The world is becoming intelligent faster than its infrastructure was designed to support.</p>
        </div>
        <div className="pitch-thesis-bottom-right">
          <p>AI is the most advanced technology of our generation</p>
          <p>It&apos;s going to be integrated into every critical industry, every company, every country</p>
        </div>
        <div className="pitch-thesis-top-right">
          <Image src="/pitch/wind-turbines.png" alt="Wind turbines at sunset" fill sizes="50vw" />
        </div>
        <div className="pitch-thesis-bottom-left">
          <Image src="/pitch/cargo-port.png" alt="Cargo port viewed from above" fill sizes="50vw" />
        </div>
      </section>

      <section className="pitch-section pitch-problem" aria-labelledby="pitch-problem-title">
        <h2 id="pitch-problem-title">The Problem</h2>

        <p className="pitch-problem-statement">
          <span>Critical industries were never built for AI.</span>
          <span>The problem is that the technology is fragmented. It was built to be operated, not think.</span>
        </p>

        <div
          className="pitch-problem-logos"
          role="img"
          aria-label="NVIDIA, Cursor, AMD, Oracle, Claude, AWS, Google, and OpenAI logos arranged as separate systems"
        >
          <div className="pitch-problem-logo pitch-problem-logo-nvidia">
            <Image src="/pitch/logos/nvidia.svg" alt="" fill sizes="(max-width: 640px) 72px, 140px" />
          </div>
          <div className="pitch-problem-logo pitch-problem-logo-cursor">
            <Image src="/pitch/logos/cursor.svg" alt="" fill sizes="(max-width: 640px) 72px, 140px" />
          </div>
          <div className="pitch-problem-logo pitch-problem-logo-amd">
            <Image src="/pitch/logos/amd.svg" alt="" fill sizes="(max-width: 640px) 72px, 140px" />
          </div>
          <div className="pitch-problem-logo pitch-problem-logo-oracle">
            <Image src="/pitch/logos/oracle.svg" alt="" fill sizes="(max-width: 640px) 72px, 140px" />
          </div>
          <div className="pitch-problem-logo pitch-problem-logo-claude">
            <Image src="/pitch/logos/claude.svg" alt="" fill sizes="(max-width: 640px) 72px, 140px" />
          </div>
          <div className="pitch-problem-logo pitch-problem-logo-aws">
            <Image src="/pitch/logos/aws.svg" alt="" fill sizes="(max-width: 640px) 72px, 140px" />
          </div>
          <div className="pitch-problem-logo pitch-problem-logo-google">
            <Image src="/pitch/logos/google.png" alt="" fill sizes="(max-width: 640px) 72px, 140px" />
          </div>
          <div className="pitch-problem-logo pitch-problem-logo-openai">
            <Image src="/pitch/logos/openai.svg" alt="" fill sizes="(max-width: 640px) 72px, 140px" />
          </div>
        </div>

        <div className="pitch-problem-support">
          <p>The models exist. The infrastructure to put intelligence into critical systems does not.</p>
        </div>
      </section>

      <section className="pitch-section pitch-solutions" aria-labelledby="pitch-solutions-title">
        <div className="pitch-solutions-left">
          <div className="pitch-solutions-intro">
            <h2 id="pitch-solutions-title">Our Solution</h2>
            <p>We make critical systems AI-native.</p>
          </div>
          <div className="pitch-solutions-pillars">
            <div className="pitch-solutions-pillar">
              <h3>Connect</h3>
              <p>Unify machines, sensors, software and operational data.</p>
            </div>
            <div className="pitch-solutions-pillar">
              <h3>Computing</h3>
              <p>Run AI where critical workloads actually happen — cloud, edge or on-premise (sovereign).</p>
            </div>
            <div className="pitch-solutions-pillar">
              <h3>Act</h3>
              <p>Turn real-time data into predictions, decisions and autonomous operations.</p>
            </div>
          </div>
        </div>
        <div className="pitch-solutions-right">
          <p>We build the network that makes the world’s critical systems intelligent.</p>
        </div>
        <div className="pitch-solutions-mark" role="img" aria-label="Cencori logo mark">
          <Image src="/pitch/cencori-mark-white.svg" alt="" width={25} height={25} />
        </div>
      </section>

      <section className="pitch-section pitch-market-opportunity" aria-labelledby="pitch-market-title">
        <h2 id="pitch-market-title">The market we are entering</h2>
        <ul className="pitch-market-metrics">
          <li>
            <strong>$1.48T</strong>
            <p>AI infrastructure <span className="pitch-market-caption-pair">spend <small>2026</small></span></p>
          </li>
          <li>
            <strong>$1.98T</strong>
            <p><span className="pitch-market-caption-pair">projected <small>2027</small></span></p>
          </li>
          <li>
            <strong>$5.2T</strong>
            <p>AI compute infrastructure <span className="pitch-market-caption-pair">required <small>through 2030</small></span></p>
          </li>
        </ul>
        <div className="pitch-market-revenue" aria-labelledby="pitch-market-revenue-title">
          <h3 id="pitch-market-revenue-title">how do we make money</h3>
          <div className="pitch-market-revenue-engines">
            <div>
              <h4>Critical Systems</h4>
              <ul>
                <li>Long-term enterprise contracts</li>
                <li>Infrastructure licensing</li>
                <li>Deployment and integration fees</li>
                <li>Managed infrastructure contracts</li>
                <li>Support and maintenance agreements</li>
                <li>Custom engineering / systems integration</li>
                <li>Edge infrastructure deployments</li>
                <li>On-premise licensing</li>
                <li>Hardware-software bundled deployments</li>
                <li>Strategic government / industrial contracts</li>
              </ul>
            </div>
            <div>
              <h4>Developer Infrastructure</h4>
              <ul>
                <li>Annual platform subscriptions</li>
                <li>Usage-based compute / inference fees</li>
                <li>API usage</li>
                <li>Developer platform subscriptions</li>
                <li>Developer usage-based pricing</li>
                <li>Enterprise developer plans</li>
                <li>Data / orchestration tooling</li>
              </ul>
            </div>
          </div>
        </div>
        <p className="pitch-market-source">Sources: Gartner, Worldwide AI Spending Forecast, Sept. 2026; McKinsey, The Cost of Compute, 2025.</p>
      </section>

      <section className="pitch-section pitch-why-now" aria-labelledby="pitch-why-now-title">
        <h2 id="pitch-why-now-title">WHY NOW</h2>
        <p className="pitch-why-now-headline">AI is scaling faster than its infrastructure can consolidate.</p>
        <div className="pitch-why-now-body">
          <ul className="pitch-why-now-drivers">
            <li>Models are multiplying.</li>
            <li>Inference is exploding.</li>
            <li>Compute is fragmenting.</li>
            <li>AI is moving into everywhere.</li>
          </ul>
          <div className="pitch-why-now-stats">
            <div>
              <strong>$1.48T</strong>
              <p>AI infrastructure spend in 2026</p>
            </div>
            <div>
              <strong>35% CAGR</strong>
              <p>AI inference compute demand through 2030</p>
            </div>
            <div>
              <strong>88%</strong>
              <p>organizational AI adoption</p>
            </div>
          </div>
        </div>
        <p className="pitch-why-now-conclusion">The next infrastructure giant will connect the stack.</p>
      </section>

      <section className="pitch-section pitch-competition" aria-labelledby="pitch-competition-title">
        <h2 id="pitch-competition-title">Competitive landscape</h2>
        <table className="pitch-competition-table">
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">What they own</th>
              <th scope="col">Gap Cencori attacks</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map(({ company, logo, logoStyle, owns, gap, source }) => (
              <tr key={company}>
                <th scope="row">
                  <span className="pitch-competition-company">
                    <span className={`pitch-competition-logo pitch-competition-logo-${logoStyle}`}>
                      <Image src={logo} alt="" fill sizes="52px" />
                    </span>
                    <span>{company}</span>
                  </span>
                </th>
                <td>{owns}</td>
                <td>
                  {gap} <a href={source} target="_blank" rel="noopener noreferrer" aria-label={`Source for ${company}`}>Source ↗</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pitch-competition-win">
          <h3>Why We Win.</h3>
          <p className="pitch-competition-win-claim">They own pieces of the stack. Cencori makes the stack one system.</p>
          <p className="pitch-competition-win-example">The same infrastructure that serves a 19-year-old building an AI startup can serve an energy company deploying models inside a power facility (obviously, the requirements become radically different).</p>
          <p className="pitch-competition-win-takeaway">We don&apos;t have to replace the giants.<br />We aim to be part of the giants.</p>
        </div>
      </section>

      <section className="pitch-section pitch-traction" aria-labelledby="pitch-traction-title">
        <h2 id="pitch-traction-title">Traction</h2>
        <p className="pitch-traction-headline">AI is already running on Cencori.</p>

        <ul className="pitch-traction-metrics">
          <li><strong>665</strong><span>Developers</span></li>
          <li><strong>580+</strong><span>Active projects &amp; startups</span></li>
          <li><strong>15,000+</strong><span>SDK downloads every week</span></li>
          <li><strong>504M+</strong><span>Tokens processed</span></li>
          <li><strong>$9K+</strong><span>Contracted revenue</span></li>
        </ul>

        <div className="pitch-traction-close">
          <p className="pitch-traction-beta">All while still in beta.</p>
          <p className="pitch-traction-outlook">This is only the beginning. More of the world’s AI will run on Cencori.</p>
        </div>

        <div className="pitch-traction-recognition" aria-labelledby="pitch-traction-recognition-title">
          <h3 id="pitch-traction-recognition-title">Backed by ecosystem momentum. Recognized by the industry.</h3>
          <ul>
            {recognitionSources.map(({ name, logo, width, height, style, url }) => (
              <li key={name}>
                <a className={`pitch-traction-recognition-logo pitch-traction-recognition-${style}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${name} source`}>
                  <Image src={logo} alt={name} width={width} height={height} />
                  {style === "nvidia" && <span>NVIDIA<br />Inception</span>}
                  {style === "africa-is-building" && <span>Africa Is<br />Building</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="pitch-section pitch-roadmap" aria-labelledby="pitch-roadmap-title">
        <h2 id="pitch-roadmap-title">Roadmap</h2>
        <p className="pitch-roadmap-headline">We earn the right to move down the stack.</p>
        <p className="pitch-roadmap-foundation">Today, Cencori developer infrastructure is live.</p>

        <ol className="pitch-roadmap-eras">
          <li>
            <span>Phase 1 · Where we are</span>
            <h3>AI control plane</h3>
            <p>Intelligent model routing and inference orchestration across providers and endpoints.</p>
          </li>
          <li>
            <span>Phase 2</span>
            <h3>Compute abstraction</h3>
            <p>Deploy inference, agents and AI jobs once. Cencori schedules where they run.</p>
          </li>
          <li>
            <span>Phase 3</span>
            <h3>Infrastructure intelligence</h3>
            <p>Optimize placement, scaling, failover and cost from live workload performance.</p>
          </li>
          <li>
            <span>Phase 4</span>
            <h3>Critical systems</h3>
            <p>Bring the same runtime into private cloud, on-premise and edge environments.</p>
          </li>
          <li>
            <span>Phase 5</span>
            <h3>Infrastructure network</h3>
            <p>Connect GPU clouds, data centers, enterprise clusters and edge nodes into one compute fabric.</p>
          </li>
          <li>
            <span>Phase 6</span>
            <h3>Systems &amp; hardware</h3>
            <p>Purpose-built servers, edge systems and networking informed by workload data.</p>
          </li>
          <li>
            <span>Phase 7 · Long term</span>
            <h3>Silicon</h3>
            <p>Design specialized chips using what the infrastructure network learns about AI workloads.</p>
          </li>
        </ol>
      </section>

      <section className="pitch-section pitch-team" aria-labelledby="pitch-team-title">
        <h2 id="pitch-team-title">Team</h2>
        <div className="pitch-team-people">
          <article className="pitch-team-person">
            <div className="pitch-team-photo pitch-team-photo-bola">
              <Image src="/downloads/bb.jpg" alt="Portrait of Bola Banjo" fill sizes="176px" />
            </div>
            <h3>Bola Banjo</h3>
            <p className="pitch-team-role">Co-Founder &amp; CEO</p>
            <p className="pitch-team-bio">Bola Banjo is an engineer, technologist, and deep-tech founder working across modern computing, AI infrastructure, and advanced systems. He is the Founder &amp; CEO of Cencori, where he is building the computing infrastructure for the next generation of intelligent and mission-critical systems. His interests span compute architecture, distributed systems, semiconductors, cloud infrastructure, robotics, energy, and the future of technology in Africa.</p>
          </article>
          <article className="pitch-team-person">
            <div className="pitch-team-photo pitch-team-photo-daniel">
              <Image src="/daniel-avatar.png" alt="Portrait of Daniel Oreofe" fill sizes="176px" />
            </div>
            <h3>Daniel Oreofe</h3>
            <p className="pitch-team-role">Co-Founder &amp; COO</p>
            <p className="pitch-team-bio">Daniel is a product builder and growth engineer with 5+ years of experience specializing in scaling internet-native consumer platforms and AI applications. With a deep background in designing tech architecture and user experiences, he drives the operational execution, product velocity, and high-impact GTM loops for Cencori. He focuses on bridging the gap between advanced language models and direct, mass-market consumer acquisition.</p>
          </article>
        </div>
        <div className="pitch-team-plan">
          <div className="pitch-team-size">
            <p><strong>9-person</strong> total team size</p>
            <p>Founders + engineering, product and operations</p>
          </div>
          <div className="pitch-team-hires">
            <p>Next hires</p>
            <p>Distributed Systems · AI Infrastructure · Systems Engineering · Hardware · Enterprise</p>
          </div>
          <p className="pitch-team-principle">We’re intentionally building a small, exceptional technical team around the founders.</p>
        </div>
      </section>

      <section className="pitch-section pitch-ask" aria-labelledby="pitch-ask-title">
        <h2 id="pitch-ask-title">The Ask</h2>
        <p className="pitch-ask-headline">Raising a <strong>$3M pre-seed round</strong> to build the infrastructure beneath the next generation of applications and critical systems.</p>
        <p className="pitch-ask-runway">Target runway: <strong>18–24 months</strong></p>

        <div className="pitch-ask-body">
          <div className="pitch-ask-funds">
            <h3 id="pitch-ask-funds-title">Use of funds</h3>
            <table aria-labelledby="pitch-ask-funds-title">
              <tbody>
                <tr>
                  <th scope="row">45%</th>
                  <td><strong>Engineering &amp; Research</strong><span>Core infrastructure team, distributed systems, inference, runtime and orchestration.</span></td>
                  <td>$1.35M</td>
                </tr>
                <tr>
                  <th scope="row">25%</th>
                  <td><strong>Compute &amp; Infrastructure</strong><span>GPU capacity, cloud, testing environments, networking and deployment infrastructure.</span></td>
                  <td>$750K</td>
                </tr>
                <tr>
                  <th scope="row">15%</th>
                  <td><strong>Enterprise &amp; Critical Systems</strong><span>Pilots, integrations, field deployments and strategic customer development.</span></td>
                  <td>$450K</td>
                </tr>
                <tr>
                  <th scope="row">10%</th>
                  <td><strong>Security &amp; Reliability</strong><span>Observability, security, compliance, redundancy and production-grade infrastructure.</span></td>
                  <td>$300K</td>
                </tr>
                <tr>
                  <th scope="row">5%</th>
                  <td><strong>Operations</strong><span>Legal, finance, recruiting and core company operations.</span></td>
                  <td>$150K</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pitch-ask-milestones">
            <h3>Key milestones</h3>
            <ul>
              <li><strong>Productionize the Cencori AI control plane</strong><span>Model routing, observability, reliability, policy controls and workload intelligence.</span></li>
              <li><strong>Launch Cencori Inference</strong><span>Run and orchestrate models across multiple providers and deployment environments.</span></li>
              <li><strong>Launch Cencori Compute beta</strong><span>Deploy AI workloads without managing the underlying cloud or GPU infrastructure.</span></li>
              <li><strong>Multi-environment deployment</strong><span>Cloud, private infrastructure, on-premise and edge.</span></li>
              <li><strong>Win flagship enterprise / critical-system deployments</strong><span>Turn the current contract motion into repeatable infrastructure deployments.</span></li>
              <li><strong>Scale developer adoption</strong><span>Grow from hundreds to thousands of developers and increase workloads running through Cencori.</span></li>
              <li><strong>Build the foundation for the Cencori compute network</strong><span>Multiple compute providers and environments behind one Cencori abstraction.</span></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="pitch-section pitch-closing" aria-labelledby="pitch-closing-title">
        <h2 id="pitch-closing-title">Partner with us</h2> <h1>to build the future of computing and AI Infrastructure.</h1>

        <div className="pitch-closing-contact">
          <div>
            <p>Contact us</p>
            <a href="mailto:daniel@cencori.com">daniel@cencori.com</a>
          </div>
          <div>
            <p>Website</p>
            <a href="https://cencori.com">cencori.com</a>
          </div>
          <p className="pitch-closing-copyright">© 2026 Cencori</p>
        </div>

        <div className="pitch-closing-brand">
          <Image
            src="/logos/b.png"
            alt="Cencori"
            width={5237}
            height={628}
            sizes="100vw"
          />
        </div>
      </section>

    </>
  );
}
