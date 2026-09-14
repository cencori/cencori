import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const SECTORS: Record<string, { title: string; href: string }> = {
  "financial-services": {
    title: "Financial Services",
    href: "/industries/financial-services",
  },
  telecommunications: {
    title: "Telecommunications",
    href: "/industries/telecommunications",
  },
  "healthcare-life-sciences": {
    title: "Healthcare & Life Sciences",
    href: "/industries/healthcare-life-sciences",
  },
  "manufacturing-industrial": {
    title: "Manufacturing & Industrial",
    href: "/industries/manufacturing-industrial",
  },
  "energy-resources": {
    title: "Energy & Resources",
    href: "/industries/energy-resources",
  },
  "government-public-systems": {
    title: "Government & Public Systems",
    href: "/industries/government-public-systems",
  },
  "defence-national-security": {
    title: "Defence & National Security",
    href: "/industries/defence-national-security",
  },
  "agriculture-food-systems": {
    title: "Agriculture & Food Systems",
    href: "/industries/agriculture-food-systems",
  },
  "mobility-autonomous-systems": {
    title: "Mobility & Autonomous Systems",
    href: "/industries/mobility-autonomous-systems",
  },
  technology: { title: "Technology", href: "/industries/technology" },
};

const PAGES: Record<string, Record<string, { title: string; blurb: string }>> = {
  "financial-services": {
    banking: { title: "Banking", blurb: "AI infrastructure for banking." },
    fintech: { title: "Fintech", blurb: "AI infrastructure for fintech." },
    payments: { title: "Payments", blurb: "AI infrastructure for payments." },
    insurance: { title: "Insurance", blurb: "AI infrastructure for insurance." },
    "capital-markets": {
      title: "Capital Markets",
      blurb: "AI infrastructure for capital markets.",
    },
    "asset-management": {
      title: "Asset Management",
      blurb: "AI infrastructure for asset management.",
    },
    credit: { title: "Credit", blurb: "AI infrastructure for credit." },
    fraud: { title: "Fraud", blurb: "AI infrastructure for fraud prevention." },
    risk: { title: "Risk", blurb: "AI infrastructure for risk." },
  },
  telecommunications: {
    "mobile-networks": {
      title: "Mobile Networks",
      blurb: "AI infrastructure for mobile networks.",
    },
    isps: { title: "ISPs", blurb: "AI infrastructure for ISPs." },
    "network-operations": {
      title: "Network Operations",
      blurb: "AI infrastructure for network operations.",
    },
    "radio-networks": {
      title: "Radio Networks",
      blurb: "AI infrastructure for radio networks.",
    },
    "edge-networks": {
      title: "Edge Networks",
      blurb: "AI infrastructure for edge networks.",
    },
    "satellite-communications": {
      title: "Satellite Communications",
      blurb: "AI infrastructure for satellite communications.",
    },
    "network-automation": {
      title: "Network Automation",
      blurb: "AI infrastructure for network automation.",
    },
  },
  "healthcare-life-sciences": {
    hospitals: { title: "Hospitals", blurb: "AI infrastructure for hospitals." },
    diagnostics: {
      title: "Diagnostics",
      blurb: "AI infrastructure for diagnostics.",
    },
    "medical-imaging": {
      title: "Medical Imaging",
      blurb: "AI infrastructure for medical imaging.",
    },
    genomics: { title: "Genomics", blurb: "AI infrastructure for genomics." },
    biotechnology: {
      title: "Biotechnology",
      blurb: "AI infrastructure for biotechnology.",
    },
    pharmaceuticals: {
      title: "Pharmaceuticals",
      blurb: "AI infrastructure for pharmaceuticals.",
    },
    "drug-discovery": {
      title: "Drug Discovery",
      blurb: "AI infrastructure for drug discovery.",
    },
    "medical-devices": {
      title: "Medical Devices",
      blurb: "AI infrastructure for medical devices.",
    },
    "public-health": {
      title: "Public Health",
      blurb: "AI infrastructure for public health.",
    },
  },
  "manufacturing-industrial": {
    factories: { title: "Factories", blurb: "AI infrastructure for factories." },
    "industrial-robotics": {
      title: "Industrial Robotics",
      blurb: "AI infrastructure for industrial robotics.",
    },
    "machine-vision": {
      title: "Machine Vision",
      blurb: "AI infrastructure for machine vision.",
    },
    "quality-control": {
      title: "Quality Control",
      blurb: "AI infrastructure for quality control.",
    },
    "predictive-maintenance": {
      title: "Predictive Maintenance",
      blurb: "AI infrastructure for predictive maintenance.",
    },
    "process-automation": {
      title: "Process Automation",
      blurb: "AI infrastructure for process automation.",
    },
    warehousing: {
      title: "Warehousing",
      blurb: "AI infrastructure for warehousing.",
    },
    "supply-chain": {
      title: "Supply Chain",
      blurb: "AI infrastructure for the supply chain.",
    },
  },
  "energy-resources": {
    "power-grids": {
      title: "Power Grids",
      blurb: "AI infrastructure for power grids.",
    },
    utilities: { title: "Utilities", blurb: "AI infrastructure for utilities." },
    renewables: {
      title: "Renewables",
      blurb: "AI infrastructure for renewables.",
    },
    "oil-gas": { title: "Oil & Gas", blurb: "AI infrastructure for oil & gas." },
    nuclear: { title: "Nuclear", blurb: "AI infrastructure for nuclear." },
    batteries: { title: "Batteries", blurb: "AI infrastructure for batteries." },
    mining: { title: "Mining", blurb: "AI infrastructure for mining." },
    water: { title: "Water", blurb: "AI infrastructure for water systems." },
    "natural-resources": {
      title: "Natural Resources",
      blurb: "AI infrastructure for natural resources.",
    },
  },
  "government-public-systems": {
    ministries: {
      title: "Ministries",
      blurb: "AI infrastructure for ministries.",
    },
    agencies: { title: "Agencies", blurb: "AI infrastructure for agencies." },
    regulators: {
      title: "Regulators",
      blurb: "AI infrastructure for regulators.",
    },
    "public-services": {
      title: "Public Services",
      blurb: "AI infrastructure for public services.",
    },
    identity: { title: "Identity", blurb: "AI infrastructure for identity." },
    customs: { title: "Customs", blurb: "AI infrastructure for customs." },
    tax: { title: "Tax", blurb: "AI infrastructure for tax systems." },
    infrastructure: {
      title: "Infrastructure",
      blurb: "AI infrastructure for public infrastructure.",
    },
    "smart-cities": {
      title: "Smart Cities",
      blurb: "AI infrastructure for smart cities.",
    },
    "emergency-response": {
      title: "Emergency Response",
      blurb: "AI infrastructure for emergency response.",
    },
  },
  "defence-national-security": {
    "secure-computing": {
      title: "Secure Computing",
      blurb: "AI infrastructure for secure computing.",
    },
    "intelligence-systems": {
      title: "Intelligence Systems",
      blurb: "AI infrastructure for intelligence systems.",
    },
    "cyber-defence": {
      title: "Cyber Defence",
      blurb: "AI infrastructure for cyber defence.",
    },
    logistics: { title: "Logistics", blurb: "AI infrastructure for logistics." },
    communications: {
      title: "Communications",
      blurb: "AI infrastructure for secure communications.",
    },
    simulation: {
      title: "Simulation",
      blurb: "AI infrastructure for simulation.",
    },
    "autonomous-systems": {
      title: "Autonomous Systems",
      blurb: "AI infrastructure for autonomous systems.",
    },
    "mission-infrastructure": {
      title: "Mission Infrastructure",
      blurb: "AI infrastructure for missions.",
    },
  },
  "agriculture-food-systems": {
    "precision-agriculture": {
      title: "Precision Agriculture",
      blurb: "AI infrastructure for precision agriculture.",
    },
    "crop-intelligence": {
      title: "Crop Intelligence",
      blurb: "AI infrastructure for crop intelligence.",
    },
    irrigation: {
      title: "Irrigation",
      blurb: "AI infrastructure for irrigation.",
    },
    livestock: { title: "Livestock", blurb: "AI infrastructure for livestock." },
    "agricultural-robotics": {
      title: "Agricultural Robotics",
      blurb: "AI infrastructure for agricultural robotics.",
    },
    "autonomous-equipment": {
      title: "Autonomous Equipment",
      blurb: "AI infrastructure for autonomous equipment.",
    },
    "food-production": {
      title: "Food Production",
      blurb: "AI infrastructure for food production.",
    },
  },
  "mobility-autonomous-systems": {
    automotive: {
      title: "Automotive",
      blurb: "AI infrastructure for automotive.",
    },
    aviation: { title: "Aviation", blurb: "AI infrastructure for aviation." },
    drones: { title: "Drones", blurb: "AI infrastructure for drones." },
    rail: { title: "Rail", blurb: "AI infrastructure for rail." },
    shipping: { title: "Shipping", blurb: "AI infrastructure for shipping." },
    ports: { title: "Ports", blurb: "AI infrastructure for ports." },
    logistics: { title: "Logistics", blurb: "AI infrastructure for logistics." },
    "autonomous-vehicles": {
      title: "Autonomous Vehicles",
      blurb: "AI infrastructure for autonomous vehicles.",
    },
    robotics: { title: "Robotics", blurb: "AI infrastructure for robotics." },
    "fleet-systems": {
      title: "Fleet Systems",
      blurb: "AI infrastructure for fleet systems.",
    },
  },
  technology: {
    "ai-companies": {
      title: "AI Companies",
      blurb: "AI infrastructure for AI companies.",
    },
    software: { title: "Software", blurb: "AI infrastructure for software." },
    "developer-tools": {
      title: "Developer Tools",
      blurb: "AI infrastructure for developer tools.",
    },
    hardware: { title: "Hardware", blurb: "AI infrastructure for hardware." },
    semiconductors: {
      title: "Semiconductors",
      blurb: "AI infrastructure for semiconductors.",
    },
    cybersecurity: {
      title: "Cybersecurity",
      blurb: "AI infrastructure for cybersecurity.",
    },
    commerce: { title: "Commerce", blurb: "AI infrastructure for commerce." },
    media: { title: "Media", blurb: "AI infrastructure for media." },
    "spatial-computing": {
      title: "3D & Spatial Computing",
      blurb: "AI infrastructure for 3D & spatial computing.",
    },
    design: { title: "Design", blurb: "AI infrastructure for design." },
  },
};

export function generateStaticParams() {
  return Object.entries(PAGES).flatMap(([sector, subs]) =>
    Object.keys(subs).map((sub) => ({ sector, sub })),
  );
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sector: string; sub: string }>;
}): Promise<Metadata> {
  const { sector, sub } = await params;
  const page = PAGES[sector]?.[sub];
  if (!page) return {};
  return {
    title: `${page.title} | Cencori Industries`,
    description: page.blurb,
  };
}

export default async function IndustrySubsectorPage({
  params,
}: {
  params: Promise<{ sector: string; sub: string }>;
}) {
  const { sector, sub } = await params;
  const page = PAGES[sector]?.[sub];
  const parent = SECTORS[sector];
  if (!page || !parent) notFound();

  return (
    <CapabilityStub
      eyebrow={parent.title}
      title={page.title}
      blurb={page.blurb}
      backHref={parent.href}
      backLabel={`Back to ${parent.title}`}
    />
  );
}
