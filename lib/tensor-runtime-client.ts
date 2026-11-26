import "server-only";

/**
 * Cencori's own side of a conversation with a project's runtime, for turns it runs with no page
 * open (lib/tensor-background-turn.ts). The same protocol the web page speaks
 * (tensor-by-cencori app/lib/tensor/runtime.ts): JSON-RPC without the "jsonrpc" field, one
 * message per WebSocket text frame, through the gateway, which checks the ticket in the address
 * and the Origin header. A browser sends Origin by itself; here it is set to the site's own.
 */

export type RuntimeNotification = { method: string; params: Record<string, unknown> };

export class RuntimeClientError extends Error {}

/** What a WebSocket constructor must offer: Node's own (22 and up) does, headers included. */
export type SocketFactory = (url: string, origin: string) => WebSocket;

const nodeSocket: SocketFactory = (url, origin) =>
  // Node's WebSocket (undici) takes headers beside the protocols; the DOM's type does not say so.
  new WebSocket(url, { headers: { origin } } as unknown as string[]);

export class RuntimeClient {
  readonly #socket: WebSocket;
  readonly #pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  readonly #listeners = new Set<(notification: RuntimeNotification) => void>();
  #nextId = 1;
  #closed = false;
  /** Resolves once the runtime has accepted this client. */
  readonly ready: Promise<void>;
  /** Settles when the connection closes, for whatever reason. */
  readonly closed: Promise<void>;

  constructor(url: string, origin: string, socket: SocketFactory = nodeSocket) {
    this.#socket = socket(url, origin);
    let markClosed!: () => void;
    this.closed = new Promise<void>((resolve) => (markClosed = resolve));

    this.ready = new Promise<void>((resolve, reject) => {
      this.#socket.addEventListener("open", () => {
        this.request("initialize", {
          clientInfo: { name: "tensor-cencori", title: "Tensor (Cencori)", version: "1" },
          capabilities: { experimentalApi: true, requestAttestation: false },
        })
          .then(() => {
            this.#send({ method: "initialized" });
            resolve();
          })
          .catch(reject);
      });
      // Before it opens, a close is a refusal (a spent ticket, a sandbox that is not up).
      this.#socket.addEventListener("close", () => reject(new RuntimeClientError("The connection could not be opened.")));
    });
    // Nobody may be waiting on `ready` when it fails; that is not an unhandled rejection.
    this.ready.catch(() => undefined);

    this.#socket.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }
      const hasId = typeof message.id === "number" || typeof message.id === "string";
      if (hasId && typeof message.method !== "string") {
        const waiter = this.#pending.get(message.id as number);
        this.#pending.delete(message.id as number);
        if (!waiter) return;
        const error = message.error as { message?: string } | undefined;
        if (error) waiter.reject(new RuntimeClientError(error.message || "The request failed."));
        else waiter.resolve(message.result);
        return;
      }
      // A question from the runtime (an approval). These turns run without approvals, so none is
      // expected; one that arrives is refused rather than left to hang the turn.
      if (hasId) {
        this.#send({ id: message.id, error: { code: -32601, message: "This client does not answer requests." } });
        return;
      }
      if (typeof message.method === "string") {
        const notification = { method: message.method, params: (message.params ?? {}) as Record<string, unknown> };
        for (const listener of this.#listeners) listener(notification);
      }
    });

    this.#socket.addEventListener("close", () => {
      this.#closed = true;
      for (const waiter of this.#pending.values()) waiter.reject(new RuntimeClientError("The connection closed."));
      this.#pending.clear();
      markClosed();
    });
    // An error is always followed by a close, which is where it is dealt with.
    this.#socket.addEventListener("error", () => undefined);
  }

  #send(message: unknown): void {
    if (this.#socket.readyState === WebSocket.OPEN) this.#socket.send(JSON.stringify(message));
  }

  request<T = unknown>(method: string, params: unknown, timeoutMs = 60_000): Promise<T> {
    if (this.#closed || this.#socket.readyState > WebSocket.OPEN) {
      return Promise.reject(new RuntimeClientError("The connection closed."));
    }
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new RuntimeClientError(`The runtime did not answer ${method} in time.`));
      }, timeoutMs);
      this.#pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Hears every notification from now on; answers with what stops it. */
  listen(listener: (notification: RuntimeNotification) => void): () => void {
    this.#listeners.add(listener);
    return () => void this.#listeners.delete(listener);
  }

  close(): void {
    this.#closed = true;
    this.#socket.close();
  }
}
