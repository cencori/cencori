import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseAdmin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/tensor-billing", () => ({
  effectiveTensorPlan: vi.fn(() => "pro"),
  getOrCreateTensorBillingAccount: vi.fn(async () => ({ id: "account-1" })),
}));
vi.mock("@/lib/tensor-data", async (original) => ({
  ...(await original<typeof import("@/lib/tensor-data")>()),
  authenticateTensorDataRequest: vi.fn(async () => null),
}));

import { createAdminClient } from "@/lib/supabaseAdmin";
import { authenticateTensorDataRequest } from "@/lib/tensor-data";
import { readTensorCloudConfig, signGatewayTicket, signTaskToken, type TensorCloudConfig } from "@/lib/tensor-cloud";
import {
  authenticateTensorCloudTask,
  authenticateTensorInferenceRequest,
  chatJson,
  claimSpare,
  ensureSpare,
  isThreadId,
  listChats,
  makeRoomFor,
  projectJson,
  projectsAmong,
  setChatThread,
  type TensorCloudChat,
  reconcileTasks,
  taskJson,
  type TensorCloudTask,
} from "@/lib/tensor-cloud-tasks";

const taskId = "0195c0de-0000-7000-8000-000000000001";
const secrets = {
  TENSOR_CLOUD_FLY_API_TOKEN: "fly-token",
  TENSOR_CLOUD_SANDBOX_IMAGE: "registry.fly.io/tensor-sandbox:test",
  TENSOR_CLOUD_GATEWAY_URL: "wss://tensor-gateway.fly.dev",
  TENSOR_CLOUD_TICKET_SECRET: "ticket-secret-ticket-secret-ticket-secret",
  TENSOR_CLOUD_SANDBOX_TOKEN_SECRET: "sandbox-secret-sandbox-secret-sandbox-secret",
  TENSOR_CLOUD_TASK_TOKEN_SECRET: "task-secret-task-secret-task-secret-task",
};

/** An admin client whose one table holds the given row. */
function adminWith(row: { user_id: string; status: string } | null) {
  const lookups: string[] = [];
  const admin = {
    from: () => ({
      select: () => ({
        eq: (_column: string, value: string) => {
          lookups.push(value);
          return { maybeSingle: async () => ({ data: row, error: null }) };
        },
      }),
    }),
  };
  return { admin: admin as never, lookups };
}

const bearer = (userId = "user-1") =>
  `Bearer ${signTaskToken({ userId, taskId }, secrets.TENSOR_CLOUD_TASK_TOKEN_SECRET)}`;

beforeEach(() => {
  vi.unstubAllEnvs();
  for (const [name, value] of Object.entries(secrets)) vi.stubEnv(name, value);
  vi.mocked(authenticateTensorDataRequest).mockClear();
});

describe("authenticateTensorCloudTask", () => {
  it("accepts the token of a task that is ready and owned by the account it names", async () => {
    const { admin, lookups } = adminWith({ user_id: "user-1", status: "ready" });
    expect(await authenticateTensorCloudTask(admin, bearer())).toEqual({ userId: "user-1", taskId });
    expect(lookups).toEqual([taskId]);
  });

  it.each(["stopped", "deleted", "failed", "creating"])(
    "refuses the token once its task is %s",
    async (status) => {
      const { admin } = adminWith({ user_id: "user-1", status });
      expect(await authenticateTensorCloudTask(admin, bearer())).toBeNull();
    },
  );

  it("refuses a token whose task belongs to another account", async () => {
    const { admin } = adminWith({ user_id: "user-2", status: "ready" });
    expect(await authenticateTensorCloudTask(admin, bearer())).toBeNull();
  });

  it("refuses a token whose task no longer exists", async () => {
    const { admin } = adminWith(null);
    expect(await authenticateTensorCloudTask(admin, bearer())).toBeNull();
  });

  it("refuses a forged token without asking the database", async () => {
    const { admin, lookups } = adminWith({ user_id: "user-1", status: "ready" });
    const forged = `Bearer ${signTaskToken({ userId: "user-1", taskId }, "another-secret-another-secret-another")}`;
    expect(await authenticateTensorCloudTask(admin, forged)).toBeNull();
    expect(lookups).toEqual([]);
  });

  it("refuses a gateway ticket presented as a task token", async () => {
    const { admin } = adminWith({ user_id: "user-1", status: "ready" });
    const ticket = signGatewayTicket(
      { userId: "user-1", taskId, machineId: "148e21dc03d789" },
      secrets.TENSOR_CLOUD_TICKET_SECRET,
    );
    expect(await authenticateTensorCloudTask(admin, `Bearer tct_${ticket}`)).toBeNull();
  });

  it("refuses every task token when cloud tasks are not configured", async () => {
    const token = bearer();
    vi.stubEnv("TENSOR_CLOUD_TASK_TOKEN_SECRET", "");
    const { admin } = adminWith({ user_id: "user-1", status: "ready" });
    expect(await authenticateTensorCloudTask(admin, token)).toBeNull();
  });

  it("leaves anything that is not a task token to the ordinary session check", async () => {
    const { admin } = adminWith({ user_id: "user-1", status: "ready" });
    expect(await authenticateTensorCloudTask(admin, "Bearer a-session-token")).toBeUndefined();
    expect(await authenticateTensorCloudTask(admin, null)).toBeUndefined();
  });
});

describe("authenticateTensorInferenceRequest", () => {
  it("resolves a task token to its account", async () => {
    const { admin } = adminWith({ user_id: "user-1", status: "ready" });
    vi.mocked(createAdminClient).mockReturnValue(admin);
    const session = await authenticateTensorInferenceRequest(bearer());
    expect(session?.user).toEqual({ id: "user-1" });
    expect(authenticateTensorDataRequest).not.toHaveBeenCalled();
  });

  it("never falls back to the session check for a refused task token", async () => {
    const { admin } = adminWith({ user_id: "user-1", status: "stopped" });
    vi.mocked(createAdminClient).mockReturnValue(admin);
    expect(await authenticateTensorInferenceRequest(bearer())).toBeNull();
    expect(authenticateTensorDataRequest).not.toHaveBeenCalled();
  });

  it("sends a session token to the session check, unchanged", async () => {
    await authenticateTensorInferenceRequest("Bearer a-session-token");
    expect(authenticateTensorDataRequest).toHaveBeenCalledWith("Bearer a-session-token");
  });
});

describe("taskJson", () => {
  it("does not tell the browser which machine a task runs on", () => {
    const task: TensorCloudTask = {
      id: taskId,
      user_id: "user-1",
      title: "Build a landing page",
      project_name: "Bakery site",
      repository_url: "https://github.com/cencori/tensor.git",
      repository_ref: null,
      machine_id: "148e21dc03d789",
      volume_id: "vol_test",
      region: "jnb",
      status: "ready",
      last_connected_at: null,
      created_at: "2026-11-13T00:00:00Z",
      updated_at: "2026-11-13T00:00:00Z",
    };
    expect(JSON.stringify(taskJson(task))).not.toContain("148e21dc03d789");
    expect(taskJson(task)).not.toHaveProperty("user_id");
  });
});

describe("reconcileTasks", () => {
  const base: TensorCloudTask = {
    id: taskId,
    user_id: "user-1",
    title: null,
    project_name: null,
    repository_url: "https://github.com/cencori/tensor.git",
    repository_ref: null,
    machine_id: "148e21dc03d789",
    volume_id: "vol_test",
    region: "jnb",
    status: "ready",
    last_connected_at: null,
    created_at: "2026-11-13T00:00:00Z",
    updated_at: "2026-11-13T00:00:00Z",
  };

  /** An admin client that records the status each update writes. */
  function recordingAdmin() {
    const written: string[] = [];
    const admin = {
      from: () => ({
        update: (patch: { status: string }) => {
          written.push(patch.status);
          return { eq: async () => ({ error: null }) };
        },
      }),
    };
    return { admin: admin as never, written };
  }
  const flyAnswering = (answer: unknown) => ({ get: async () => answer }) as never;

  it("marks a task stopped when its sandbox has stopped itself", async () => {
    const { admin, written } = recordingAdmin();
    const fly = flyAnswering({ ok: true, value: { id: "148e21dc03d789", state: "stopped", region: "jnb" } });
    expect((await reconcileTasks(admin, fly, [base]))[0]?.status).toBe("stopped");
    expect(written).toEqual(["stopped"]);
  });

  it("marks a task failed when its machine no longer exists", async () => {
    const { admin, written } = recordingAdmin();
    const fly = flyAnswering({ ok: false, status: 404, error: "not found" });
    expect((await reconcileTasks(admin, fly, [base]))[0]?.status).toBe("failed");
    expect(written).toEqual(["failed"]);
  });

  it("leaves a running task alone", async () => {
    const { admin, written } = recordingAdmin();
    const fly = flyAnswering({ ok: true, value: { id: "148e21dc03d789", state: "started", region: "jnb" } });
    expect((await reconcileTasks(admin, fly, [base]))[0]?.status).toBe("ready");
    expect(written).toEqual([]);
  });

  it("does not free the running slot when Fly cannot be reached", async () => {
    const { admin, written } = recordingAdmin();
    const fly = flyAnswering({ ok: false, status: 0, error: "network down" });
    expect((await reconcileTasks(admin, fly, [base]))[0]?.status).toBe("ready");
    expect(written).toEqual([]);
  });

  it("does not ask Fly about tasks that are not marked running", async () => {
    const { admin } = recordingAdmin();
    const get = vi.fn();
    await reconcileTasks(admin, { get } as never, [{ ...base, status: "stopped" }]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("makeRoomFor", () => {
  const task = (id: string, status: TensorCloudTask["status"]): TensorCloudTask => ({
    id,
    user_id: "user-1",
    title: null,
    project_name: null,
    repository_url: null,
    repository_ref: null,
    machine_id: `machine-${id}`,
    volume_id: `vol-${id}`,
    region: "jnb",
    status,
    last_connected_at: null,
    created_at: "2026-11-13T00:00:00Z",
    updated_at: "2026-11-13T00:00:00Z",
  });

  /** An admin client: `openTurns` reservations are open, and every status written is recorded. */
  function adminWithTurns(openTurns: number) {
    const written: Array<{ status: string }> = [];
    const reservations = {
      select: () => reservations,
      eq: () => reservations,
      in: () => reservations,
      gt: () => reservations,
      limit: async () => ({ data: Array.from({ length: openTurns }, (_, id) => ({ id })), error: null }),
    };
    const admin = {
      from: (table: string) =>
        table === "basecode_turn_reservations"
          ? reservations
          : {
              update: (patch: { status: string }) => {
                written.push(patch);
                return { eq: async () => ({ error: null }) };
              },
            },
    };
    return { admin: admin as never, written };
  }

  it("has nothing to do when nothing else is running", async () => {
    const { admin, written } = adminWithTurns(1);
    const stop = vi.fn();
    expect(await makeRoomFor(admin, { stop }, "user-1", [task("a", "stopped"), task("b", "ready")], "b")).toBe(true);
    expect(stop).not.toHaveBeenCalled();
    expect(written).toEqual([]);
  });

  it("puts the other conversation's machine to sleep when it is idle", async () => {
    const { admin, written } = adminWithTurns(0);
    const stop = vi.fn(async () => ({ ok: true as const, value: null }));
    expect(await makeRoomFor(admin, { stop }, "user-1", [task("a", "ready"), task("b", "stopped")], "b")).toBe(true);
    expect(stop).toHaveBeenCalledWith("machine-a");
    expect(written).toEqual([expect.objectContaining({ status: "stopped" })]);
  });

  it("stops nothing while a turn is in progress", async () => {
    const { admin, written } = adminWithTurns(1);
    const stop = vi.fn();
    expect(await makeRoomFor(admin, { stop }, "user-1", [task("a", "ready")], null)).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    expect(written).toEqual([]);
  });

  it("frees the slot even when the machine is slow to stop", async () => {
    const { admin, written } = adminWithTurns(0);
    const stop = vi.fn(async () => ({ ok: false as const, status: 500, error: "busy" }));
    expect(await makeRoomFor(admin, { stop }, "user-1", [task("a", "ready")], null)).toBe(true);
    expect(written).toEqual([expect.objectContaining({ status: "stopped" })]);
  });
});

describe("chats", () => {
  const task = (id: string, patch: Partial<TensorCloudTask> = {}): TensorCloudTask => ({
    id,
    user_id: "user-1",
    title: `title of ${id}`,
    project_name: null,
    repository_url: null,
    repository_ref: null,
    machine_id: `machine-${id}`,
    volume_id: `vol-${id}`,
    region: "jnb",
    status: "ready",
    last_connected_at: null,
    created_at: "2026-11-13T00:00:00Z",
    updated_at: "2026-11-13T00:00:00Z",
    ...patch,
  });
  const chat = (id: string, taskId: string, updatedAt: string): TensorCloudChat => ({
    id,
    task_id: taskId,
    user_id: "user-1",
    title: `chat ${id}`,
    thread_id: null,
    created_at: updatedAt,
    updated_at: updatedAt,
  });

  /** An admin client whose chats table holds `rows`; upserts are recorded and echoed back. */
  function adminWithChats(rows: TensorCloudChat[]) {
    const upserted: Array<Record<string, unknown>> = [];
    const asked: { taskIds?: string[] } = {};
    const query = {
      select: () => query,
      eq: () => query,
      in: (_column: string, ids: string[]) => {
        asked.taskIds = ids;
        return query;
      },
      order: () => query,
      limit: async () => ({ data: rows.filter((row) => asked.taskIds?.includes(row.task_id)), error: null }),
      upsert: (row: Record<string, unknown>) => {
        upserted.push(row);
        return { select: () => ({ single: async () => ({ data: { thread_id: null, ...row }, error: null }) }) };
      },
    };
    return { admin: { from: () => query } as never, upserted };
  }

  it("lists chats newest first, each with its task", async () => {
    const { admin, upserted } = adminWithChats([
      chat("c1", "a", "2026-11-13T01:00:00Z"),
      chat("c2", "a", "2026-11-13T03:00:00Z"),
      chat("c3", "b", "2026-11-13T02:00:00Z"),
    ]);
    const listed = await listChats(admin, "user-1", [task("a", { project_name: "Site" }), task("b")]);
    expect(listed.map(({ chat: row, task: owner }) => [row.id, owner.id])).toEqual([
      ["c2", "a"],
      ["c3", "b"],
      ["c1", "a"],
    ]);
    expect(upserted).toEqual([]);
  });

  it("gives a task with no chat its first one, under the task's own id", async () => {
    const { admin, upserted } = adminWithChats([]);
    const listed = await listChats(admin, "user-1", [task("a")]);
    expect(upserted).toEqual([expect.objectContaining({ id: "a", task_id: "a", title: "title of a" })]);
    expect(listed.map(({ chat: row }) => row.id)).toEqual(["a"]);
  });

  it("leaves out the chats of failed tasks, and makes none for them", async () => {
    const { admin, upserted } = adminWithChats([chat("c1", "bad", "2026-11-13T01:00:00Z")]);
    expect(await listChats(admin, "user-1", [task("bad", { status: "failed" })])).toEqual([]);
    expect(upserted).toEqual([]);
  });

  it("shows the site the conversation and its project, never where it runs", () => {
    const shown = chatJson(
      { ...chat("c1", "a", "2026-11-13T01:00:00Z"), thread_id: "0195c0de-0000-7000-8000-00000000000a" },
      task("a", { project_name: "Site" }),
    );
    expect(shown).toMatchObject({ id: "c1", taskId: "a", projectName: "Site", status: "ready" });
    expect(JSON.stringify(shown)).not.toContain("machine-a");
    expect(JSON.stringify(shown)).not.toContain("vol-a");
    expect(shown).not.toHaveProperty("user_id");
  });

  it("records a chat's thread only while it has none", async () => {
    const filters: unknown[][] = [];
    const update = {
      eq: (...args: unknown[]) => {
        filters.push(["eq", ...args]);
        return update;
      },
      is: async (...args: unknown[]) => {
        filters.push(["is", ...args]);
        return { error: null };
      },
    };
    const admin = { from: () => ({ update: () => update }) } as never;
    await setChatThread(admin, "c1", "0195c0de-0000-7000-8000-00000000000a");
    expect(filters).toEqual([
      ["eq", "id", "c1"],
      ["is", "thread_id", null],
    ]);
  });

  it("accepts only a UUID as a thread id", () => {
    expect(isThreadId("0195c0de-0000-7000-8000-00000000000a")).toBe(true);
    expect(isThreadId("../../etc/passwd")).toBe(false);
    expect(isThreadId(42)).toBe(false);
  });
});

describe("spares", () => {
  const config = () => readTensorCloudConfig(secrets) as TensorCloudConfig;
  const spare = (patch: Partial<TensorCloudTask> = {}): TensorCloudTask => ({
    id: taskId,
    user_id: "user-1",
    title: null,
    project_name: null,
    repository_url: null,
    repository_ref: null,
    machine_id: "148e21dc03d789",
    volume_id: "vol_spare",
    image: secrets.TENSOR_CLOUD_SANDBOX_IMAGE,
    region: "jnb",
    status: "spare",
    last_connected_at: null,
    created_at: "2026-11-13T00:00:00Z",
    updated_at: "2026-11-13T00:00:00Z",
    ...patch,
  });

  /** An admin client whose tasks table holds at most one spare, recording what is written. */
  function adminWithSpare(existing: TensorCloudTask | null, insertError: { code: string } | null = null) {
    const writes: Array<{ op: string; row: Record<string, unknown> }> = [];
    const chain = (result: unknown) => {
      const query: Record<string, unknown> = {};
      for (const name of ["select", "eq", "not", "neq", "in"]) query[name] = () => query;
      query.maybeSingle = async () => result;
      query.single = async () => result;
      query.then = (resolve: (value: unknown) => void) => resolve({ error: null });
      return query;
    };
    const admin = {
      from: () => ({
        select: () => chain({ data: existing, error: null }),
        insert: (row: Record<string, unknown>) => {
          writes.push({ op: "insert", row });
          return chain({ data: insertError ? null : spare({ machine_id: null, volume_id: null, ...row }), error: insertError });
        },
        update: (row: Record<string, unknown>) => {
          writes.push({ op: "update", row });
          return chain({ data: existing ? { ...existing, ...row } : null, error: null });
        },
        delete: () => chain({ error: null }),
      }),
    };
    return { admin: admin as never, writes };
  }
  const flyOk = () => ({
    createVolume: vi.fn(async () => ({ ok: true as const, value: { id: "vol_new", region: "jnb" } })),
    create: vi.fn(async () => ({ ok: true as const, value: { id: "machine-new", state: "created", region: "jnb" } })),
    destroy: vi.fn(async () => ({ ok: true as const, value: null })),
    destroyVolume: vi.fn(async () => ({ ok: true as const, value: null })),
  });

  it("makes a spare that is created but not started", async () => {
    const { admin, writes } = adminWithSpare(null);
    const fly = flyOk();
    await ensureSpare(admin, fly, config(), "user-1");
    expect(writes[0]).toEqual({
      op: "insert",
      row: { user_id: "user-1", status: "spare", image: secrets.TENSOR_CLOUD_SANDBOX_IMAGE },
    });
    expect(fly.create).toHaveBeenCalledWith(expect.objectContaining({ skip_launch: true }));
    expect(writes.at(-1)).toEqual({ op: "update", row: expect.objectContaining({ machine_id: "machine-new" }) });
  });

  it("leaves a good spare alone", async () => {
    const { admin, writes } = adminWithSpare(spare());
    const fly = flyOk();
    await ensureSpare(admin, fly, config(), "user-1");
    expect(writes).toEqual([]);
    expect(fly.create).not.toHaveBeenCalled();
  });

  it("replaces a spare made from an image that is no longer current", async () => {
    const { admin, writes } = adminWithSpare(spare({ image: "registry.fly.io/tensor-sandbox:old" }));
    const fly = flyOk();
    await ensureSpare(admin, fly, config(), "user-1");
    expect(fly.destroy).toHaveBeenCalledWith("148e21dc03d789");
    expect(fly.destroyVolume).toHaveBeenCalledWith("vol_spare");
    expect(writes.some((write) => write.op === "insert")).toBe(true);
  });

  it("does not make a second spare when another request is already making one", async () => {
    const { admin } = adminWithSpare(null, { code: "23505" });
    const fly = flyOk();
    await ensureSpare(admin, fly, config(), "user-1");
    expect(fly.createVolume).not.toHaveBeenCalled();
  });

  it("removes the row and the volume when the machine cannot be created", async () => {
    const { admin, writes } = adminWithSpare(null);
    const fly = { ...flyOk(), create: vi.fn(async () => ({ ok: false as const, status: 422, error: "no capacity" })) };
    await ensureSpare(admin, fly, config(), "user-1");
    expect(writes).toContainEqual({ op: "update", row: expect.objectContaining({ status: "deleted" }) });
    expect(fly.destroyVolume).toHaveBeenCalledWith("vol_new");
  });

  it("turns the spare into the chat's workspace when one is claimed", async () => {
    const { admin, writes } = adminWithSpare(spare());
    const claimed = await claimSpare(admin, config(), { userId: "user-1", title: "hello", projectName: "Site" });
    expect(claimed).toMatchObject({ id: taskId, status: "ready", title: "hello", project_name: "Site" });
    expect(writes).toEqual([{ op: "update", row: expect.objectContaining({ status: "ready" }) }]);
  });

  it("claims nothing when there is no spare", async () => {
    const { admin } = adminWithSpare(null);
    expect(await claimSpare(admin, config(), { userId: "user-1", title: null, projectName: null })).toBeNull();
  });
});

describe("projects", () => {
  const task = (id: string, patch: Partial<TensorCloudTask>): TensorCloudTask => ({
    id,
    user_id: "user-1",
    title: null,
    project_name: null,
    repository_url: null,
    repository_ref: null,
    machine_id: `machine-${id}`,
    volume_id: `vol-${id}`,
    region: "jnb",
    status: "ready",
    last_connected_at: null,
    created_at: "2026-11-13T00:00:00Z",
    updated_at: "2026-11-13T00:00:00Z",
    ...patch,
  });

  it("are the named workspaces a person can see, whether or not they have chats", () => {
    const listed = projectsAmong([
      task("a", { project_name: "Bakery website" }),
      task("b", { project_name: "Broken", status: "failed" }),
      task("c", { project_name: null }),
      task("d", { project_name: null, status: "spare" }),
      task("e", { project_name: "Asleep", status: "stopped" }),
    ]);
    expect(listed.map((item) => item.id)).toEqual(["a", "e"]);
  });

  it("are shown by name, never by where they run", () => {
    const shown = projectJson(task("a", { project_name: "Bakery website" }));
    expect(shown).toMatchObject({ id: "a", name: "Bakery website", status: "ready" });
    expect(JSON.stringify(shown)).not.toContain("machine-a");
    expect(JSON.stringify(shown)).not.toContain("vol-a");
  });
});
