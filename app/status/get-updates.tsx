"use client";

import Megaphone02Icon from '@hugeicons/core-free-icons/Megaphone02Icon';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { HOSTED_STATUS_PAGE_URL, OUTRAY_SUBSCRIBE_URL } from '@/lib/outray-status';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: 'Enter a valid email address.',
};

type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

// "Get updates": subscribes an email to incident updates through OutRay's
// headless API. OutRay sends the emails.
export function GetUpdates({ buttonClassName }: { buttonClassName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>({ kind: 'idle' });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ kind: 'submitting' });
    try {
      const response = await fetch(OUTRAY_SUBSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (response.ok) {
        setState({ kind: 'done' });
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setState({
        kind: 'error',
        message: (body?.error && ERROR_MESSAGES[body.error]) || 'We couldn’t subscribe you. Please try again.',
      });
    } catch {
      setState({ kind: 'error', message: 'We couldn’t reach the status service. Please try again.' });
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName}
      >
        Get updates
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute right-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-md bg-zinc-900 p-4 text-white shadow-lg"
        >
          {state.kind === 'done' ? (
            <p role="status" className="text-sm">
              You’re subscribed. We’ll email you when an incident is posted.
            </p>
          ) : (
            <form onSubmit={submit} noValidate>
              <label htmlFor={`${panelId}-email`} className="block text-sm font-medium">
                Get incident updates by email
              </label>
              <div className="mt-6 flex flex-col gap-2">
                <input
                  ref={inputRef}
                  id={`${panelId}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  aria-invalid={state.kind === 'error'}
                  aria-describedby={state.kind === 'error' ? `${panelId}-error` : undefined}
                  className="w-full rounded-md bg-black/40 px-3 py-1.5 text-xs text-white outline-none ring-1 ring-white/15 placeholder:text-white/40"
                />
                <p className="flex items-center gap-2.5 rounded-md bg-white/5 px-3 py-2.5 text-xs text-white/70">
                  <HugeiconsIcon icon={Megaphone02Icon} aria-hidden="true" className="size-4 shrink-0 text-white/50" />
                  You’ll receive emails for new incidents.
                </p>
                <button
                  type="submit"
                  disabled={state.kind === 'submitting' || !email.trim()}
                  className={`${buttonClassName} self-end disabled:opacity-50`}
                >
                  {state.kind === 'submitting' ? 'Subscribing…' : 'Subscribe'}
                </button>
              </div>
              {state.kind === 'error' ? (
                <p id={`${panelId}-error`} role="alert" className="mt-2 text-xs text-red-400">
                  {state.message}{' '}
                  <a href={HOSTED_STATUS_PAGE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    Subscribe on our status page
                  </a>
                </p>
              ) : null}
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
