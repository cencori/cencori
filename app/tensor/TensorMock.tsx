"use client";

import { useEffect, useRef, useState } from "react";
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  BookOpen02Icon,
  CommandLineIcon,
  Database01Icon,
  FolderGitIcon,
  HelpCircleIcon,
  PencilEdit01Icon,
  PlusSignCircleIcon,
  SearchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

// Inline stroke icons (not dependent on the hugeicons package version —
// missing package exports crash SSR prerender, so version-gated icons
// live here instead).
function TensorBellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" width="15" height="15" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.75a4.5 4.5 0 0 0-4.5 4.5c0 3.5-1.25 4.75-1.25 4.75h11.5s-1.25-1.25-1.25-4.75A4.5 4.5 0 0 0 10 2.75Z" />
      <path d="M8.25 15a1.75 1.75 0 0 0 3.5 0" />
    </svg>
  );
}

function TensorPullRequestIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" width="14" height="14" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="5" r="2" />
      <circle cx="5.5" cy="15" r="2" />
      <circle cx="14.5" cy="9.5" r="2" />
      <path d="M5.5 7v6M14.5 11.5c0 2-2.5 2-4.5 2H7.5" />
    </svg>
  );
}

function TensorLeftSidebarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" width="14" height="14" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.75" y="3.25" width="14.5" height="13.5" rx="2.25" />
      <path d="M7.25 3.75v12.5" />
    </svg>
  );
}

function TensorNewTaskIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" width="14" height="14" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.25 3.25H5.5A2.25 2.25 0 0 0 3.25 5.5v9A2.25 2.25 0 0 0 5.5 16.75h9a2.25 2.25 0 0 0 2.25-2.25V9.75" />
      <path d="m9.25 10.75.45-2.2 5.55-5.55 1.75 1.75-5.55 5.55-2.2.45Z" />
    </svg>
  );
}

function TensorComposerPlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="14" height="14" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16M4 12h16" />
    </svg>
  );
}

function TensorComposerChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" width="10" height="10" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

function TensorComposerMicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="14" height="14" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="3" width="8" height="13" rx="4" />
      <path d="M5.5 11.5v.5a6.5 6.5 0 0 0 13 0v-.5M12 18.5V22M9 22h6" />
    </svg>
  );
}

function TensorComposerArrowUpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="13" height="13" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 11 7-7 7 7M12 4v16" />
    </svg>
  );
}

function TensorResponseCopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" width="13" height="13" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
      <rect x="6.25" y="6.25" width="9.5" height="9.5" rx="2" />
      <path d="M13.75 6.25v-1A2 2 0 0 0 11.75 3.25h-6.5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h1" />
    </svg>
  );
}

function TensorResponseThumbUpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" width="13" height="13" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.25 16.25h-2a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h2M6.25 16.25h6.9a2 2 0 0 0 1.94-1.52l1.4-5.6a1.5 1.5 0 0 0-1.46-1.88h-3.28l.45-2.06A2 2 0 0 0 10.25 2.75L6.25 8.5v7.75Z" />
    </svg>
  );
}

function TensorResponseThumbDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" width="13" height="13" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.25 3.75h-2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2M6.25 3.75h6.9a2 2 0 0 1 1.94 1.52l1.4 5.6a1.5 1.5 0 0 1-1.46 1.88h-3.28l.45 2.06a2 2 0 0 1-1.95 2.44l-4-5.75V3.75Z" />
    </svg>
  );
}

type MockTask = {
  id: string;
  label: string;
  prompt: string;
  workedFor: string;
  feedback1: string;
  feedback2: string;
  feedback3: string;
  finalLead: React.ReactNode;
  finalHeading: string;
  finalBody: React.ReactNode;
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9px] rounded bg-white/10 px-1 py-px text-white/85">
      {children}
    </span>
  );
}

function LiveExchanges({ exchanges }: { exchanges: { id: number; prompt: string; ready: boolean }[] }) {
  if (!exchanges.length) return null;
  return (
    <>
      {exchanges.map((exchange) => (
        <div className="mt-4 flex flex-col" key={exchange.id}>
          <p className="ml-auto w-fit max-w-[75%] rounded-[1.15rem] rounded-br-[0.4rem] border border-white bg-white px-3 py-2 text-[10px] font-normal leading-[1.45] tracking-[-0.012em] text-black">
            {exchange.prompt}
          </p>
          {exchange.ready ? (
            <p className="mt-2 text-[10px] leading-relaxed text-white/75">
              To try out Tensor,{" "}
              <a href="#waitlist" className="underline underline-offset-2 hover:text-white">
                join the waitlist
              </a>
              .
            </p>
          ) : (
            <p
              className="mt-2 w-fit bg-[linear-gradient(100deg,rgba(255,255,255,0.35)_30%,#fff_48%,rgba(255,255,255,0.35)_66%)] bg-[length:240%_100%] bg-clip-text text-[10px] font-normal text-transparent"
              style={{ animation: "agent-thinking-shimmer 2.4s linear 1", backgroundPosition: "180% 50%" }}
            >
              Thinking.
            </p>
          )}
        </div>
      ))}
    </>
  );
}

const TASKS: MockTask[] = [
  {
    id: "auth",
    label: "Refactor auth middleware",
    prompt:
      "Refactor the auth middleware — split session parsing, refresh rotation, and redirect handling into isolated, testable units.",
    workedFor: "Worked for 2m 41s",
    feedback1:
      "I'll split the auth middleware into focused units, keeping every existing redirect contract intact. Starting with a full read of the current flow so nothing subtle gets lost in the split.",
    feedback2:
      "Session parsing, refresh rotation, and redirects are tangled in one module — separating them now. Each unit gets a narrow boundary so failures stay isolated and tests can target them directly.",
    feedback3:
      "Units are split — verifying with tests and type checks before I hand it back. I'll run the auth suite plus a full type check, then confirm the legacy callback URLs still resolve.",
    finalLead: (
      <>
        Done — <Code>lib/tensor-auth.ts</Code> is now three focused units with the existing redirect contracts untouched. Refresh rotation got its own retry boundary, so a failed rotation no longer takes down session parsing.
      </>
    ),
    finalHeading: "The refactor",
    finalBody: (
      <>
        Session parsing, rotation (<Code>rotate-refresh</Code>), and redirects (<Code>resolve-redirect</Code>) are independently testable — 14 new cases cover expired sessions, concurrent refreshes, and{" "}
        <span className="font-semibold text-white">legacy callback URLs that must keep working</span>.
      </>
    ),
  },
  {
    id: "webhook",
    label: "Fix checkout webhook retry",
    prompt:
      "Fix the checkout webhook retry — Paystack retries are creating duplicate provisions when the first attempt is just slow.",
    workedFor: "Worked for 1m 18s",
    feedback1:
      "I'll make webhook provisioning idempotent so a slow first attempt can't double-provision. Reading the billing route and the retry path first to map every write.",
    feedback2:
      "The checkout and webhook handlers share no dedupe key — adding one now. Every provision will key off the checkout ID before touching entitlements, so retries collapse safely.",
    feedback3:
      "Dedupe is in — running the billing suite plus a simulated retry storm to confirm single provisioning. Then I'll re-check the cancelled-checkout edge so refunds still flow.",
    finalLead: (
      <>
        Done — <Code>lib/tensor-billing.ts</Code> provisions exactly once per checkout, no matter how many times the provider retries. The dedupe key lands before any entitlement write, so slow first attempts just re-attach.
      </>
    ),
    finalHeading: "The fix",
    finalBody: (
      <>
        Provisioning now keys off <Code>checkout-id</Code> with a short-lived claim window — 9 new cases cover duplicate deliveries, out-of-order retries, and{" "}
        <span className="font-semibold text-white">cancelled checkouts that must never provision</span>.
      </>
    ),
  },
  {
    id: "hero",
    label: "Add tensor landing hero",
    prompt:
      "Add the tensor landing hero — black canvas, bold header, and a live product mock visitors can click through.",
    workedFor: "Worked for 58s",
    feedback1:
      "I'll build the hero as a black canvas with the new headline, then frame the product mock visitors can click around in. Checking the compressed backdrop sizes first so it stays light.",
    feedback2:
      "Header and backdrop are set — wiring the sidebar histories now. Each history swaps the thread context, so the mock reads like the real workspace instead of a screenshot.",
    feedback3:
      "Interactions are live — verifying spacing, contrast, and scroll behavior before handoff. The composer stays docked while long threads scroll cleanly behind it.",
    finalLead: (
      <>
        Done — <Code>app/tensor/page.tsx</Code> ships a black hero with the new headline and a clickable product mock. The backdrop serves AVIF first with a WebP fallback at roughly a hundredth of the original weight.
      </>
    ),
    finalHeading: "The hero",
    finalBody: (
      <>
        Three threads (<Code>auth</Code>, <Code>webhook</Code>, <Code>hero</Code>) drive the mock through <Code>TensorMock</Code> state — histories are real buttons, and{" "}
        <span className="font-semibold text-white">the thread content always matches the selected history</span>.
      </>
    ),
  },
];

export function TensorMock() {
  const [selectedId, setSelectedId] = useState<string>(TASKS[0].id);
  const [input, setInput] = useState("");
  const [live, setLive] = useState<Record<string, { id: number; prompt: string; ready: boolean }[]>>({});
  const [customThreads, setCustomThreads] = useState<string[]>([]);
  const exchangeId = useRef(0);
  const threadCounter = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const task = TASKS.find((t) => t.id === selectedId) ?? null;
  const liveExchanges = live[selectedId] ?? [];

  function selectThread(id: string) {
    setSelectedId(id);
    setInput("");
  }

  function newTask() {
    const fresh = customThreads.find((id) => (live[id] ?? []).length === 0);
    if (fresh) {
      setSelectedId(fresh);
      setInput("");
      return;
    }
    threadCounter.current += 1;
    const id = `custom-${threadCounter.current}`;
    setCustomThreads((prev) => [id, ...prev]);
    setSelectedId(id);
    setInput("");
  }

  function sendRequest() {
    const prompt = input.trim();
    if (!prompt) return;
    exchangeId.current += 1;
    const id = exchangeId.current;
    const threadId = selectedId;
    setLive((prev) => ({ ...prev, [threadId]: [...(prev[threadId] ?? []), { id, prompt, ready: false }] }));
    setInput("");
    window.setTimeout(() => {
      setLive((prev) => ({
        ...prev,
        [threadId]: (prev[threadId] ?? []).map((exchange) =>
          exchange.id === id ? { ...exchange, ready: true } : exchange,
        ),
      }));
    }, 2500);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [live, selectedId]);

  return (
    <div
      className="flex h-[540px] w-full items-center justify-center rounded-xl bg-black p-6 md:h-[680px] md:p-10"
      style={{
        backgroundImage:
          "image-set(url('/tensor/heroback-bg.avif') type('image/avif'), url('/tensor/heroback-bg.webp') type('image/webp'))",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="flex h-full w-full overflow-hidden rounded-lg bg-black/85">
        <div className="flex w-52 shrink-0 flex-col border-r border-white/10 px-3.5 pb-3.5 pt-1 md:w-56">
          <div className="flex items-center gap-2.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
            <span className="ml-1 flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-white/80">
              <TensorLeftSidebarIcon />
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-md text-white/50">
              <TensorNewTaskIcon />
            </span>
          </div>
          <div className="mt-5 flex items-center justify-between px-1">
            <p className="text-[13px] font-semibold tracking-tight text-[#EDE6D9]">Tensor</p>
            <span className="text-white/40">
              <HugeiconsIcon icon={SearchIcon} size={14} strokeWidth={1.6} aria-hidden="true" />
            </span>
          </div>
          <div className="mt-4 grid gap-1 px-1 text-[12px] text-[#EDE6D9]/90">
            <button
              type="button"
              onClick={newTask}
              aria-pressed={selectedId.startsWith("custom-")}
              className={`flex items-center gap-2 rounded-md px-1 -mx-1 py-1 text-left transition-colors ${
                selectedId.startsWith("custom-") && (live[selectedId] ?? []).length === 0 ? "bg-white/10 text-[#EDE6D9]" : "hover:bg-white/5 hover:text-[#EDE6D9]"
              }`}
            >
              <span className="shrink-0 text-[#EDE6D9]/80">
                <HugeiconsIcon icon={PlusSignCircleIcon} size={14} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span>New task</span>
            </button>
            <div className="flex cursor-default items-center gap-2 rounded-md px-1 -mx-1 py-1 transition-colors hover:bg-white/5 hover:text-[#EDE6D9]">
              <span className="shrink-0 text-[#EDE6D9]/80">
                <HugeiconsIcon icon={Database01Icon} size={14} strokeWidth={1.45} aria-hidden="true" />
              </span>
              <span>Runs</span>
            </div>
            <div className="flex cursor-default items-center gap-2 rounded-md px-1 -mx-1 py-1 transition-colors hover:bg-white/5 hover:text-[#EDE6D9]">
              <span className="shrink-0 text-[#EDE6D9]/80">
                <TensorPullRequestIcon />
              </span>
              <span>Pull requests</span>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between px-1 text-[12px]">
            <p className="font-medium tracking-tight text-[#EDE6D9]/40">Workspaces</p>
            <span className="text-[#EDE6D9]/50">
              <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.55} aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2 px-1 text-[12px] text-[#EDE6D9]/90">
              <span className="shrink-0 text-[#EDE6D9]/60">
                <HugeiconsIcon icon={FolderGitIcon} size={14} strokeWidth={1.45} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate">cencori</span>
              <span className="shrink-0 text-[#EDE6D9]/40">
                <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={1.55} aria-hidden="true" />
              </span>
            </div>
            <div className="mt-1.5 grid gap-1 text-[12px]" role="listbox" aria-label="Threads">
              {customThreads.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={id === selectedId}
                  onClick={() => selectThread(id)}
                  className={`truncate px-2 py-1 pl-8 text-left transition-colors ${
                    id === selectedId ? "rounded-md bg-white/10 text-[#EDE6D9]" : "text-[#EDE6D9]/45 hover:text-[#EDE6D9]/80"
                  }`}
                >
                  New task
                </button>
              ))}
              {TASKS.map((t) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => selectThread(t.id)}
                    className={`truncate px-2 py-1 pl-8 text-left transition-colors ${
                      active ? "rounded-md bg-white/10 text-[#EDE6D9]" : "text-[#EDE6D9]/45 hover:text-[#EDE6D9]/80"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="-mx-3.5 -mb-3.5 mt-auto flex items-center gap-2 border-t border-white/10 px-3.5 pb-3.5 pt-3">
            <img
              src="/downloads/bb-avatar.webp"
              alt="Bola Banjo"
              className="h-6 w-6 shrink-0 cursor-default rounded-full object-cover transition hover:brightness-110"
            />
            <p className="min-w-0 flex-1 cursor-default truncate text-[12px] text-[#EDE6D9]/90 transition-colors hover:text-[#EDE6D9]">Bola Banjo</p>
            <span className="shrink-0 cursor-default rounded-md p-1 -m-1 text-[#EDE6D9]/50 transition-colors hover:bg-white/10 hover:text-[#EDE6D9]">
              <HugeiconsIcon icon={HelpCircleIcon} size={15} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="shrink-0 cursor-default rounded-md p-1 -m-1 text-[#EDE6D9]/50 transition-colors hover:bg-white/10 hover:text-[#EDE6D9]">
              <TensorBellIcon />
            </span>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-5 md:px-8">
            {task ? (
            <div className="mx-auto flex w-full max-w-lg flex-col" key={task.id}>
              <p className="ml-auto w-fit max-w-[75%] rounded-[1.15rem] rounded-br-[0.4rem] border border-white bg-white px-3 py-2 text-[10px] font-normal leading-[1.45] tracking-[-0.012em] text-black">
                {task.prompt}
              </p>
              <p className="mt-4 text-[9px] font-normal text-[#EDE6D9]/40">
                {task.workedFor}
              </p>
              <div className="my-2 border-t border-white/10" />
              <div className="grid gap-2 py-1 text-[10px] leading-relaxed">
                <p className="font-normal text-white/75">{task.feedback1}</p>
                <div className="flex items-center gap-2 font-normal text-[#EDE6D9]/55">
                  <span className="shrink-0 text-[#EDE6D9]/50">
                    <HugeiconsIcon icon={BookOpen02Icon} size={13} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span>Read files</span>
                </div>
                <p className="font-normal text-white/75">{task.feedback2}</p>
                <div className="flex items-center gap-2 font-normal text-[#EDE6D9]/55">
                  <span className="shrink-0 text-[#EDE6D9]/50">
                    <HugeiconsIcon icon={PencilEdit01Icon} size={13} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span>Edited files</span>
                  <span className="text-[#EDE6D9]/35">
                    <HugeiconsIcon icon={ArrowRight01Icon} size={11} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                </div>
                <p className="font-normal text-white/75">{task.feedback3}</p>
                <div className="flex items-center gap-2 font-normal text-[#EDE6D9]/55">
                  <span className="shrink-0 text-[#EDE6D9]/50">
                    <HugeiconsIcon icon={CommandLineIcon} size={13} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span>Ran commands</span>
                </div>
              </div>
              <div className="text-[10px] leading-relaxed text-white/75">
                <p>{task.finalLead}</p>
                <p className="mt-2 text-[11px] font-semibold tracking-tight text-white">
                  {task.finalHeading}
                </p>
                <p className="mt-1">{task.finalBody}</p>
              </div>
              <div className="mb-1 mt-[0.65rem] flex items-center gap-[0.12rem]">
                <span className="grid h-[1.65rem] w-[1.65rem] place-items-center rounded-[0.55rem] text-white/30">
                  <TensorResponseCopyIcon />
                </span>
                <span className="grid h-[1.65rem] w-[1.65rem] place-items-center rounded-[0.55rem] text-white/30">
                  <TensorResponseThumbUpIcon />
                </span>
                <span className="grid h-[1.65rem] w-[1.65rem] place-items-center rounded-[0.55rem] text-white/30">
                  <TensorResponseThumbDownIcon />
                </span>
              </div>
              <LiveExchanges exchanges={liveExchanges} />
            </div>
            ) : (
              <div className="mx-auto flex w-full max-w-lg flex-col">
                <LiveExchanges exchanges={liveExchanges} />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-end p-6 pb-4 pt-2 md:p-10 md:pb-4 md:pt-2">
            <form
              className="mx-auto w-full max-w-lg"
              onSubmit={(event) => {
                event.preventDefault();
                sendRequest();
              }}
            >
              <div className="flex min-h-[5rem] w-full flex-col rounded-[1.5rem] border border-white/10 bg-[#1c1c1e] shadow-[0_1.5rem_4rem_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.025)]">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendRequest();
                    }
                  }}
                  placeholder="Plan, Build, Ship."
                  rows={1}
                  aria-label="Ask Tensor"
                  className="w-full resize-none bg-transparent px-[1.1rem] pb-[0.1rem] pt-[0.95rem] text-[0.75rem] font-normal leading-[1.55] tracking-[-0.012em] text-white placeholder:text-white/30 focus:outline-none"
                />
                <div className="flex min-h-[2.8rem] items-center justify-between px-[0.55rem] pb-[0.4rem] pt-[0.2rem]">
                  <div className="flex items-center gap-1" aria-hidden="true">
                    <span className="inline-flex h-[1.8rem] w-[1.8rem] cursor-default items-center justify-center rounded-[0.65rem] text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                      <TensorComposerPlusIcon />
                    </span>
                    <span className="flex h-[1.8rem] max-w-[10rem] cursor-default items-center gap-1 rounded-[0.65rem] px-[0.4rem] text-[0.65rem] font-medium tracking-[-0.01em] text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                      <span className="truncate">Maximo Atlas 1.3</span>
                      <TensorComposerChevronIcon />
                    </span>
                    <span className="flex h-[1.8rem] max-w-[6.5rem] cursor-default items-center gap-1 rounded-[0.65rem] px-[0.4rem] text-[0.65rem] font-medium tracking-[-0.01em] text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                      <span className="truncate">Auto</span>
                      <TensorComposerChevronIcon />
                    </span>
                  </div>
                  <div className="flex items-center gap-[0.3rem]">
                    <span className="inline-flex h-[1.8rem] w-[1.8rem] cursor-default items-center justify-center rounded-[0.65rem] text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-hidden="true">
                      <TensorComposerMicIcon />
                    </span>
                    <button
                      type="submit"
                      aria-label="Send request"
                      className="grid h-[1.8rem] w-[1.8rem] place-items-center rounded-full bg-[#f0f0f2] text-[#1c1c1e] transition-transform hover:scale-105 active:scale-95"
                    >
                      <TensorComposerArrowUpIcon />
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
