import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PROGRAMS: Record<string, { title: string; href: string }> = {
  "ai-systems": { title: "AI Systems", href: "/research/ai-systems" },
  "computing-systems": { title: "Computing Systems", href: "/research/computing-systems" },
  "physical-ai-robotics": { title: "Physical AI & Robotics", href: "/research/physical-ai-robotics" },
  "scientific-computing": { title: "Scientific Computing", href: "/research/scientific-computing" },
  "hardware-systems": { title: "Hardware Systems", href: "/research/hardware-systems" },
  "security-reliability-governance": {
    title: "Security, Reliability & Governance",
    href: "/research/security-reliability-governance",
  },
};

const PAGES: Record<string, Record<string, { title: string; blurb: string }>> = {
  "ai-systems": {
    "model-systems": { title: "Model Systems", blurb: "Research on model systems." },
    inference: { title: "Inference", blurb: "Research on inference systems." },
    training: { title: "Training", blurb: "Research on training systems." },
    "fine-tuning": { title: "Fine-tuning", blurb: "Research on fine-tuning." },
    agents: { title: "Agents", blurb: "Research on agent systems." },
    memory: { title: "Memory", blurb: "Research on memory systems." },
    "multimodal-systems": { title: "Multimodal Systems", blurb: "Research on multimodal systems." },
    "reasoning-systems": { title: "Reasoning Systems", blurb: "Research on reasoning systems." },
  },
  "computing-systems": {
    "distributed-computing": { title: "Distributed Computing", blurb: "Research on distributed computing." },
    "runtime-systems": { title: "Runtime Systems", blurb: "Research on runtime systems." },
    scheduling: { title: "Scheduling", blurb: "Research on scheduling." },
    "workload-placement": { title: "Workload Placement", blurb: "Research on workload placement." },
    "gpu-systems": { title: "GPU Systems", blurb: "Research on GPU systems." },
    storage: { title: "Storage", blurb: "Research on storage systems." },
    networking: { title: "Networking", blurb: "Research on networking." },
    "fault-tolerance": { title: "Fault Tolerance", blurb: "Research on fault tolerance." },
    "performance-engineering": { title: "Performance Engineering", blurb: "Research on performance engineering." },
  },
  "physical-ai-robotics": {
    robotics: { title: "Robotics", blurb: "Research on robotics." },
    "autonomous-systems": { title: "Autonomous Systems", blurb: "Research on autonomous systems." },
    drones: { title: "Drones", blurb: "Research on drones." },
    "embodied-ai": { title: "Embodied AI", blurb: "Research on embodied AI." },
    "edge-ai": { title: "Edge AI", blurb: "Research on edge AI." },
    "fleet-systems": { title: "Fleet Systems", blurb: "Research on fleet systems." },
    "machine-perception": { title: "Machine Perception", blurb: "Research on machine perception." },
    "control-systems": { title: "Control Systems", blurb: "Research on control systems." },
  },
  "scientific-computing": {
    "computational-biology": { title: "Computational Biology", blurb: "Research on computational biology." },
    chemistry: { title: "Chemistry", blurb: "Research on chemistry." },
    physics: { title: "Physics", blurb: "Research on physics." },
    "materials-science": { title: "Materials Science", blurb: "Research on materials science." },
    medicine: { title: "Medicine", blurb: "Research on medicine." },
    climate: { title: "Climate", blurb: "Research on climate." },
    "earth-systems": { title: "Earth Systems", blurb: "Research on earth systems." },
    "engineering-simulation": { title: "Engineering Simulation", blurb: "Research on engineering simulation." },
    "scientific-ai": { title: "Scientific AI", blurb: "Research on scientific AI." },
  },
  "hardware-systems": {
    "computer-architecture": { title: "Computer Architecture", blurb: "Research on computer architecture." },
    accelerators: { title: "Accelerators", blurb: "Research on accelerators." },
    interconnects: { title: "Interconnects", blurb: "Research on interconnects." },
    "memory-systems": { title: "Memory Systems", blurb: "Research on memory systems." },
    "edge-hardware": { title: "Edge Hardware", blurb: "Research on edge hardware." },
    "efficient-computing": { title: "Efficient Computing", blurb: "Research on efficient computing." },
    "hardware-software-co-design": { title: "Hardware-Software Co-design", blurb: "Research on hardware-software co-design." },
    "future-silicon": { title: "Future Silicon", blurb: "Research toward future Cencori silicon." },
  },
  "security-reliability-governance": {
    "ai-security": { title: "AI Security", blurb: "Research on AI security." },
    privacy: { title: "Privacy", blurb: "Research on privacy." },
    "verifiable-audit": { title: "Verifiable Audit", blurb: "Research on verifiable audit." },
    "model-governance": { title: "Model Governance", blurb: "Research on model governance." },
    "infrastructure-security": { title: "Infrastructure Security", blurb: "Research on infrastructure security." },
    reliability: { title: "Reliability", blurb: "Research on reliability." },
    "safe-failure": { title: "Safe Failure", blurb: "Research on safe failure." },
    "critical-system-assurance": { title: "Critical-System Assurance", blurb: "Research on critical-system assurance." },
  },
};

export function generateStaticParams() {
  return Object.entries(PAGES).flatMap(([program, areas]) =>
    Object.keys(areas).map((area) => ({ program, area })),
  );
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ program: string; area: string }>;
}): Promise<Metadata> {
  const { program, area } = await params;
  const page = PAGES[program]?.[area];
  if (!page) return {};
  return {
    title: `${page.title} | Cencori Research`,
    description: page.blurb,
  };
}

export default async function ResearchAreaPage({
  params,
}: {
  params: Promise<{ program: string; area: string }>;
}) {
  const { program, area } = await params;
  const page = PAGES[program]?.[area];
  const parent = PROGRAMS[program];
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
