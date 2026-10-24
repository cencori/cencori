import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MaintenanceBanner } from "./MaintenanceBanner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() { return items.size; },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

async function renderWith(body: unknown) {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <QueryClientProvider client={client}>
        <MaintenanceBanner />
      </QueryClientProvider>,
    );
  });
  // Let the query resolve and re-render.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  return host;
}

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

describe("MaintenanceBanner", () => {
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.unstubAllGlobals();
  });

  it("shows nothing without a schedule", async () => {
    const el = await renderWith({ enabled: false, scheduled: null });
    expect(el.textContent).toBe("");
  });

  it("announces an upcoming window and stays dismissed for it", async () => {
    const scheduled = { start: inMinutes(60 * 24), end: inMinutes(60 * 24 + 30) };
    const el = await renderWith({ enabled: false, scheduled });
    expect(el.textContent).toContain("Scheduled maintenance:");

    await act(async () => {
      el.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!.click();
    });
    expect(el.textContent).toBe("");
    expect(localStorage.getItem("cencori:maintenance-banner-dismissed")).toBe(`${scheduled.start}|${scheduled.end}`);
  });

  it("says the window is under way once it has started", async () => {
    const el = await renderWith({ enabled: false, scheduled: { start: inMinutes(-5), end: inMinutes(25) } });
    expect(el.textContent).toContain("Maintenance under way:");
  });

  it("reminds bypass holders that maintenance is on", async () => {
    const el = await renderWith({ enabled: true, scheduled: null });
    expect(el.textContent).toContain("Maintenance mode is on.");
  });
});
