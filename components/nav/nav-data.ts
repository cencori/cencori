export const navigationMenus = [
  {
    id: "products",
    label: "Products",
    eyebrow: "Products",
    groups: [
      {
        label: "Explore products",
        items: [
          {
            href: "/basecode",
            label: "Basecode",
            tagline: "AI software engineering",
            description:
              "AI-native software engineering environment built on Cencori infrastructure.",
          },
          {
            href: "/arcie",
            label: "Arcie",
            tagline: "Agent framework",
            description:
              "Cencori's first-party framework for building agents and autonomous AI systems.",
          },
        ],
      },
      {
        label: "Infrastructure",
        items: [
          {
            href: "/developers",
            label: "Developers",
            tagline: "Build and run AI",
            description:
              "Everything developers need to build and run AI on Cencori.",
            preview: [
              { label: "APIs", href: "/developers/apis" },
              { label: "AI Gateway", href: "/ai-gateway" },
              { label: "Models", href: "/models" },
              { label: "Inference", href: "/developers/inference" },
              { label: "Memory", href: "/memory" },
              { label: "Agent Deployment", href: "/developers/agent-deployment" },
              { label: "Web Tools", href: "/developers/web-tools" },
              { label: "Multimodal", href: "/developers/multimodal" },
              { label: "Voice", href: "/developers/voice" },
              { label: "Billing", href: "/developers/billing" },
              { label: "Observability", href: "/developers/observability" },
              { label: "Security", href: "/security" },
              { label: "SDKs", href: "/developers/sdks" },
              { label: "CLI", href: "/developers/cli" },
              { label: "MCP", href: "/developers/mcp" },
              { label: "Documentation", href: "/docs" },
            ],
          },
          {
            href: "/models",
            label: "Model Infrastructure",
            tagline: "Train · fine-tune · deploy",
            description: "Build, train and run models on Cencori.",
            preview: [
              { label: "Training", href: "/models/training" },
              { label: "Fine-tuning", href: "/models/fine-tuning" },
              { label: "Evaluation", href: "/models/evaluation" },
              { label: "Model Registry", href: "/models/model-registry" },
              { label: "Hosting", href: "/models/hosting" },
              { label: "Deployment", href: "/models/deployment" },
              { label: "Inference", href: "/models/inference" },
              { label: "Private Models", href: "/models/private-models" },
            ],
          },
          {
            href: "/agents",
            label: "Agentic Infrastructure",
            tagline: "Deploy · operate · observe",
            description: "Build anywhere. Run agents on Cencori.",
            preview: [
              { label: "Agent Runtime", href: "/agents/agent-runtime" },
              { label: "Deployment", href: "/agents/deployment" },
              { label: "Persistent Agents", href: "/agents/persistent-agents" },
              { label: "Scheduled Runs", href: "/agents/scheduled-runs" },
              { label: "API Triggers", href: "/agents/api-triggers" },
              { label: "Webhooks", href: "/agents/webhooks" },
              { label: "Tools", href: "/agents/tools" },
              { label: "State", href: "/agents/state" },
              { label: "Human Approval", href: "/agents/human-approval" },
              { label: "Traces", href: "/agents/traces" },
            ],
            link: { href: "/arcie", label: "Build with Arcie" },
          },
        ],
      },
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    eyebrow: "Infrastructure",
    groups: [
      {
        label: "Built for",
        items: [
          {
            href: "/developers",
            label: "Developers",
            tagline: "Infrastructure for people building AI",
            description: "Infrastructure for people building AI.",
            preview: [
              { label: "Gateway", href: "/ai-gateway" },
              { label: "Models", href: "/models" },
              { label: "Memory", href: "/memory" },
              { label: "Agents", href: "/agents" },
              { label: "APIs", href: "/developers/apis" },
              { label: "SDKs", href: "/developers/sdks" },
              { label: "Compute", href: "/compute" },
              { label: "Deployment", href: "/infrastructure/deployment" },
              { label: "Billing", href: "/developers/billing" },
              { label: "Security", href: "/security" },
              { label: "Observability", href: "/developers/observability" },
            ],
          },
          {
            href: "/enterprise",
            label: "Enterprises",
            tagline: "Infrastructure for organizations at production scale",
            description:
              "Infrastructure for organizations operating AI at production scale. Same primitives. Stronger operating guarantees.",
            preview: [
              { label: "Private AI", href: "/infrastructure/private-ai" },
              { label: "Identity", href: "/infrastructure/identity" },
              { label: "Governance", href: "/infrastructure/governance" },
              { label: "Security", href: "/security" },
              { label: "Model Infrastructure", href: "/models" },
              { label: "Agent Infrastructure", href: "/agents" },
              { label: "Observability", href: "/developers/observability" },
              { label: "Cost Control", href: "/infrastructure/cost-control" },
              {
                label: "Private Deployment",
                href: "/infrastructure/private-deployment",
              },
              { label: "VPC", href: "/infrastructure/vpc" },
              { label: "Audit", href: "/infrastructure/audit" },
            ],
          },
          {
            href: "/governments",
            label: "Governments",
            tagline: "Government & sovereign infrastructure",
            description:
              "Infrastructure for governments, public institutions and nationally controlled AI systems.",
            preview: [
              { label: "Sovereign AI", href: "/governments/sovereign-ai" },
              { label: "Data Residency", href: "/governments/data-residency" },
              { label: "Private Models", href: "/governments/private-models" },
              {
                label: "Regional Compute",
                href: "/governments/regional-compute",
              },
              {
                label: "Institutional Governance",
                href: "/governments/institutional-governance",
              },
              { label: "Auditability", href: "/governments/auditability" },
              {
                label: "Controlled Networking",
                href: "/governments/controlled-networking",
              },
              { label: "On-premise", href: "/governments/on-premise" },
            ],
          },
          {
            href: "/universities",
            label: "Research & Universities",
            tagline: "Infrastructure researchers consume",
            description:
              "Computing infrastructure for research, experimentation and education.",
            preview: [
              { label: "Model Training", href: "/universities/model-training" },
              {
                label: "Scientific Compute",
                href: "/universities/scientific-compute",
              },
              { label: "Datasets", href: "/universities/datasets" },
              { label: "Experiments", href: "/universities/experiments" },
              { label: "Checkpoints", href: "/universities/checkpoints" },
              { label: "Evaluation", href: "/universities/evaluation" },
              { label: "Simulation", href: "/universities/simulation" },
              {
                label: "Research Agents",
                href: "/universities/research-agents",
              },
            ],
          },
          {
            href: "/critical-systems",
            label: "Critical Systems",
            tagline: "Where reliability, control and failure matter",
            description:
              "AI infrastructure for environments where reliability, control and failure matter.",
            preview: [
              {
                label: "Financial Infrastructure",
                href: "/critical-systems/financial-infrastructure",
              },
              {
                label: "Telecommunications",
                href: "/critical-systems/telecommunications",
              },
              { label: "Healthcare", href: "/critical-systems/healthcare" },
              {
                label: "Industrial Systems",
                href: "/critical-systems/industrial-systems",
              },
              { label: "Energy", href: "/critical-systems/energy" },
              {
                label: "Public Infrastructure",
                href: "/critical-systems/public-infrastructure",
              },
              { label: "Defence", href: "/critical-systems/defence" },
              {
                label: "Autonomous Systems",
                href: "/critical-systems/autonomous-systems",
              },
            ],
          },
          {
            href: "/edge-ai",
            label: "Edge & Physical AI",
            tagline: "Run AI inside machines and devices",
            description:
              "Run AI inside machines, devices and physical environments.",
            preview: [
              { label: "Robotics", href: "/edge-ai/robotics" },
              { label: "Drones", href: "/edge-ai/drones" },
              { label: "Vehicles", href: "/edge-ai/vehicles" },
              { label: "Sensors", href: "/edge-ai/sensors" },
              {
                label: "Industrial Equipment",
                href: "/edge-ai/industrial-equipment",
              },
              { label: "Edge Devices", href: "/edge-ai/edge-devices" },
              {
                label: "Fleet Deployment",
                href: "/edge-ai/fleet-deployment",
              },
              {
                label: "Local Inference",
                href: "/edge-ai/local-inference",
              },
            ],
          },
        ],
      },
    ],
    staticGroups: [
      {
        label: "Deployment",
        items: [
          { label: "Cencori Cloud", href: "/infrastructure/cloud" },
          { label: "Private Cloud / VPC", href: "/infrastructure/vpc" },
          {
            label: "Sovereign Infrastructure",
            href: "/infrastructure/sovereign",
          },
          { label: "On-premise", href: "/infrastructure/on-premise" },
          { label: "Edge", href: "/infrastructure/edge" },
        ],
      },
    ],
  },
  {
    id: "industries",
    label: "Industries",
    eyebrow: "Industries",
    groups: [
      {
        label: "Sectors",
        items: [
          {
            href: "/industries/financial-services",
            label: "Financial Services",
            tagline: "Banking to capital markets",
            description:
              "AI infrastructure for financial systems where security, latency, governance and reliability matter.",
            preview: [
              { label: "Banking", href: "/industries/financial-services/banking" },
              { label: "Fintech", href: "/industries/financial-services/fintech" },
              { label: "Payments", href: "/industries/financial-services/payments" },
              { label: "Insurance", href: "/industries/financial-services/insurance" },
              {
                label: "Capital Markets",
                href: "/industries/financial-services/capital-markets",
              },
              {
                label: "Asset Management",
                href: "/industries/financial-services/asset-management",
              },
              { label: "Credit", href: "/industries/financial-services/credit" },
              { label: "Fraud", href: "/industries/financial-services/fraud" },
              { label: "Risk", href: "/industries/financial-services/risk" },
            ],
          },
          {
            href: "/industries/telecommunications",
            label: "Telecommunications",
            tagline: "Networks that cannot go down",
            description:
              "AI infrastructure for telecommunications networks where uptime and scale are non-negotiable.",
            preview: [
              {
                label: "Mobile Networks",
                href: "/industries/telecommunications/mobile-networks",
              },
              { label: "ISPs", href: "/industries/telecommunications/isps" },
              {
                label: "Network Operations",
                href: "/industries/telecommunications/network-operations",
              },
              {
                label: "Radio Networks",
                href: "/industries/telecommunications/radio-networks",
              },
              {
                label: "Edge Networks",
                href: "/industries/telecommunications/edge-networks",
              },
              {
                label: "Satellite Communications",
                href: "/industries/telecommunications/satellite-communications",
              },
              {
                label: "Network Automation",
                href: "/industries/telecommunications/network-automation",
              },
            ],
          },
          {
            href: "/industries/healthcare-life-sciences",
            label: "Healthcare & Life Sciences",
            tagline: "Care, discovery, and life sciences",
            description:
              "AI infrastructure for healthcare and life sciences where accuracy, privacy, and trust matter.",
            preview: [
              {
                label: "Hospitals",
                href: "/industries/healthcare-life-sciences/hospitals",
              },
              {
                label: "Diagnostics",
                href: "/industries/healthcare-life-sciences/diagnostics",
              },
              {
                label: "Medical Imaging",
                href: "/industries/healthcare-life-sciences/medical-imaging",
              },
              {
                label: "Genomics",
                href: "/industries/healthcare-life-sciences/genomics",
              },
              {
                label: "Biotechnology",
                href: "/industries/healthcare-life-sciences/biotechnology",
              },
              {
                label: "Pharmaceuticals",
                href: "/industries/healthcare-life-sciences/pharmaceuticals",
              },
              {
                label: "Drug Discovery",
                href: "/industries/healthcare-life-sciences/drug-discovery",
              },
              {
                label: "Medical Devices",
                href: "/industries/healthcare-life-sciences/medical-devices",
              },
              {
                label: "Public Health",
                href: "/industries/healthcare-life-sciences/public-health",
              },
            ],
          },
          {
            href: "/industries/manufacturing-industrial",
            label: "Manufacturing & Industrial",
            tagline: "Factories and industrial systems",
            description:
              "AI infrastructure for manufacturing and industrial systems where precision and uptime matter.",
            preview: [
              {
                label: "Factories",
                href: "/industries/manufacturing-industrial/factories",
              },
              {
                label: "Industrial Robotics",
                href: "/industries/manufacturing-industrial/industrial-robotics",
              },
              {
                label: "Machine Vision",
                href: "/industries/manufacturing-industrial/machine-vision",
              },
              {
                label: "Quality Control",
                href: "/industries/manufacturing-industrial/quality-control",
              },
              {
                label: "Predictive Maintenance",
                href: "/industries/manufacturing-industrial/predictive-maintenance",
              },
              {
                label: "Process Automation",
                href: "/industries/manufacturing-industrial/process-automation",
              },
              {
                label: "Warehousing",
                href: "/industries/manufacturing-industrial/warehousing",
              },
              {
                label: "Supply Chain",
                href: "/industries/manufacturing-industrial/supply-chain",
              },
            ],
          },
          {
            href: "/industries/energy-resources",
            label: "Energy & Resources",
            tagline: "Power, grids, and natural resources",
            description:
              "AI infrastructure for energy and resources where reliability and control matter.",
            preview: [
              {
                label: "Power Grids",
                href: "/industries/energy-resources/power-grids",
              },
              { label: "Utilities", href: "/industries/energy-resources/utilities" },
              {
                label: "Renewables",
                href: "/industries/energy-resources/renewables",
              },
              { label: "Oil & Gas", href: "/industries/energy-resources/oil-gas" },
              { label: "Nuclear", href: "/industries/energy-resources/nuclear" },
              { label: "Batteries", href: "/industries/energy-resources/batteries" },
              { label: "Mining", href: "/industries/energy-resources/mining" },
              { label: "Water", href: "/industries/energy-resources/water" },
              {
                label: "Natural Resources",
                href: "/industries/energy-resources/natural-resources",
              },
            ],
          },
          {
            href: "/industries/government-public-systems",
            label: "Government & Public Systems",
            tagline: "Public institutions and national systems",
            description:
              "AI infrastructure for governments and public systems where accountability and continuity matter.",
            preview: [
              {
                label: "Ministries",
                href: "/industries/government-public-systems/ministries",
              },
              {
                label: "Agencies",
                href: "/industries/government-public-systems/agencies",
              },
              {
                label: "Regulators",
                href: "/industries/government-public-systems/regulators",
              },
              {
                label: "Public Services",
                href: "/industries/government-public-systems/public-services",
              },
              {
                label: "Identity",
                href: "/industries/government-public-systems/identity",
              },
              {
                label: "Customs",
                href: "/industries/government-public-systems/customs",
              },
              { label: "Tax", href: "/industries/government-public-systems/tax" },
              {
                label: "Infrastructure",
                href: "/industries/government-public-systems/infrastructure",
              },
              {
                label: "Smart Cities",
                href: "/industries/government-public-systems/smart-cities",
              },
              {
                label: "Emergency Response",
                href: "/industries/government-public-systems/emergency-response",
              },
            ],
          },
          {
            href: "/industries/defence-national-security",
            label: "Defence & National Security",
            tagline: "National security and mission systems",
            description:
              "AI infrastructure for defence and national security where control and assurance matter.",
            preview: [
              {
                label: "Secure Computing",
                href: "/industries/defence-national-security/secure-computing",
              },
              {
                label: "Intelligence Systems",
                href: "/industries/defence-national-security/intelligence-systems",
              },
              {
                label: "Cyber Defence",
                href: "/industries/defence-national-security/cyber-defence",
              },
              {
                label: "Logistics",
                href: "/industries/defence-national-security/logistics",
              },
              {
                label: "Communications",
                href: "/industries/defence-national-security/communications",
              },
              {
                label: "Simulation",
                href: "/industries/defence-national-security/simulation",
              },
              {
                label: "Autonomous Systems",
                href: "/industries/defence-national-security/autonomous-systems",
              },
              {
                label: "Mission Infrastructure",
                href: "/industries/defence-national-security/mission-infrastructure",
              },
            ],
          },
          {
            href: "/industries/agriculture-food-systems",
            label: "Agriculture & Food Systems",
            tagline: "From soil to supply chain",
            description:
              "AI infrastructure for agriculture and food systems from soil to supply chain.",
            preview: [
              {
                label: "Precision Agriculture",
                href: "/industries/agriculture-food-systems/precision-agriculture",
              },
              {
                label: "Crop Intelligence",
                href: "/industries/agriculture-food-systems/crop-intelligence",
              },
              {
                label: "Irrigation",
                href: "/industries/agriculture-food-systems/irrigation",
              },
              {
                label: "Livestock",
                href: "/industries/agriculture-food-systems/livestock",
              },
              {
                label: "Agricultural Robotics",
                href: "/industries/agriculture-food-systems/agricultural-robotics",
              },
              {
                label: "Autonomous Equipment",
                href: "/industries/agriculture-food-systems/autonomous-equipment",
              },
              {
                label: "Food Production",
                href: "/industries/agriculture-food-systems/food-production",
              },
            ],
          },
          {
            href: "/industries/mobility-autonomous-systems",
            label: "Mobility & Autonomous Systems",
            tagline: "Vehicles, fleets, and autonomous machines",
            description:
              "AI infrastructure for mobility and autonomous systems where safety and reliability matter.",
            preview: [
              {
                label: "Automotive",
                href: "/industries/mobility-autonomous-systems/automotive",
              },
              {
                label: "Aviation",
                href: "/industries/mobility-autonomous-systems/aviation",
              },
              {
                label: "Drones",
                href: "/industries/mobility-autonomous-systems/drones",
              },
              { label: "Rail", href: "/industries/mobility-autonomous-systems/rail" },
              {
                label: "Shipping",
                href: "/industries/mobility-autonomous-systems/shipping",
              },
              { label: "Ports", href: "/industries/mobility-autonomous-systems/ports" },
              {
                label: "Logistics",
                href: "/industries/mobility-autonomous-systems/logistics",
              },
              {
                label: "Autonomous Vehicles",
                href: "/industries/mobility-autonomous-systems/autonomous-vehicles",
              },
              {
                label: "Robotics",
                href: "/industries/mobility-autonomous-systems/robotics",
              },
              {
                label: "Fleet Systems",
                href: "/industries/mobility-autonomous-systems/fleet-systems",
              },
            ],
          },
          {
            href: "/industries/technology",
            label: "Technology",
            tagline: "For companies building the intelligence era",
            description:
              "AI infrastructure for technology companies building the intelligence era.",
            preview: [
              {
                label: "AI Companies",
                href: "/industries/technology/ai-companies",
              },
              { label: "Software", href: "/industries/technology/software" },
              {
                label: "Developer Tools",
                href: "/industries/technology/developer-tools",
              },
              { label: "Hardware", href: "/industries/technology/hardware" },
              {
                label: "Semiconductors",
                href: "/industries/technology/semiconductors",
              },
              {
                label: "Cybersecurity",
                href: "/industries/technology/cybersecurity",
              },
              { label: "Commerce", href: "/industries/technology/commerce" },
              { label: "Media", href: "/industries/technology/media" },
              {
                label: "3D & Spatial Computing",
                href: "/industries/technology/spatial-computing",
              },
              { label: "Design", href: "/industries/technology/design" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "research",
    label: "Research",
    eyebrow: "Cencori Research",
    groups: [
      {
        label: "Research programs",
        items: [
          {
            href: "/research/ai-systems",
            label: "AI",
            tagline: "Systems around AI itself",
            description:
              "Research on the systems around AI itself — how models are trained, run, remembered and reasoned with.",
            preview: [
              { label: "Model Systems", href: "/research/ai-systems/model-systems" },
              { label: "Inference", href: "/research/ai-systems/inference" },
              { label: "Training", href: "/research/ai-systems/training" },
              { label: "Fine-tuning", href: "/research/ai-systems/fine-tuning" },
              { label: "Agents", href: "/research/ai-systems/agents" },
              { label: "Memory", href: "/research/ai-systems/memory" },
              { label: "Multimodal Systems", href: "/research/ai-systems/multimodal-systems" },
              { label: "Reasoning Systems", href: "/research/ai-systems/reasoning-systems" },
            ],
          },
          {
            href: "/research/computing-systems",
            label: "Computing Systems",
            tagline: "Hardcore infrastructure research",
            description:
              "Hardcore infrastructure research — distributed computing, runtimes, scheduling and performance at scale.",
            preview: [
              { label: "Distributed Computing", href: "/research/computing-systems/distributed-computing" },
              { label: "Runtime Systems", href: "/research/computing-systems/runtime-systems" },
              { label: "Scheduling", href: "/research/computing-systems/scheduling" },
              { label: "Workload Placement", href: "/research/computing-systems/workload-placement" },
              { label: "GPU Systems", href: "/research/computing-systems/gpu-systems" },
              { label: "Storage", href: "/research/computing-systems/storage" },
              { label: "Networking", href: "/research/computing-systems/networking" },
              { label: "Fault Tolerance", href: "/research/computing-systems/fault-tolerance" },
              { label: "Performance Engineering", href: "/research/computing-systems/performance-engineering" },
            ],
          },
          {
            href: "/research/physical-ai-robotics",
            label: "Physical AI & Robotics",
            tagline: "Intelligence in the physical world",
            description:
              "Research on intelligence in the physical world — robotics, autonomous machines and edge embodied systems.",
            preview: [
              { label: "Robotics", href: "/research/physical-ai-robotics/robotics" },
              { label: "Autonomous Systems", href: "/research/physical-ai-robotics/autonomous-systems" },
              { label: "Drones", href: "/research/physical-ai-robotics/drones" },
              { label: "Embodied AI", href: "/research/physical-ai-robotics/embodied-ai" },
              { label: "Edge AI", href: "/research/physical-ai-robotics/edge-ai" },
              { label: "Fleet Systems", href: "/research/physical-ai-robotics/fleet-systems" },
              { label: "Machine Perception", href: "/research/physical-ai-robotics/machine-perception" },
              { label: "Control Systems", href: "/research/physical-ai-robotics/control-systems" },
            ],
          },
          {
            href: "/research/scientific-computing",
            label: "Scientific Computing",
            tagline: "Credibility beyond startup AI",
            description:
              "Scientific computing that gives Cencori credibility beyond startup AI — from biology to climate to simulation.",
            preview: [
              { label: "Computational Biology", href: "/research/scientific-computing/computational-biology" },
              { label: "Chemistry", href: "/research/scientific-computing/chemistry" },
              { label: "Physics", href: "/research/scientific-computing/physics" },
              { label: "Materials Science", href: "/research/scientific-computing/materials-science" },
              { label: "Medicine", href: "/research/scientific-computing/medicine" },
              { label: "Climate", href: "/research/scientific-computing/climate" },
              { label: "Earth Systems", href: "/research/scientific-computing/earth-systems" },
              { label: "Engineering Simulation", href: "/research/scientific-computing/engineering-simulation" },
              { label: "Scientific AI", href: "/research/scientific-computing/scientific-ai" },
            ],
          },
          {
            href: "/research/hardware-systems",
            label: "Hardware Systems",
            tagline: "Research, not products yet",
            description:
              "Hardware systems research — architecture, accelerators and co-design. Research toward future Cencori silicon, not products today.",
            preview: [
              { label: "Computer Architecture", href: "/research/hardware-systems/computer-architecture" },
              { label: "Accelerators", href: "/research/hardware-systems/accelerators" },
              { label: "Interconnects", href: "/research/hardware-systems/interconnects" },
              { label: "Memory Systems", href: "/research/hardware-systems/memory-systems" },
              { label: "Edge Hardware", href: "/research/hardware-systems/edge-hardware" },
              { label: "Efficient Computing", href: "/research/hardware-systems/efficient-computing" },
              { label: "Hardware-Software Co-design", href: "/research/hardware-systems/hardware-software-co-design" },
              { label: "Future Silicon", href: "/research/hardware-systems/future-silicon" },
            ],
          },
          {
            href: "/research/security-reliability-governance",
            label: "Security, Reliability & Governance",
            tagline: "Safe failure for critical systems",
            description:
              "Research on AI security, privacy, verifiable audit and safe failure for critical-system assurance.",
            preview: [
              { label: "AI Security", href: "/research/security-reliability-governance/ai-security" },
              { label: "Privacy", href: "/research/security-reliability-governance/privacy" },
              { label: "Verifiable Audit", href: "/research/security-reliability-governance/verifiable-audit" },
              { label: "Model Governance", href: "/research/security-reliability-governance/model-governance" },
              { label: "Infrastructure Security", href: "/research/security-reliability-governance/infrastructure-security" },
              { label: "Reliability", href: "/research/security-reliability-governance/reliability" },
              { label: "Safe Failure", href: "/research/security-reliability-governance/safe-failure" },
              { label: "Critical-System Assurance", href: "/research/security-reliability-governance/critical-system-assurance" },
            ],
          },
        ],
      },
    ],
    staticGroups: [
      {
        label: "Index",
        items: [
          { label: "Publications", href: "/research/publications" },
          { label: "Open Research", href: "/research/open-research" },
          { label: "Partnerships", href: "/research/partnerships" },
          { label: "Notes", href: "/newsroom/research" },
          { label: "Cencori Labs", href: "/research/labs" },
        ],
      },
    ],
  },
  {
    id: "company",
    label: "Company",
    eyebrow: "Company",
    primary: [
      { href: "/about", label: "About Us" },
      { href: "/thesis", label: "Thesis" },
      { href: "/stories", label: "Stories" },
      { href: "/careers", label: "Careers" },
      { href: "/newsroom", label: "Newsroom" },
      { href: "/contact", label: "Contact" },
    ],
    secondaryLabel: "From the company",
    secondary: [
      { href: "/partners", label: "Partners Network" },
      { href: "/customers", label: "Customers" },
      { href: "/press", label: "Press" },
      { href: "/brand", label: "Brand" },
    ],
  },
] as const;

export type NavigationMenuId = (typeof navigationMenus)[number]["id"];

export const developerNavigationMenus = [
  {
    id: "dev-home",
    label: "Home",
    href: "/",
  },
  {
    id: "dev-products",
    label: "Products",
    eyebrow: "Products",
    groups: [
      {
        label: "Models & inference",
        items: [
          {
            href: "/ai-gateway",
            label: "AI Gateway",
            tagline: "One API for every model",
            description:
              "100+ frontier models, one API.",
          },
          {
            href: "/models",
            label: "Models",
            tagline: "Train · fine-tune · deploy",
            description:
              "Build, train and run models on Cencori infrastructure.",
          },
          {
            href: "/developers/inference",
            label: "Inference",
            tagline: "Fast, scalable serving",
            description:
              "Production inference with autoscaling and regional pinning.",
          },
          {
            href: "/models/fine-tuning",
            label: "Fine-tuning",
            tagline: "Adapt models to your data",
            description:
              "Fine-tune open models on your data and deploy them instantly.",
          },
        ],
      },
      {
        label: "Agents & memory",
        items: [
          {
            href: "/agents",
            label: "Agents",
            tagline: "Deploy · operate · observe",
            description: "Build anywhere. Run agents on Cencori.",
          },
          {
            href: "/developers/agent-deployment",
            label: "Agent Deployment",
            tagline: "Ship agents to production",
            description:
              "Deploy persistent agents with scheduling, triggers and approvals.",
          },
          {
            href: "/memory",
            label: "Memory",
            tagline: "Stateful AI",
            description:
              "Give your agents long-term memory across sessions and runs.",
          },
          {
            href: "/developers/observability",
            label: "Observability",
            tagline: "Traces, evals & costs",
            description:
              "Trace every call, evaluate quality and control spend in one place.",
          },
        ],
      },
    ],
  },
  {
    id: "dev-solutions",
    label: "Solutions",
    eyebrow: "Solutions",
    groups: [
      {
        label: "By what you're building",
        items: [
          {
            href: "/agents",
            label: "AI Agents",
            tagline: "Autonomous systems",
            description:
              "Deploy agents that act, remember and ask for approval.",
          },
          {
            href: "/developers/apis",
            label: "Chat Apps",
            tagline: "Assistants & copilots",
            description:
              "Build chat experiences on any frontier model with one API.",
          },
          {
            href: "/developers/voice",
            label: "Voice Apps",
            tagline: "Call centers & companions",
            description:
              "Realtime voice pipelines for support, sales and beyond.",
          },
          {
            href: "/developers/multimodal",
            label: "Multimodal Apps",
            tagline: "Vision & audio",
            description:
              "Apps that see, hear and reason over rich media.",
          },
          {
            href: "/models/fine-tuning",
            label: "Custom Models",
            tagline: "Your data, your model",
            description:
              "Fine-tune and host models tailored to your domain.",
          },
          {
            href: "/solutions/enterprise",
            label: "Enterprise",
            tagline: "Scale with confidence",
            description:
              "SSO, VPC, audit trails and SLAs for regulated teams.",
          },
        ],
      },
    ],
  },
  {
    id: "dev-pricing",
    label: "Pricing",
    href: "/pricing",
  },
  {
    id: "dev-docs",
    label: "Documentations",
    href: "/docs",
  },
  {
    id: "dev-blog",
    label: "Blog",
    href: "/developers/blog",
  },
] as const;

export type DeveloperNavigationMenuId =
  (typeof developerNavigationMenus)[number]["id"];

export type DeveloperNavigationMenu =
  (typeof developerNavigationMenus)[number];

export type DeveloperDropdownMenu = Extract<
  DeveloperNavigationMenu,
  { readonly eyebrow: string }
>;
