import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tensor-cloud-connect", () => ({ connectSandbox: vi.fn() }));
vi.mock("@/lib/tensor-cloud-tasks", () => ({ noteTurnEnded: vi.fn() }));
vi.mock("@/lib/tensor-turn-reservation", () => ({ finishTensorTurn: vi.fn(), reserveTensorTurn: vi.fn() }));

import { driveBackgroundTurn, type BackgroundTurnDeps } from "@/lib/tensor-background-turn";
import type { RuntimeClient, RuntimeNotification } from "@/lib/tensor-runtime-client";

type Handler = (params: Record<string, unknown>, runtime: FakeRuntime) => unknown;

/** A project's runtime as the driver sees it: answers per method, and notifications on demand. */
class FakeRuntime {
  calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  listeners = new Set<(notification: RuntimeNotification) => void>();
  ready = Promise.resolve();
  closed: Promise<void>;
  #close!: () => void;

  constructor(private handlers: Record<string, Handler>) {
    this.closed = new Promise((resolve) => (this.#close = resolve));
  }

  request(method: string, params: Record<string, unknown>) {
    this.calls.push({ method, params });
    const handler = this.handlers[method];
    if (!handler) return Promise.reject(new Error(`no ${method}`));
    try {
      return Promise.resolve(handler(params, this));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  listen(listener: (notification: RuntimeNotification) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  emit(method: string, params: Record<string, unknown>) {
    for (const listener of this.listeners) listener({ method, params });
  }

  drop() {
    this.#close();
  }

  close() {
    this.#close();
  }
}

const THREAD = { thread: { id: "thr_1", turns: [] }, model: "maximo-atlas-1.5" };

function deps(runtimes: FakeRuntime[], overrides: Partial<BackgroundTurnDeps> = {}) {
  const queue = [...runtimes];
  const spies = {
    finish: vi.fn(async () => true),
    reserve: vi.fn(async () => ({ allowed: true })),
    started: vi.fn(async () => undefined),
    turnEnded: vi.fn(async () => undefined),
  };
  const all: BackgroundTurnDeps = {
    connect: vi.fn(async () => ({ ok: true as const, url: "wss://gateway.test/v1/connect?ticket=t" })),
    open: () => queue.shift() as unknown as RuntimeClient,
    reconnectDelayMs: 0,
    ...spies,
    ...overrides,
  };
  return { all, spies };
}

/** A turn that answers and ends a moment after it starts. */
const finishingTurn: Handler = (_params, runtime) => {
  setTimeout(() => {
    runtime.emit("item/completed", { item: { text: "Centred the footer.", type: "agentMessage" }, threadId: "thr_1", turnId: "turn_1" });
    runtime.emit("turn/completed", { threadId: "thr_1", turn: { id: "turn_1", status: "completed" } });
  }, 5);
  return { turn: { id: "turn_1", status: "inProgress" } };
};

describe("Tensor turns with no page open", () => {
  it("starts a conversation, reserves, runs the turn to its end and closes the reservation", async () => {
    const runtime = new FakeRuntime({ "thread/start": () => THREAD, "turn/start": finishingTurn });
    const { all, spies } = deps([runtime]);
    const result = await driveBackgroundTurn({ prompt: "Centre the footer", taskId: "task", userId: "user" }, all);
    expect(result).toEqual({ error: null, reply: "Centred the footer.", status: "completed", threadId: "thr_1", turnId: "turn_1" });
    const start = runtime.calls.find((call) => call.method === "turn/start");
    expect(start?.params).toMatchObject({
      input: [{ text: "Centre the footer", type: "text" }],
      sandboxPolicy: { type: "externalSandbox" },
      threadId: "thr_1",
    });
    expect(spies.reserve).toHaveBeenCalledWith(expect.any(String), "maximo-atlas-1.5");
    const key = (spies.reserve.mock.calls[0] as unknown[])[0];
    expect(spies.finish).toHaveBeenCalledWith(key, "turn_1");
    expect(spies.turnEnded).toHaveBeenCalledOnce();
    expect(spies.started).toHaveBeenCalledWith({ threadId: "thr_1", turnId: "turn_1", turnKey: key });
  });

  it("carries on the project's background conversation, or starts one if it is gone", async () => {
    const kept = new FakeRuntime({ "thread/resume": () => ({ ...THREAD, thread: { id: "thr_1", turns: [] } }), "turn/start": finishingTurn });
    await driveBackgroundTurn({ prompt: "x", taskId: "t", threadId: "thr_1", userId: "u" }, deps([kept]).all);
    expect(kept.calls.map((call) => call.method)).toEqual(["thread/resume", "turn/start"]);

    const gone = new FakeRuntime({
      "thread/resume": () => {
        throw new Error("no such thread");
      },
      "thread/start": () => THREAD,
      "turn/start": finishingTurn,
    });
    const result = await driveBackgroundTurn({ prompt: "x", taskId: "t", threadId: "thr_old", userId: "u" }, deps([gone]).all);
    expect(result.status).toBe("completed");
    expect(gone.calls.map((call) => call.method)).toEqual(["thread/resume", "thread/start", "turn/start"]);
  });

  it("says busy, holding nothing, when the account has a turn running", async () => {
    const runtime = new FakeRuntime({ "thread/start": () => THREAD });
    const { all, spies } = deps([runtime], { reserve: vi.fn(async () => ({ allowed: false, reason: "concurrency_limit" })) });
    const result = await driveBackgroundTurn({ prompt: "x", taskId: "t", userId: "u" }, all);
    expect(result.status).toBe("busy");
    expect(spies.finish).not.toHaveBeenCalled();
    // Asked before the machine is touched: a busy account costs a query, not a woken machine.
    expect(all.connect).not.toHaveBeenCalled();
    expect(runtime.calls).toHaveLength(0);
  });

  it("says busy when another project is mid-turn and this one cannot be woken", async () => {
    const { all, spies } = deps([], {
      connect: vi.fn(async () => ({ code: "running_limit" as const, error: "still working", ok: false as const, status: 409 })),
    });
    expect((await driveBackgroundTurn({ prompt: "x", taskId: "t", userId: "u" }, all)).status).toBe("busy");
    // The reservation it took is let go at once.
    const key = (spies.reserve.mock.calls[0] as unknown[])[0];
    expect(spies.finish).toHaveBeenCalledWith(key, null);
  });

  it("opens the connection again when it drops, and finds the turn that ended meanwhile", async () => {
    const first = new FakeRuntime({
      "thread/start": () => THREAD,
      "turn/start": (_params, runtime) => {
        setTimeout(() => runtime.drop(), 5);
        return { turn: { id: "turn_1", status: "inProgress" } };
      },
    });
    const second = new FakeRuntime({
      "thread/resume": () => ({
        thread: {
          id: "thr_1",
          turns: [{ id: "turn_1", items: [{ text: "Done while you were away.", type: "agentMessage" }], status: "completed" }],
        },
      }),
    });
    const { all, spies } = deps([first, second]);
    const result = await driveBackgroundTurn({ prompt: "x", taskId: "t", userId: "u" }, all);
    expect(result).toMatchObject({ reply: "Done while you were away.", status: "completed", turnId: "turn_1" });
    expect(all.connect).toHaveBeenCalledTimes(2);
    expect(spies.finish).toHaveBeenCalledOnce();
  });

  it("interrupts a turn that runs too long, and still closes the reservation", async () => {
    const runtime = new FakeRuntime({
      "thread/start": () => THREAD,
      "turn/interrupt": (_params, rt) => {
        rt.emit("turn/completed", { threadId: "thr_1", turn: { id: "turn_1", status: "interrupted" } });
        return {};
      },
      "turn/start": () => ({ turn: { id: "turn_1", status: "inProgress" } }),
    });
    const { all, spies } = deps([runtime], { turnTimeoutMs: 20 });
    const result = await driveBackgroundTurn({ prompt: "x", taskId: "t", userId: "u" }, all);
    expect(result.status).toBe("interrupted");
    expect(runtime.calls.some((call) => call.method === "turn/interrupt")).toBe(true);
    expect(spies.finish).toHaveBeenCalledOnce();
  }, 15_000);

  it("follows a turn another server started to its end, and closes that turn's reservation", async () => {
    const runtime = new FakeRuntime({
      "thread/resume": (_params, rt) => {
        setTimeout(() => {
          rt.emit("item/completed", { item: { text: "Footer centred.", type: "agentMessage" }, threadId: "thr_1", turnId: "turn_9" });
          rt.emit("turn/completed", { threadId: "thr_1", turn: { id: "turn_9", status: "completed" } });
        }, 5);
        return { thread: { id: "thr_1", turns: [{ id: "turn_9", status: "inProgress" }] } };
      },
    });
    const { all, spies } = deps([runtime]);
    const resume = { startedAt: Date.now(), threadId: "thr_1", turnId: "turn_9", turnKey: "key-from-before" };
    const result = await driveBackgroundTurn({ prompt: "x", resume, taskId: "t", userId: "u" }, all);
    expect(result).toMatchObject({ reply: "Footer centred.", status: "completed", turnId: "turn_9" });
    expect(spies.reserve).not.toHaveBeenCalled();
    expect(runtime.calls.some((call) => call.method === "turn/start")).toBe(false);
    expect(spies.finish).toHaveBeenCalledWith("key-from-before", "turn_9");
  });

  it("closes the reservation at once when the turn it picks up has already ended", async () => {
    const runtime = new FakeRuntime({
      "thread/resume": () => ({
        thread: { id: "thr_1", turns: [{ id: "turn_9", items: [{ text: "All done.", type: "agentMessage" }], status: "completed" }] },
      }),
    });
    const { all, spies } = deps([runtime]);
    const result = await driveBackgroundTurn(
      { prompt: "x", resume: { startedAt: Date.now(), threadId: "thr_1", turnId: "turn_9", turnKey: "k" }, taskId: "t", userId: "u" },
      all,
    );
    expect(result).toMatchObject({ reply: "All done.", status: "completed" });
    expect(spies.finish).toHaveBeenCalledWith("k", "turn_9");
    expect(spies.turnEnded).toHaveBeenCalledOnce();
  });
});
