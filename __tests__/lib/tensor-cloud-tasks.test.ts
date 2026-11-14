import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseAdmin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/tensor-data", async (original) => ({
  ...(await original<typeof import("@/lib/tensor-data")>()),
  authenticateTensorDataRequest: vi.fn(async () => null),
}));

import { createAdminClient } from "@/lib/supabaseAdmin";
import { authenticateTensorDataRequest } from "@/lib/tensor-data";
import { signGatewayTicket, signTaskToken } from "@/lib/tensor-cloud";
import {
  authenticateTensorCloudTask,
  authenticateTensorInferenceRequest,
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
