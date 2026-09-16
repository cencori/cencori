"use client";

import { useEffect, useState } from "react";
import { Copy, RotateCcw, Volume2 } from "lucide-react";
import styles from "./DevelopersProducts.module.css";

function AssistantActions() {
  return (
    <div className="flex items-center gap-4 text-white/40">
      <Copy className="size-3.5" strokeWidth={1.8} />
      <Volume2 className="size-3.5" strokeWidth={1.8} />
      <RotateCcw className="size-3.5" strokeWidth={1.8} />
    </div>
  );
}

function Thinking() {
  return (
    <p className={`${styles.msgEnter} ${styles.thinking} text-left text-sm`}>
      Thinking
    </p>
  );
}

function StreamingText({ text }: { text: string }) {
  const words = text.split(" ");
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (count >= words.length) return;
    const timer = setTimeout(() => setCount((c) => c + 1), 90);
    return () => clearTimeout(timer);
  }, [count, words.length]);

  return (
    <p className="text-left text-sm text-white/90">
      {words.slice(0, count).join(" ")}
    </p>
  );
}

export function ArcieChatSim() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(8);
      return;
    }
    const plan: Array<[number, number]> = [
      [1, 700],
      [2, 2200],
      [3, 2400],
      [4, 2200],
      [5, 2400],
      [6, 2200],
      [7, 2400],
      [8, 2200],
      [0, 5000],
    ];
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let i = 0;
    const advance = () => {
      if (cancelled) return;
      const [next, delay] = plan[i % plan.length];
      timer = setTimeout(() => {
        setStep(next);
        i += 1;
        advance();
      }, delay);
    };
    advance();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="flex h-full flex-col justify-end gap-4">
      {step >= 1 ? (
        <div className="flex justify-end">
          <span
            className={`${styles.msgEnter} rounded-[18px] rounded-br-md bg-white px-4 py-2 text-sm font-medium text-black`}
          >
            Hello.
          </span>
        </div>
      ) : null}
      {step === 1 ? <Thinking /> : null}
      {step >= 2 ? (
        <div className={styles.msgEnter}>
          <StreamingText text="Hello! How can I assist you today?" />
        </div>
      ) : null}
      {step >= 2 ? <AssistantActions /> : null}
      {step >= 3 ? (
        <div className="flex justify-end">
          <span
            className={`${styles.msgEnter} rounded-[18px] rounded-br-md bg-white px-4 py-2 text-sm font-medium text-black`}
          >
            Who are you?
          </span>
        </div>
      ) : null}
      {step === 3 ? <Thinking /> : null}
      {step >= 4 ? (
        <div className={styles.msgEnter}>
          <StreamingText text="I'm an intelligent agent built with Arcie and running on the Cencori Cloud." />
        </div>
      ) : null}
      {step >= 4 ? <AssistantActions /> : null}
      {step >= 5 ? (
        <div className="flex justify-end">
          <span
            className={`${styles.msgEnter} rounded-[18px] rounded-br-md bg-white px-4 py-2 text-sm font-medium text-black`}
          >
            What is the Cencori Cloud?
          </span>
        </div>
      ) : null}
      {step === 5 ? <Thinking /> : null}
      {step >= 6 ? (
        <div className={styles.msgEnter}>
          <StreamingText text="It's the Cencori's cloud-based foundation that powers AI workloads across enterprises and industries." />
        </div>
      ) : null}
      {step >= 6 ? <AssistantActions /> : null}
      {step >= 7 ? (
        <div className="flex justify-end">
          <span
            className={`${styles.msgEnter} rounded-[18px] rounded-br-md bg-white px-4 py-2 text-sm font-medium text-black`}
          >
            Oh, thank you.
          </span>
        </div>
      ) : null}
      {step === 7 ? <Thinking /> : null}
      {step >= 8 ? (
        <div className={styles.msgEnter}>
          <StreamingText text="Happy to help if you have more questions." />
        </div>
      ) : null}
      {step >= 8 ? <AssistantActions /> : null}
    </div>
  );
}
