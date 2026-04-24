"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import { FormEvent, useId, useState } from "react";

import { cn } from "@/lib/utils";

type SubmissionState = "idle" | "success" | "error";

interface NewsletterSignupFormProps {
  source?: string;
  className?: string;
}

export function NewsletterSignupForm({
  source = "newsletter-page",
  className,
}: NewsletterSignupFormProps) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmissionState("idle");
    setMessage(null);

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source,
          website,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        alreadySubscribed?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Could not subscribe right now.");
      }

      setSubmissionState("success");
      setMessage(
        data.alreadySubscribed
          ? "You're already on the list."
          : "You're in. Watch for the welcome email."
      );
      setEmail("");
      setWebsite("");
    } catch (error) {
      setSubmissionState("error");
      setMessage(
        error instanceof Error ? error.message : "Could not subscribe right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)}>
      <input
        type="text"
        name="website"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0 pointer-events-none"
      />

      <label htmlFor={emailId} className="sr-only">
        Email address
      </label>

      <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 p-1.5 backdrop-blur-sm">
        <input
          id={emailId}
          type="email"
          placeholder="Type your email..."
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          disabled={isSubmitting}
          className="h-10 min-w-0 flex-1 appearance-none rounded-full border-0 bg-transparent px-3.5 text-sm text-foreground shadow-none outline-none transition placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-60 focus:bg-transparent focus:shadow-none sm:h-11 sm:px-4 [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_transparent_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--foreground)] [&:-webkit-autofill]:[caret-color:var(--foreground)]"
        />

        <button
          type="submit"
          disabled={isSubmitting || !email.trim()}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 focus:outline-none focus:ring-4 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:px-5"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending
            </>
          ) : (
            <>
              Subscribe
            </>
          )}
        </button>
      </div>

      {message ? (
        <p
          aria-live="polite"
          className={cn(
            "mt-3 flex items-center justify-center gap-2 text-sm",
            submissionState === "success"
              ? "text-foreground"
              : "text-destructive"
          )}
        >
          {submissionState === "success" ? <Check className="h-4 w-4" /> : null}
          <span>{message}</span>
        </p>
      ) : null}
    </form>
  );
}
