"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TENSOR_WAITLIST_MULTI,
  TENSOR_WAITLIST_OPTIONS,
  emptyTensorWaitlist,
  type TensorWaitlistFieldKey,
  type TensorWaitlistFields,
} from "@/lib/tensor-waitlist";
import { gateReply, quickGateEmail } from "@/lib/tensor-email-quick";

type Msg = { role: "user" | "assistant"; content: string };

type AgentResponse = {
  reply: string;
  collected: TensorWaitlistFields;
  currentField: TensorWaitlistFieldKey | null;
  done: boolean;
  provider?: string;
};

function placeholders(field: TensorWaitlistFieldKey | null): string {
  switch (field) {
    case "name":
      return "Your name…";
    case "workEmail":
      return "name@company.com…";
    case "company":
      return "Company or project…";
    case "role":
      return "e.g. Founding engineer…";
    case "building":
      return "What are you building?…";
    case "anythingElse":
      return "Anything else? (or skip)…";
    default:
      return "Type your answer…";
  }
}

const STORAGE_KEY = "tensor-waitlist-progress-v1";
const MAX_STORED_MESSAGES = 30;

type StoredProgress = {
  messages: Msg[];
  collected: TensorWaitlistFields;
  currentField: TensorWaitlistFieldKey | null;
  submitState: "idle" | "done" | "error";
};

function loadProgress(): StoredProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    if (!Array.isArray(parsed.messages) || typeof parsed.collected !== "object" || !parsed.collected) return null;
    const messages = parsed.messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_STORED_MESSAGES);
    if (messages.length === 0) return null;
    return {
      messages,
      collected: { ...emptyTensorWaitlist(), ...parsed.collected },
      currentField: parsed.currentField ?? null,
      submitState: parsed.submitState === "done" || parsed.submitState === "error" ? parsed.submitState : "idle",
    };
  } catch {
    return null;
  }
}

export function TensorWaitlistChat({ onClose }: { onClose: () => void }) {
  const [restored] = useState<StoredProgress | null>(() => loadProgress());
  const [messages, setMessages] = useState<Msg[]>(() => restored?.messages ?? []);
  const [collected, setCollected] = useState<TensorWaitlistFields>(() => restored?.collected ?? emptyTensorWaitlist());
  const [currentField, setCurrentField] = useState<TensorWaitlistFieldKey | null>(() => restored?.currentField ?? "name");
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done" | "error">(() => restored?.submitState ?? "idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [booted, setBooted] = useState(() => restored !== null);
  const [stage, setStage] = useState<"chat" | "leaving" | "final">(() => (restored?.submitState === "done" ? "final" : "chat"));
  const [finalIn, setFinalIn] = useState(() => restored?.submitState === "done");
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // Persist progress so a refresh / accidental close resumes mid-conversation.
  // Never stores thinking state; "submitting" resolves to idle on reload
  // (no auto-resubmit — avoids double-saving to the webhook).
  useEffect(() => {
    try {
      if (messages.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const snapshot: StoredProgress = {
        messages: messages.slice(-MAX_STORED_MESSAGES),
        collected,
        currentField,
        submitState: submitState === "done" || submitState === "error" ? submitState : "idle",
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Storage full or blocked — the chat still works, just without resume.
    }
  }, [messages, collected, currentField, submitState]);

  const scrollDown = useCallback(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, []);

  useEffect(scrollDown, [messages, thinking, scrollDown]);

  const talk = useCallback(async (history: Msg[], data: TensorWaitlistFields, field: TensorWaitlistFieldKey | null) => {
    setThinking(true);
    try {
      const res = await fetch("/api/tensor/waitlist-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, collected: data, currentField: field }),
      });
      const json = (await res.json()) as AgentResponse;
      if (!res.ok || !json.reply) throw new Error("agent failed");
      setCollected(json.collected);
      setCurrentField(json.currentField);
      setMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
      setMultiSel([]);
      if (json.done) {
        await submitWaitlist(json.collected);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection hiccup — could you repeat that last answer?" },
      ]);
    } finally {
      setThinking(false);
    }
  }, []);

  async function submitWaitlist(data: TensorWaitlistFields) {
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.workEmail,
          workEmail: data.workEmail,
          productName: "tensor",
          source: "tensor-agent",
          name: data.name,
          company: data.company,
          role: data.role,
          building: data.building,
          planInterested: data.planInterested,
          timeline: data.timeline,
          currentTools: data.currentTools,
          priorities: data.priorities,
          budget: data.budget,
          heardAbout: data.heardAbout,
          anythingElse: data.anythingElse,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `save failed (${res.status})`);
      }
      setSubmitState("done");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `You're on the list, ${data.name.split(" ")[0] || "friend"}. We'll reach out at ${data.workEmail} as soon as your Tensor seat opens.`,
        },
      ]);
    } catch (err) {
      setSubmitState("error");
      // Single error slot — never appended to the thread, so retries
      // replace it instead of stacking.
      setSubmitError(err instanceof Error ? err.message : "save failed");
    }
  }

  // Boot: fetch greeting once — unless progress was restored, in which
  // case we resume silently right where they left off.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (restored) return;
    setBooted(true);
    void talk([], emptyTensorWaitlist(), "name");
  }, [talk, restored]);

  // After submit: let the closing messages land, then fade everything out
  // and swap to the dead-centered card (footer stays, owned by the shell).
  useEffect(() => {
    if (submitState !== "done" || stage !== "chat") return;
    const t1 = window.setTimeout(() => setStage("leaving"), 1800);
    return () => window.clearTimeout(t1);
  }, [submitState, stage]);

  useEffect(() => {
    if (stage !== "leaving") return;
    const t2 = window.setTimeout(() => {
      setStage("final");
      requestAnimationFrame(() => requestAnimationFrame(() => setFinalIn(true)));
    }, 500);
    return () => window.clearTimeout(t2);
  }, [stage]);

  function resetChat() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore — chat still resets in memory.
    }
    setMessages([]);
    setCollected(emptyTensorWaitlist());
    setCurrentField("name");
    setSubmitState("idle");
    setSubmitError(null);
    setStage("chat");
    setFinalIn(false);
    setInput("");
    setMultiSel([]);
    void talk([], emptyTensorWaitlist(), "name");
  }

  function sendText(raw: string) {
    const text = raw.trim();
    if (!text || thinking || submitState === "done") return;
    // Instant bounce for obvious fakes — no round-trip, no thinking delay.
    if (currentField === "workEmail") {
      const quick = quickGateEmail(text);
      if (quick !== "ok") {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: text },
          { role: "assistant", content: gateReply(quick) },
        ]);
        setInput("");
        return;
      }
    }
    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setMultiSel([]);
    void talk(history, collected, currentField);
  }

  function sendChips(values: string[]) {
    if (!values.length || thinking) return;
    sendText(values.join(", "));
  }

  const chips = currentField ? TENSOR_WAITLIST_OPTIONS[currentField] ?? null : null;
  const isMulti = currentField ? !!TENSOR_WAITLIST_MULTI[currentField] : false;
  const showSuccess = submitState === "done";

  if (stage === "final") {
    return (
      <section
        id="waitlist"
        aria-label="Tensor waitlist confirmed"
        className="mx-auto grid h-full min-h-0 w-full max-w-2xl flex-1 place-items-center overflow-hidden px-5 pb-4 pt-2 md:px-8"
      >
        <div
          className={`flex w-full flex-col items-center text-center transition-all duration-500 ease-out ${
            finalIn ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"
          }`}
        >
          <p className="text-base font-semibold text-white md:text-lg">You&apos;re on the Tensor waitlist.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-white/85"
            >
              Back to overview
            </button>
            <button
              type="button"
              onClick={resetChat}
              className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Add another person
            </button>
          </div>
        </div>
      </section>
    );
  }

  const fading = stage === "leaving" ? "pointer-events-none opacity-0" : "opacity-100";

  return (
    <section
      id="waitlist"
      aria-label="Tensor waitlist chat"
      className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden px-5 pb-4 pt-2 md:px-8"
    >
      {/* header */}
      <div className={`flex items-center justify-between transition-opacity duration-500 ${fading}`}>
        <button
          type="button"
          onClick={onClose}
          className="px-0 py-1 text-sm text-white/40 transition-colors hover:text-white"
        >
          ← Back
        </button>
        {messages.length > 0 && submitState !== "done" ? (
          <button
            type="button"
            onClick={resetChat}
            className="px-0 py-1 text-sm text-white/40 transition-colors hover:text-white"
          >
            Start over
          </button>
        ) : null}
      </div>

      {/* thread */}
      <div ref={scrollRef} className={`scrollbar-hide mt-6 min-h-0 flex-1 overflow-y-auto pb-4 transition-opacity duration-500 ${fading}`} aria-live="polite">
        <div className="flex flex-col">
          {!booted || (messages.length === 0 && thinking) ? (
            <p className="w-fit bg-[linear-gradient(100deg,rgba(255,255,255,0.35)_30%,#fff_48%,rgba(255,255,255,0.35)_66%)] bg-[length:240%_100%] bg-clip-text text-sm text-transparent" style={{ animation: "agent-thinking-shimmer 2.4s linear infinite" }}>
              Connecting to Tensor…
            </p>
          ) : null}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <p
                key={i}
                className="ml-auto mt-4 w-fit max-w-[80%] rounded-[1.15rem] rounded-br-[0.4rem] border border-white bg-white px-3.5 py-1.5 text-[13px] font-normal leading-[1.45] tracking-[-0.012em] text-black"
              >
                {m.content}
              </p>
            ) : (
              <div key={i} className="mt-4 max-w-[90%]">
                <p className="text-[13px] leading-relaxed text-white/80">{m.content}</p>
              </div>
            ),
          )}
          {thinking ? (
            <p className="mt-4 w-fit bg-[linear-gradient(100deg,rgba(255,255,255,0.35)_30%,#fff_48%,rgba(255,255,255,0.35)_66%)] bg-[length:240%_100%] bg-clip-text text-[13px] text-transparent" style={{ animation: "agent-thinking-shimmer 2.4s linear infinite" }}>
              Thinking.
            </p>
          ) : null}
          {submitState === "submitting" ? (
            <div className="mt-4 flex items-center gap-2 text-[13px] text-white/60">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/20 border-t-white/80" aria-hidden="true" />
              Saving your spot…
            </div>
          ) : null}
          {submitState === "error" ? (
            <div className="mt-4">
              <p className="text-[13px] leading-relaxed text-white/80">
                Couldn&apos;t save that just now{submitError ? ` (${submitError})` : ""} — hit resend and I&apos;ll retry.
              </p>
              <button
                type="button"
                onClick={() => void submitWaitlist(collected)}
                className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-white/85"
              >
                Resend
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* chips */}
      {!showSuccess && chips && !thinking ? (
        <div className={`mt-2 shrink-0 flex flex-wrap gap-2 transition-opacity duration-500 ${fading}`} role="group" aria-label="Quick answers">
          {chips.map((opt) => {
            const active = isMulti && multiSel.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (isMulti) {
                    if (opt === "None") {
                      setMultiSel(["None"]);
                      return;
                    }
                    setMultiSel((prev) => {
                      const withoutNone = prev.filter((p) => p !== "None");
                      return withoutNone.includes(opt)
                        ? withoutNone.filter((p) => p !== opt)
                        : [...withoutNone, opt];
                    });
                  } else {
                    sendChips([opt]);
                  }
                }}
                className={`rounded-full border px-3.5 py-2 text-xs transition-all ${
                  active
                    ? "border-white bg-white text-black"
                    : "border-white/15 bg-white/[0.04] text-white/75 hover:border-white/30 hover:bg-white/10 hover:text-white"
                }`}
              >
                {opt}
              </button>
            );
          })}
          {isMulti ? (
            <button
              type="button"
              disabled={multiSel.length === 0}
              onClick={() => sendChips(multiSel)}
              className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:bg-white/85 disabled:opacity-30"
            >
              Continue →
            </button>
          ) : null}
          {currentField === "anythingElse" ? (
            <button
              type="button"
              onClick={() => sendText("skip")}
              className="rounded-full border border-white/15 px-3.5 py-2 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              Skip
            </button>
          ) : null}
        </div>
      ) : null}

      {/* composer */}
      {!showSuccess ? (
        <form
          className={`mx-auto mt-3 w-full shrink-0 transition-opacity duration-500 ${fading}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (isMulti && multiSel.length > 0 && !input.trim()) {
              sendChips(multiSel);
              return;
            }
            sendText(input);
          }}
        >
          <div className="flex min-h-[3.25rem] w-full items-center gap-2 rounded-full border border-white/10 bg-[#1c1c1e] py-1.5 pl-5 pr-1.5 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.025)]">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholders(currentField)}
              aria-label="Reply to Tensor"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[0.85rem] font-normal leading-[1.55] tracking-[-0.012em] text-white placeholder:text-white/30 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send reply"
              disabled={thinking || (!input.trim() && !(isMulti && multiSel.length))}
              className="grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-full bg-[#f0f0f2] text-[#1c1c1e] transition-transform hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="14" height="14" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 11 7-7 7 7M12 4v16" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-white/30">
            Powered by Cencori · your answers shape early access
          </p>
        </form>
      ) : null}
    </section>
  );
}
