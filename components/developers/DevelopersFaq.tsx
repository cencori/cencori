"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqData = [
  {
    id: "what-is-cencori",
    question: "What is Cencori for developers?",
    answer:
      "Cencori gives developers infrastructure to build and run AI products—from model access and inference to memory, agents, deployment, observability, security, and monetization.",
  },
  {
    id: "existing-stack",
    question: "Do I have to replace my existing AI stack?",
    answer:
      "No. Cencori is designed to fit into existing applications and workflows. You can start with a single capability, such as the Gateway or Memory, and adopt more of the platform as your application grows.",
  },
  {
    id: "multi-provider",
    question: "Can I use multiple AI model providers through Cencori?",
    answer:
      "Yes. Cencori provides a unified, OpenAI-compatible interface for working with multiple model providers, with routing, failover, usage controls, observability, and security built around the request path.",
  },
  {
    id: "openai-sdk",
    question: "Can I use my existing OpenAI SDK?",
    answer:
      "Yes. Cencori supports an OpenAI-compatible API, so many existing applications can move to Cencori by changing the base URL and API key rather than rewriting their model integration.",
  },
  {
    id: "bring-model",
    question: "Can I bring my own model?",
    answer:
      "Yes. Cencori is designed to support both external model providers and models you bring, train, fine-tune, host, or deploy through Cencori.",
  },
  {
    id: "gpus",
    question: "Do I need to manage GPUs myself?",
    answer:
      "No. The goal of Cencori Compute is to let you submit the workload while Cencori handles the underlying compute provisioning, execution, scheduling, and infrastructure required to run it.",
  },
  {
    id: "train-finetune",
    question: "Can I train and fine-tune models on Cencori?",
    answer:
      "Cencori Models is being designed around the complete model lifecycle: training, fine-tuning, evaluation, hosting, deployment, and inference. Developers bring the model logic, data, and training code; Cencori provides the computing environment that runs the job.",
  },
  {
    id: "memory",
    question: "What is Cencori Memory?",
    answer:
      "Cencori Memory provides persistent state for AI applications and agents. It can be used for user memory, conversation history, long-term context, knowledge retrieval, agent state, and information that needs to survive beyond a single model request.",
  },
  {
    id: "deploy-agents",
    question: "Can I deploy agents on Cencori?",
    answer:
      "Yes. Cencori Agentic Infrastructure is designed for deploying and operating agents with persistent execution, memory, tools, triggers, observability, secrets, budgets, and other production requirements.",
  },
  {
    id: "arcie-required",
    question: "Do I have to use Arcie to deploy an agent?",
    answer:
      "No. Arcie is Cencori's first-party agent framework, but Cencori's agentic infrastructure is intended to be framework-agnostic. Developers can use Arcie or bring agents built with other frameworks or their own code.",
  },
  {
    id: "arcie-vs-infra",
    question: "What is the difference between Arcie and Cencori Agent Infrastructure?",
    answer:
      "Arcie is a framework for building agents. Cencori Agent Infrastructure provides the runtime and infrastructure for running and operating agents. Arcie integrates deeply with Cencori, but the runtime is not limited to Arcie.",
  },
  {
    id: "monetize",
    question: "Can Cencori help me monetize an AI product?",
    answer:
      "Yes. Cencori includes usage metering, budgets, per-user limits, and end-user billing infrastructure so developers can measure and monetize the AI usage inside their own applications.",
  },
  {
    id: "observability",
    question: "Does Cencori provide observability?",
    answer:
      "Yes. Developers can monitor requests, models, latency, usage, costs, failures, security events, and other operational data from their Cencori projects.",
  },
  {
    id: "production-only",
    question: "Is Cencori only for production applications?",
    answer:
      "No. You can start with Cencori while experimenting or prototyping and continue using the same infrastructure as the product moves into production and larger-scale deployments.",
  },
  {
    id: "gateway-only",
    question: "Can I use Cencori only for the Gateway?",
    answer:
      "Yes. Cencori's products are composable. You can use the Gateway without adopting Memory, Agents, Compute, or other infrastructure, and add them when your workload requires them.",
  },
  {
    id: "what-build",
    question: "What can I build on Cencori?",
    answer:
      "AI applications, agents, AI-powered SaaS products, custom models, voice and multimodal systems, research workloads, developer tools, autonomous systems, and other software that requires AI infrastructure.",
  },
  {
    id: "where-start",
    question: "Where should I start?",
    answer:
      "If you already have an AI application, the fastest starting point is usually the Cencori Gateway. If you are building an agent, start with Agent Infrastructure or Arcie. If you are working with your own models, start with Cencori Models and Compute.",
  },
];

const INITIAL_COUNT = 5;

export function DevelopersFaq() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? faqData : faqData.slice(0, INITIAL_COUNT);

  return (
    <section className="relative px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="mx-auto max-w-xl text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          FAQs.
        </h2>
        <div className="mt-10">
          <Accordion type="single" collapsible className="w-full">
            {visible.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="rounded-none border-b border-white/10 bg-transparent px-0 last:border-b-0"
              >
                <AccordionTrigger className="py-5 text-left text-[15px] font-medium hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-6 text-center">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex h-9 items-center underline px-5 text-[13px] font-semibold text-white transition-colors"
              type="button"
            >
              {expanded ? "Show fewer" : `View all`}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
