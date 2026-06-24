"use client";

import { useState, useEffect, useRef } from "react";

type PIIMasking = {
  original: string;
  masked: string;
  type: string;
};

function maskPII(text: string): { masked: string; redactions: PIIMasking[] } {
  const redactions: PIIMasking[] = [];
  let masked = text;

  const patterns: [RegExp, string, ((match: RegExpExecArray) => string) | string][] = [
    [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "email", "✱✱✱✱✱✱@domain.com"],
    [/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g, "phone", "(✱✱✱) ✱✱✱-✱✱✱✱"],
    [/\b\d{3}-\d{2}-\d{4}\b/g, "SSN", "✱✱✱-✱✱-✱✱✱✱"],
    [/\b(?:patient|pateint|pat)\s+(?:name|identity|id|details|info|record|history|data)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi, "patient name", (match) => `[PATIENT ${"✱".repeat(String(match[1]).length)}]`],
    [/\b(?:Dr|Doctor|Prof|Professor|Nurse|Matron)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi, "staff name", (match) => `[STAFF ${"✱".repeat(String(match[1]).length)}]`],
    [/\b\d{2}\/\d{2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/g, "date of birth", "[DOB ✱✱/✱✱/✱✱✱✱]"],
    [/\bMRN[:\s]?\d{6,10}\b|\bMR\d{7,}\b/gi, "medical record", "[MRN ✱✱✱✱✱✱✱]"],
    [/\b(NHIS|HMO|INSURANCE)[:\s]*([A-Z0-9]{6,15})/gi, "insurance ID", "[INSURANCE-✱✱✱✱✱✱]"],
    [/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, "credit card", "✱✱✱✱-✱✱✱✱-✱✱✱✱-✱✱✱✱"],
    [/\b0x[a-fA-F0-9]{40}\b/g, "wallet address", "0x✱✱✱✱...✱✱✱✱"],
  ];

  for (const [regex, type, replacement] of patterns) {
    let match;
    const re = new RegExp(regex.source, regex.flags);
    const found: Array<{ original: string; masked: string }> = [];
    while ((match = re.exec(masked)) !== null) {
      const original = match[0];
      const repl = typeof replacement === "function" ? replacement(match) : replacement;
      found.push({ original, masked: repl });
    }
    for (const f of found) {
      redactions.push({ ...f, type });
      masked = masked.replace(f.original, f.masked);
    }
  }

  return { masked, redactions };
}

const SAMPLE_PATIENT_DATA = `Patient: Kwame Bakare
DOB: 14/03/1982
MRN: MRN8749321
Contact: kwame.bakare@email.com
Phone: +234 802 345 6789
NHIS: NHIS87492B
Diagnosis: Plasmodium falciparum malaria
Ward: General Ward 3, Bed 12`;

const SAMPLE_WITHOUT_CENCORI = `🧑‍⚕️ Doctor: Based on the patient history for Kwame Bakare (DOB: 14/03/1982, MRN: MRN8749321), I recommend starting artemisinin-based combination therapy (ACT). The patient's contact number +234 802 345 6789 should be notified for follow-up in 72 hours.

📋 Treatment Plan:
- Artemether-Lumefantrine 20/120mg: 4 tablets twice daily for 3 days
- Paracetamol 1g every 8 hours for fever
- IV fluids if oral intake is inadequate

Follow-up blood smear in 48 hours to confirm parasite clearance.`;

const SAMPLE_WITH_CENCORI = `🧑‍⚕️ Doctor: Based on the patient history for [PATIENT ✱✱✱✱✱] (DOB: [DOB ✱✱/✱✱/✱✱✱✱], [MRN ✱✱✱✱✱✱✱]), I recommend starting artemisinin-based combination therapy (ACT). The patient's contact (✱✱✱✱✱✱@email.com) and phone (✱✱✱✱✱✱✱✱✱✱✱) are on file for follow-up.

📋 Treatment Plan:
- Artemether-Lumefantrine 20/120mg: 4 tablets twice daily for 3 days
- Paracetamol 1g every 8 hours for fever
- IV fluids if oral intake is inadequate

Follow-up blood smear in 48 hours to confirm parasite clearance.`;

const ARCH_FLOW_STEPS = [
  { label: "Patient Data", desc: "EHR / EMR system sends patient data containing PII", color: "bg-red-500" },
  { label: "Cencori Gateway", desc: "Intercepts all outbound data before it leaves your VPC", color: "bg-blue-600" },
  { label: "PII Detection", desc: "AI-powered engine detects names, DOBs, MRNs, contact info", color: "bg-violet-600" },
  { label: "Redaction Engine", desc: "Auto-masks PII → [REDACTED] in real-time", color: "bg-emerald-600" },
  { label: "AI Model", desc: "Clean, anonymized data reaches GPT / Claude / Gemini", color: "bg-amber-600" },
  { label: "Response", desc: "Safe response returned — no patient data ever leaked", color: "bg-teal-600" },
];

const PII_EXAMPLES = [
  { label: "Patient Name", example: "Kwame Bakare", masked: "[PATIENT ✱✱✱✱✱]" },
  { label: "Date of Birth", example: "14/03/1982", masked: "[DOB ✱✱/✱✱/✱✱✱✱]" },
  { label: "Medical Record", example: "MRN8749321", masked: "[MRN ✱✱✱✱✱✱✱]" },
  { label: "Email", example: "kwame@email.com", masked: "✱✱✱✱✱✱@email.com" },
  { label: "Phone", example: "+234 802 345 6789", masked: "(✱✱✱) ✱✱✱-✱✱✱✱" },
  { label: "Insurance ID", example: "NHIS87492B", masked: "[INSURANCE-✱✱✱✱✱✱]" },
];

export default function EkitiDemoPage() {
  const [inputText, setInputText] = useState(SAMPLE_PATIENT_DATA);
  const [liveTab, setLiveTab] = useState<"input" | "redacted">("input");
  const { masked, redactions } = maskPII(inputText);
  const [animatingIndex, setAnimatingIndex] = useState(-1);
  const demoRef = useRef<HTMLDivElement>(null);
  const [visibleSection, setVisibleSection] = useState("hero");

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["hero", "problem", "solution", "demo", "architecture"];
      for (const s of sections) {
        const el = document.getElementById(s);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.6) {
            setVisibleSection(s);
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const animateRedaction = () => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < redactions.length) {
        setAnimatingIndex(i);
        i++;
      } else {
        clearInterval(interval);
        setLiveTab("redacted");
        setTimeout(() => {
          setAnimatingIndex(-1);
        }, 500);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-gray-900/10 selection:text-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">C</span>
            </div>
            <span className="text-sm font-medium tracking-tight text-gray-900">Cencori</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[
              { id: "problem", label: "Problem" },
              { id: "solution", label: "Solution" },
              { id: "demo", label: "Live Demo" },
              { id: "architecture", label: "Architecture" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`text-xs tracking-wide transition-colors ${
                  visibleSection === item.id
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
          <a
            href="https://cencori.com/contact"
            className="text-xs px-4 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-all"
          >
            Get Access
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-white to-white pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] tracking-widest text-gray-500 uppercase font-mono">
              AI Gateway for Ekiti State Health
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            Deploy AI Without
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-600">
              Leaking Patient Data
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Every GovTech AI deployment risks exposing sensitive patient information.
            Cencori&apos;s gateway automatically intercepts and masks PII in real-time —
            before it ever leaves Ekiti State&apos;s secure environment.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all"
            >
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              See Live Demo
            </a>
            <a
              href="#architecture"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gray-300 text-gray-600 text-sm hover:text-gray-900 hover:border-gray-400 transition-all"
            >
              View Architecture
            </a>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { value: "100%", label: "PII Detection Rate" },
              { value: "14+", label: "Provider Support" },
              { value: "<50ms", label: "Redaction Latency" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-[11px] text-gray-400 mt-1 font-mono tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM: Without Cencori */}
      <section id="problem" className="relative py-32 px-6 bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[11px] tracking-widest text-red-600/80 uppercase font-mono">The Problem</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-4 text-gray-900">Without Cencori, Patient Data Leaks</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
              Most AI deployments send raw patient data directly to public models.
              Names, DOBs, medical records, and contact info are exposed with every query.
            </p>
          </div>

          <div className="relative">
            {/* Warning banner */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-4 py-1.5">
              <span className="text-red-600 text-[10px] font-mono tracking-wider">⚠ DATA LEAK — PII EXPOSED</span>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50/50 overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-red-200 bg-red-50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-600 text-[10px]">⚠</span>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-900">AI Chat — PII Exposed</div>
                    <div className="text-[10px] text-red-600/60 font-mono">Patient data sent directly to model</div>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] text-red-600/60 font-mono">LIVE</span>
                </div>
              </div>

              {/* Chat messages */}
              <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto bg-white">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-red-100 px-4 py-3">
                    <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap font-mono">
                      {SAMPLE_PATIENT_DATA}
                    </p>
                  </div>
                </div>

                {/* AI response */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 border border-gray-200 px-4 py-3">
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {SAMPLE_WITHOUT_CENCORI}
                    </p>
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div className="px-5 py-3 border-t border-red-200 bg-red-50">
                <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 border border-red-200">
                  <span className="text-[11px] text-gray-400 flex-1">Type a patient query...</span>
                  <div className="flex items-center gap-2 text-[10px] text-red-600/50 font-mono">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    SENDING RAW PII
                  </div>
                </div>
              </div>
            </div>

            {/* PII tags floating */}
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {["Kwame Bakare", "14/03/1982", "MRN8749321", "+234 802 345 6789", "NHIS87492B"].map((pii) => (
                <span
                  key={pii}
                  className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-3 py-1"
                >
                  <span className="text-red-500 text-[10px]">●</span>
                  <span className="text-[10px] text-red-600/80 font-mono">{pii}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION: With Cencori */}
      <section id="solution" className="relative py-32 px-6 border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[11px] tracking-widest text-emerald-600/80 uppercase font-mono">The Solution</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-4 text-gray-900">With Cencori, Zero Data Exposure</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
              The same query, but routed through Cencori&apos;s AI gateway. PII is automatically
              detected and redacted before the data ever reaches the AI model.
            </p>
          </div>

          <div className="relative">
            {/* Shield banner */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5">
              <span className="text-emerald-600 text-[10px] font-mono tracking-wider">✅ PROTECTED — ALL PII REDACTED</span>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-emerald-200 bg-emerald-50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-[10px]">🛡</span>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-900">Cencori Gateway — PII Redacted</div>
                    <div className="text-[10px] text-emerald-600/60 font-mono">Patient data masked before reaching model</div>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-emerald-600/60 font-mono">SECURE</span>
                </div>
              </div>

              {/* Chat messages with redaction animation */}
              <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto bg-white">
                {/* User message - redacted */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-emerald-50 border border-emerald-200 px-4 py-3">
                    <p className="text-xs text-emerald-700/90 leading-relaxed whitespace-pre-wrap font-mono">
                      {SAMPLE_PATIENT_DATA.replace(/Kwame Bakare/g, "[PATIENT ✱✱✱✱✱]")
                        .replace(/14\/03\/1982/g, "[DOB ✱✱/✱✱/✱✱✱✱]")
                        .replace(/MRN8749321/g, "[MRN ✱✱✱✱✱✱✱]")
                        .replace(/kwame\.bakare@email\.com/g, "✱✱✱✱✱✱@email.com")
                        .replace(/\+234 802 345 6789/g, "(✱✱✱) ✱✱✱-✱✱✱✱")
                        .replace(/NHIS87492B/g, "[INSURANCE-✱✱✱✱✱✱]")}
                    </p>
                  </div>
                </div>

                {/* AI response - no PII */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 border border-gray-200 px-4 py-3">
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {SAMPLE_WITH_CENCORI}
                    </p>
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div className="px-5 py-3 border-t border-emerald-200 bg-emerald-50">
                <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 border border-emerald-200">
                  <span className="text-[11px] text-gray-400 flex-1">Type a patient query...</span>
                  <div className="flex items-center gap-2 text-[10px] text-emerald-600/60 font-mono">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    PII REDACTED ✅
                  </div>
                </div>
              </div>
            </div>

            {/* Redaction types grid */}
            <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {PII_EXAMPLES.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 hover:border-gray-300 transition-all"
                >
                  <div className="text-[10px] text-gray-500 font-mono tracking-wide mb-2">{item.label}</div>
                  <div className="text-xs text-red-600/80 mb-1 line-through decoration-red-300">{item.example}</div>
                  <div className="text-xs text-emerald-600 font-mono">{item.masked}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SIDE-BY-SIDE COMPARISON */}
      <section className="relative py-24 px-6 bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-900">See the Difference</h2>
            <p className="text-gray-500 max-w-lg mx-auto text-sm leading-relaxed">
              One gateway. Every AI model. Zero PII exposure.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Before */}
            <div className="rounded-2xl border border-red-200 overflow-hidden bg-white">
              <div className="bg-red-50 px-5 py-3 border-b border-red-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[10px]">✕</div>
                    <span className="text-xs font-medium text-red-600">Without Cencori</span>
                  </div>
                  <span className="text-[9px] text-red-500 font-mono tracking-wider">PII EXPOSED</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <code className="text-[10px] text-red-700 leading-relaxed block font-mono">
                    {`"My name is Kwame Bakare, DOB 14/03/1982,
my MRN is MRN8749321 and you can
reach me at kwame@email.com"`}
                  </code>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-red-600">
                  <span>→ Raw PII sent to GPT / Claude / Gemini</span>
                </div>
                <div className="rounded-lg bg-gray-100 border border-gray-200 p-3">
                  <code className="text-[10px] text-gray-500 leading-relaxed block">
                    ...patient Kwame Bakare (14/03/1982)...
                  </code>
                </div>
              </div>
            </div>

            {/* After */}
            <div className="rounded-2xl border border-emerald-200 overflow-hidden bg-white">
              <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">✓</div>
                    <span className="text-xs font-medium text-emerald-600">With Cencori</span>
                  </div>
                  <span className="text-[9px] text-emerald-500 font-mono tracking-wider">PROTECTED</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <code className="text-[10px] text-emerald-700 leading-relaxed block font-mono">
                    {`"My name is [PATIENT ✱✱✱✱✱], DOB [DOB ✱✱/✱✱/✱✱✱✱],
my MRN is [MRN ✱✱✱✱✱✱✱] and you can
reach me at ✱✱✱✱✱✱@email.com"`}
                  </code>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-emerald-600">
                  <span>→ PII auto-redacted before reaching any model</span>
                </div>
                <div className="rounded-lg bg-gray-100 border border-gray-200 p-3">
                  <code className="text-[10px] text-gray-500 leading-relaxed block">
                    ...patient [REDACTED] ([REDACTED])...
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Flow annotation */}
          <div className="mt-10 flex items-center justify-center gap-4 text-[11px] text-gray-400 font-mono">
            <span className="text-gray-600">EHR / EMR</span>
            <span className="text-gray-300">→</span>
            <span className="text-emerald-600 font-semibold">CENCORI GATEWAY</span>
            <span className="text-gray-300">→</span>
            <span className="text-gray-600">GPT-4o</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">Claude</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">Gemini</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">DeepSeek</span>
          </div>
        </div>
      </section>

      {/* LIVE INTERACTIVE DEMO */}
      <section id="demo" className="relative py-32 px-6 border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[11px] tracking-widest text-blue-600/80 uppercase font-mono">Live Demo</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-4 text-gray-900">Try It Yourself</h2>
            <p className="text-gray-500 max-w-lg mx-auto text-sm leading-relaxed">
              Type any patient data below and watch Cencori&apos;s PII redaction engine
              mask it in real-time. No data leaves your browser.
            </p>
          </div>

          <div ref={demoRef} className="grid md:grid-cols-2 gap-6">
            {/* Input */}
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Your Input</span>
                  <button
                    onClick={() => setLiveTab("input")}
                    className={`text-[10px] px-2 py-1 rounded transition-colors ${
                      liveTab === "input"
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Edit
                  </button>
                </div>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setLiveTab("input");
                }}
                className="w-full h-64 bg-white resize-none text-xs font-mono text-gray-800 p-4 focus:outline-none focus:ring-0 border-0"
                placeholder="Type patient data here..."
              />
            </div>

            {/* Output */}
            <div className="rounded-2xl border border-emerald-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-emerald-200 bg-emerald-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-emerald-700">After Redaction</span>
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-[10px] text-emerald-600/60 font-mono">
                    {redactions.length} items masked
                  </span>
                </div>
              </div>
              <div className="h-64 bg-white p-4 overflow-y-auto">
                {liveTab === "input" ? (
                  <pre className="text-xs font-mono text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {inputText}
                  </pre>
                ) : (
                  <div>
                    <pre className="text-xs font-mono text-emerald-700 leading-relaxed whitespace-pre-wrap">
                      {masked}
                    </pre>
                    {redactions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-emerald-200">
                        <div className="text-[10px] text-emerald-600/60 font-mono mb-2">Redacted Items:</div>
                        {redactions.map((r, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-[10px] font-mono py-1"
                          >
                            <span className="text-emerald-600">✓</span>
                            <span className="text-gray-400 line-through">{r.original}</span>
                            <span className="text-gray-300">→</span>
                            <span className="text-emerald-700">{r.masked}</span>
                            <span className="text-gray-300 ml-auto">{r.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="px-5 py-3 border-t border-emerald-200 bg-emerald-50 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-mono">
                  {redactions.length > 0
                    ? `${redactions.length} PII field${redactions.length !== 1 ? "s" : ""} detected`
                    : "No PII detected"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLiveTab(liveTab === "input" ? "redacted" : "input")}
                    className="text-[10px] px-3 py-1.5 rounded-full border border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-all"
                  >
                    {liveTab === "input" ? "Show Redacted →" : "← Show Original"}
                  </button>
                  <button
                    onClick={animateRedaction}
                    className="text-[10px] px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200 transition-all"
                  >
                    ▶ Animate
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-redact indicators */}
          {animatingIndex >= 0 && (
            <div className="mt-6 max-w-md mx-auto">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-[10px] text-emerald-600/60 font-mono mb-3">Real-time Redaction in Progress:</div>
                <div className="space-y-2">
                  {redactions.slice(0, animatingIndex + 1).map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-[10px] font-mono animate-in fade-in slide-in-from-left-2 duration-300"
                    >
                      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-gray-400 line-through">{r.original}</span>
                      <span className="text-gray-300">→</span>
                      <span className="text-emerald-700">{r.masked}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ARCHITECTURE FLOW */}
      <section id="architecture" className="relative py-32 px-6 bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[11px] tracking-widest text-violet-600/80 uppercase font-mono">Architecture</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-4 text-gray-900">How It Works</h2>
            <p className="text-gray-500 max-w-lg mx-auto text-sm leading-relaxed">
              A lightweight, real-time PII redaction layer that sits between your
              health systems and any AI model.
            </p>
          </div>

          {/* Flow diagram */}
          <div className="relative">
            <div className="hidden lg:block absolute top-16 left-[8%] right-[8%] h-0.5 bg-gradient-to-r from-red-400 via-violet-400 via-emerald-400 to-amber-400" />

            <div className="grid lg:grid-cols-6 gap-4">
              {ARCH_FLOW_STEPS.map((step, i) => (
                <div key={i} className="relative flex flex-col items-center text-center">
                  <div
                    className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm`}
                    style={{ background: `${["#fee2e2","#dbeafe","#ede9fe","#d1fae5","#fef3c7","#ccfbf1"][i]}` }}
                  >
                    <div className={`w-8 h-8 rounded-lg ${step.color} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-gray-800 mb-2">{step.label}</div>
                  <div className="text-[9px] text-gray-500 font-mono leading-relaxed max-w-[140px]">{step.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed flow */}
          <div className="mt-20 rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-600">Request Lifecycle</span>
            </div>
            <div className="p-6 space-y-0">
              {[
                {
                  stage: "1. Inbound Request",
                  desc: "EHR / EMR system sends a patient query containing PII (names, DOBs, MRNs, contact info)",
                  detail: "POST /v1/chat/completions { model: 'gpt-4', messages: [...] }",
                  color: "text-red-600",
                },
                {
                  stage: "2. Input Guard Pipeline",
                  desc: "Cencori gateway intercepts the request. Runs PII detection, jailbreak scanning, and custom data rules",
                  detail: "input-guard.ts → content-filter.ts → custom-rules.ts",
                  color: "text-blue-600",
                },
                {
                  stage: "3. PII Redaction Engine",
                  desc: "AI-powered detection finds and masks all sensitive fields using mask/redact/tokenize actions",
                  detail: "Names → [PATIENT ✱✱✱✱✱] | DOB → [DOB ✱✱/✱✱/✱✱✱✱] | MRN → [MRN ✱✱✱✱✱✱✱]",
                  color: "text-emerald-600",
                },
                {
                  stage: "4. Route to AI Model",
                  desc: "Clean, anonymized data is sent to any provider — OpenAI, Anthropic, Google, DeepSeek, etc.",
                  detail: "100+ models across 14+ providers — auto-failover, rate limiting, observability",
                  color: "text-amber-600",
                },
                {
                  stage: "5. Output Guard",
                  desc: "AI response is scanned for PII leakage before being returned to the application",
                  detail: "output-scanner.ts — detects leaked PII, instruction leakage, multiple PII instances",
                  color: "text-violet-600",
                },
                {
                  stage: "6. Response Delivered",
                  desc: "Safe, redacted response returned to the clinician. Zero patient data ever exposed.",
                  detail: "Full audit trail logged for HIPAA/NDPR compliance",
                  color: "text-teal-600",
                },
              ].map((step, i) => (
                <div
                  key={i}
                  className="relative flex items-start gap-6 py-5 group"
                >
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${step.color.replace("text-", "bg-")} opacity-80`} />
                    {i < 5 && <div className="w-px flex-1 bg-gray-200 group-hover:bg-gray-300 transition-colors mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-5">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`text-xs font-medium ${step.color}`}>{step.stage}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-2">{step.desc}</p>
                    <code className="text-[9px] text-gray-400 font-mono block bg-gray-50 rounded-lg p-2 border border-gray-200">
                      {step.detail}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* KEY FEATURES */}
      <section className="relative py-24 px-6 border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-900">Built for Government Health Systems</h2>
            <p className="text-gray-500 max-w-lg mx-auto text-sm leading-relaxed">
              Enterprise-grade features designed for regulated environments
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: "🛡",
                title: "Zero Data Retention",
                desc: "Cencori never stores patient data. All PII detection happens in-memory and is discarded immediately after redaction.",
              },
              {
                icon: "🔐",
                title: "On-Prem Deployable",
                desc: "Deploy the gateway within Ekiti State's own VPC or data center. Data never leaves your controlled environment.",
              },
              {
                icon: "📋",
                title: "Full Audit Trail",
                desc: "Every request is logged with redaction metadata. Complete compliance traceability for NDPR and global health data regulations.",
              },
              {
                icon: "🔄",
                title: "Multi-Model Failover",
                desc: "If one provider goes down, requests automatically route to backup models. Zero downtime for critical health queries.",
              },
              {
                icon: "🎯",
                title: "Custom Redaction Rules",
                desc: "Define your own PII patterns. Keyword, regex, JSON path, or AI-powered detection for domain-specific sensitive data.",
              },
              {
                icon: "⚡",
                title: "<50ms Overhead",
                desc: "PII redaction adds negligible latency. Your clinicians get fast responses without compromising data security.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-gray-50 p-5 hover:border-gray-300 transition-all group"
              >
                <div className="text-lg mb-3">{feature.icon}</div>
                <div className="text-sm font-medium text-gray-800 mb-2">{feature.title}</div>
                <div className="text-[11px] text-gray-500 leading-relaxed">{feature.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 px-6 border-t border-gray-200 bg-gray-50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900">
            Ready to deploy AI safely?
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto text-sm leading-relaxed mb-10">
            Get a free testing environment provisioned for Ekiti State&apos;s digital
            transformation team. Try it with your own data, see the results in real-time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://cencori.com/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all"
            >
              Request Sandbox Access
            </a>
            <a
              href="https://cencori.com/ai-gateway"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gray-300 text-gray-600 text-sm hover:text-gray-900 hover:border-gray-400 transition-all"
            >
              Read Documentation
            </a>
          </div>
          <p className="mt-6 text-[10px] text-gray-400 font-mono">
            No credit card. No commitment. Free testing environment provisioned within 24 hours.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">C</span>
            </div>
            Cencori — Cloud Intelligence Provider
          </div>
          <div className="text-[10px] text-gray-400 font-mono">
            Built for Ekiti State Health
          </div>
        </div>
      </footer>
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
