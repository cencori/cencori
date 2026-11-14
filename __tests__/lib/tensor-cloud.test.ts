import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  FlyMachines,
  isTaskToken,
  normalizeRepositoryRef,
  normalizeProjectName,
  normalizeRepositoryUrl,
  normalizeTaskTitle,
  readTensorCloudConfig,
  sandboxMachineRequest,
  sandboxTokenSha256,
  signGatewayTicket,
  signTaskToken,
  TASK_TOKEN_TTL_SECONDS,
  tensorCloudAccess,
  verifyTaskToken,
  type TensorCloudConfig,
} from "@/lib/tensor-cloud";

const env = {
  TENSOR_CLOUD_FLY_API_TOKEN: "fly-token",
  TENSOR_CLOUD_SANDBOX_IMAGE: "registry.fly.io/tensor-sandbox:test",
  TENSOR_CLOUD_GATEWAY_URL: "wss://tensor-gateway.fly.dev/",
  TENSOR_CLOUD_TICKET_SECRET: "ticket-secret-ticket-secret-ticket-secret",
  TENSOR_CLOUD_SANDBOX_TOKEN_SECRET: "sandbox-secret-sandbox-secret-sandbox-secret",
  TENSOR_CLOUD_TASK_TOKEN_SECRET: "task-secret-task-secret-task-secret-task",
};
const config = readTensorCloudConfig(env) as TensorCloudConfig;
const taskId = "0195c0de-0000-7000-8000-000000000001";
const now = 1_800_000_000;

function claimsOf(jwt: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(jwt.split(".")[1] as string, "base64url").toString("utf8"));
}

describe("readTensorCloudConfig", () => {
  it("reads a complete configuration", () => {
    expect(config).toMatchObject({
      sandboxApp: "tensor-sandbox",
      sandboxRegion: "jnb",
      gatewayUrl: "wss://tensor-gateway.fly.dev",
    });
  });

  it("is off when anything it needs is missing", () => {
    expect(readTensorCloudConfig({})).toBeNull();
    expect(readTensorCloudConfig({ ...env, TENSOR_CLOUD_FLY_API_TOKEN: "" })).toBeNull();
    expect(readTensorCloudConfig({ ...env, TENSOR_CLOUD_SANDBOX_IMAGE: "" })).toBeNull();
  });

  it("refuses a gateway that is not reached over TLS", () => {
    expect(readTensorCloudConfig({ ...env, TENSOR_CLOUD_GATEWAY_URL: "ws://gateway" })).toBeNull();
  });

  it("refuses short secrets and one secret used twice", () => {
    expect(readTensorCloudConfig({ ...env, TENSOR_CLOUD_TICKET_SECRET: "short" })).toBeNull();
    expect(
      readTensorCloudConfig({
        ...env,
        TENSOR_CLOUD_TASK_TOKEN_SECRET: env.TENSOR_CLOUD_TICKET_SECRET,
      }),
    ).toBeNull();
  });
});

describe("gateway tickets", () => {
  it("names one user, task and machine, for one minute", () => {
    const ticket = signGatewayTicket(
      { userId: "user-1", taskId, machineId: "148e21dc03d789" },
      config.ticketSecret,
      now,
    );
    expect(claimsOf(ticket)).toMatchObject({
      aud: "tensor-cloud-gateway",
      sub: "user-1",
      task: taskId,
      machine: "148e21dc03d789",
      iat: now,
      exp: now + 60,
    });
    expect(claimsOf(ticket).jti).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  });

  it("is signed the way the gateway verifies: HMAC-SHA256 over header.payload", () => {
    const ticket = signGatewayTicket(
      { userId: "user-1", taskId, machineId: "148e21dc03d789" },
      config.ticketSecret,
      now,
    );
    const [header, payload, signature] = ticket.split(".");
    expect(JSON.parse(Buffer.from(header as string, "base64url").toString())).toEqual({
      alg: "HS256",
      typ: "JWT",
    });
    expect(signature).toBe(
      createHmac("sha256", config.ticketSecret).update(`${header}.${payload}`).digest("base64url"),
    );
  });

  it("never issues the same ticket twice", () => {
    const input = { userId: "user-1", taskId, machineId: "148e21dc03d789" };
    expect(signGatewayTicket(input, config.ticketSecret, now)).not.toBe(
      signGatewayTicket(input, config.ticketSecret, now),
    );
  });
});

describe("sandbox tokens", () => {
  it("is the hash of the token the gateway derives for the task", () => {
    const token = createHmac("sha256", config.sandboxTokenSecret)
      .update(`sandbox:${taskId}`)
      .digest("base64url");
    expect(sandboxTokenSha256(config.sandboxTokenSecret, taskId)).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
  });

  it("differs for every task", () => {
    expect(sandboxTokenSha256(config.sandboxTokenSecret, taskId)).not.toBe(
      sandboxTokenSha256(config.sandboxTokenSecret, "0195c0de-0000-7000-8000-000000000002"),
    );
  });
});

describe("task tokens", () => {
  const token = signTaskToken({ userId: "user-1", taskId }, config.taskTokenSecret, now);

  it("round-trips its claims", () => {
    expect(verifyTaskToken(token, config.taskTokenSecret, now)).toEqual({
      userId: "user-1",
      taskId,
      expiresAt: now + TASK_TOKEN_TTL_SECONDS,
    });
  });

  it("outlives a chat that is picked up again weeks later", () => {
    const weeksLater = now + 60 * 24 * 60 * 60;
    expect(verifyTaskToken(token, config.taskTokenSecret, weeksLater)).not.toBeNull();
  });

  it("is refused after it expires", () => {
    expect(verifyTaskToken(token, config.taskTokenSecret, now + TASK_TOKEN_TTL_SECONDS)).toBeNull();
  });

  it("is refused under another secret", () => {
    expect(verifyTaskToken(token, config.ticketSecret, now)).toBeNull();
  });

  it("is refused when its claims are changed", () => {
    const [header, , signature] = token.slice(4).split(".");
    const forged = Buffer.from(
      JSON.stringify({ aud: "tensor-cloud-task", sub: "user-2", task: taskId, exp: now + 60 }),
    ).toString("base64url");
    expect(verifyTaskToken(`tct_${header}.${forged}.${signature}`, config.taskTokenSecret, now)).toBeNull();
  });

  it("does not accept a gateway ticket, even one signed with its own secret", () => {
    const ticket = signGatewayTicket(
      { userId: "user-1", taskId, machineId: "148e21dc03d789" },
      config.taskTokenSecret,
      now,
    );
    expect(verifyTaskToken(`tct_${ticket}`, config.taskTokenSecret, now)).toBeNull();
  });

  it("is not mistaken for a session token that happens to share its prefix", () => {
    expect(isTaskToken(token)).toBe(true);
    expect(isTaskToken("tct_QRjy0aB3cD4eF5gH6iJ7kL8mN9oP")).toBe(false);
    expect(isTaskToken("QRjy0aB3cD4eF5gH6iJ7kL8mN9oPqRsT")).toBe(false);
  });

  it("does not accept a token without the prefix, or an unsigned one", () => {
    expect(verifyTaskToken(token.slice(4), config.taskTokenSecret, now)).toBeNull();
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(
      JSON.stringify({ aud: "tensor-cloud-task", sub: "user-1", task: taskId, exp: now + 60 }),
    ).toString("base64url")}.`;
    expect(verifyTaskToken(`tct_${unsigned}`, config.taskTokenSecret, now)).toBeNull();
  });
});

describe("normalizeRepositoryUrl", () => {
  it("accepts a public GitHub repository and returns one canonical form", () => {
    expect(normalizeRepositoryUrl("https://github.com/cencori/tensor")).toBe(
      "https://github.com/cencori/tensor.git",
    );
    expect(normalizeRepositoryUrl(" https://github.com/cencori/tensor.git/ ")).toBe(
      "https://github.com/cencori/tensor.git",
    );
    expect(normalizeRepositoryUrl("https://github.com/a-b/c.d_e")).toBe(
      "https://github.com/a-b/c.d_e.git",
    );
  });

  it.each([
    "http://github.com/cencori/tensor",
    "https://gitlab.com/cencori/tensor",
    "https://github.com.evil.example/cencori/tensor",
    "https://token@github.com/cencori/tensor",
    "https://user:pass@github.com/cencori/tensor",
    "https://github.com:8443/cencori/tensor",
    "https://github.com/cencori/tensor?x=1",
    "https://github.com/cencori/tensor#x",
    "https://github.com/cencori",
    "https://github.com/cencori/tensor/tree/main",
    "https://github.com/cencori/..",
    "https://github.com/-bad/tensor",
    "git@github.com:cencori/tensor.git",
    "file:///etc/passwd",
    "--upload-pack=touch /tmp/x",
    "",
  ])("refuses %s", (value) => {
    expect(normalizeRepositoryUrl(value)).toBeNull();
  });

  it("refuses values that are not strings", () => {
    expect(normalizeRepositoryUrl(null)).toBeNull();
    expect(normalizeRepositoryUrl({ toString: () => "https://github.com/a/b" })).toBeNull();
  });
});

describe("normalizeRepositoryRef", () => {
  it("accepts ordinary branch and tag names", () => {
    expect(normalizeRepositoryRef("main")).toBe("main");
    expect(normalizeRepositoryRef("feat/ui-improvements")).toBe("feat/ui-improvements");
    expect(normalizeRepositoryRef("v0.4.9")).toBe("v0.4.9");
  });

  it.each(["--upload-pack=x", "-b", "a..b", "a//b", "a/", "main.lock", "a b", "a;b", "", "~1"])(
    "refuses %s",
    (value) => {
      expect(normalizeRepositoryRef(value)).toBeNull();
    },
  );
});

describe("normalizeTaskTitle", () => {
  it("is the message on one line", () => {
    expect(normalizeTaskTitle("  Build me\n a   landing page ")).toBe("Build me a landing page");
  });

  it("is cut to a length that fits a list", () => {
    const title = normalizeTaskTitle("x".repeat(200)) as string;
    expect(title).toHaveLength(80);
    expect(title.endsWith("…")).toBe(true);
  });

  it("is nothing when there is nothing to show", () => {
    expect(normalizeTaskTitle("   ")).toBeNull();
    expect(normalizeTaskTitle(42)).toBeNull();
  });
});

describe("normalizeProjectName", () => {
  it("tidies a name onto one line and caps its length", () => {
    expect(normalizeProjectName("  Bakery\n  site ")).toBe("Bakery site");
    expect(normalizeProjectName("x".repeat(100))).toHaveLength(60);
  });

  it("is nothing for an empty name or a value that is not text", () => {
    expect(normalizeProjectName("  ")).toBeNull();
    expect(normalizeProjectName(null)).toBeNull();
  });
});

describe("sandboxMachineRequest", () => {
  const request = sandboxMachineRequest(
    { taskId, userId: "user-1", volumeId: "vol_test", repositoryUrl: "https://github.com/cencori/tensor.git", repositoryRef: null },
    config,
    now,
  );

  it("gives the sandbox a task credential and only the hash of its own token", () => {
    const { env: machineEnv } = request.config;
    expect(verifyTaskToken(machineEnv.CENCORI_TOKEN, config.taskTokenSecret, now)).toMatchObject({
      userId: "user-1",
      taskId,
    });
    expect(machineEnv.TENSOR_WS_TOKEN_SHA256).toBe(sandboxTokenSha256(config.sandboxTokenSecret, taskId));
    expect(JSON.stringify(request)).not.toContain(config.sandboxTokenSecret);
    expect(JSON.stringify(request)).not.toContain(config.taskTokenSecret);
    expect(JSON.stringify(request)).not.toContain(config.ticketSecret);
    expect(JSON.stringify(request)).not.toContain(config.flyApiToken);
  });

  it("mounts the task's volume where the image keeps the repository and the conversation", () => {
    expect(request.config.mounts).toEqual([{ volume: "vol_test", path: "/data" }]);
  });

  it("starts in an empty workspace when no repository is given", () => {
    const empty = sandboxMachineRequest(
      { taskId, userId: "user-1", volumeId: "vol_test", repositoryUrl: null, repositoryRef: "main" },
      config,
      now,
    );
    expect(empty.config.env).not.toHaveProperty("REPO_URL");
    expect(empty.config.env).not.toHaveProperty("REPO_REF");
    expect(empty.config.env).toHaveProperty("CENCORI_TOKEN");
  });

  it("can be created without being started, as a spare", () => {
    const spare = sandboxMachineRequest(
      { taskId, userId: "user-1", volumeId: "vol_test", repositoryUrl: null, repositoryRef: null, launch: false },
      config,
      now,
    );
    expect(spare).toMatchObject({ skip_launch: true });
    expect(request).not.toHaveProperty("skip_launch");
  });

  it("has no public service and does not restart itself", () => {
    expect(request.config).not.toHaveProperty("services");
    expect(request.config.restart).toEqual({ policy: "no" });
    expect(request.name).toBe(`task-${taskId}`);
    expect(request.config.env).not.toHaveProperty("REPO_REF");
  });
});

describe("FlyMachines", () => {
  it("calls the sandbox app with the API token", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fly = new FlyMachines(config, (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "148e21dc03d789", state: "created", region: "jnb" }));
    }) as typeof fetch);

    const created = await fly.create(
      sandboxMachineRequest(
        { taskId, userId: "user-1", volumeId: "vol_test", repositoryUrl: "https://github.com/cencori/tensor.git", repositoryRef: "main" },
        config,
        now,
      ),
    );
    expect(created).toEqual({ ok: true, value: { id: "148e21dc03d789", state: "created", region: "jnb" } });
    expect(calls[0]?.url).toBe("https://api.machines.dev/v1/apps/tensor-sandbox/machines");
    expect(calls[0]?.init.method).toBe("POST");
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe("Bearer fly-token");

    await fly.destroy("148e21dc03d789");
    expect(calls[1]?.url).toBe(
      "https://api.machines.dev/v1/apps/tensor-sandbox/machines/148e21dc03d789?force=true",
    );
    expect(calls[1]?.init.method).toBe("DELETE");
  });

  it("creates a task's volume in the sandbox region, under a name Fly accepts", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fly = new FlyMachines(config, (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "vol_123", region: "jnb" }));
    }) as typeof fetch);
    expect(await fly.createVolume(taskId)).toEqual({ ok: true, value: { id: "vol_123", region: "jnb" } });
    expect(calls[0]?.url).toBe("https://api.machines.dev/v1/apps/tensor-sandbox/volumes");
    const body = JSON.parse(calls[0]?.init.body as string);
    expect(body).toEqual({ name: "task_0195c0de0000700080000000", region: "jnb", size_gb: 5 });
    expect(body.name).toMatch(/^[a-z0-9_]{1,30}$/);

    await fly.destroyVolume("vol_123");
    expect(calls[1]?.url).toBe("https://api.machines.dev/v1/apps/tensor-sandbox/volumes/vol_123");
    expect(calls[1]?.init.method).toBe("DELETE");
  });

  it("reports a refusal without throwing", async () => {
    const fly = new FlyMachines(config, (async () => new Response("no capacity", { status: 422 })) as typeof fetch);
    expect(await fly.start("148e21dc03d789")).toEqual({ ok: false, status: 422, error: "no capacity" });
  });

  it("reports an unreachable API without throwing", async () => {
    const fly = new FlyMachines(config, (async () => {
      throw new Error("network down");
    }) as typeof fetch);
    expect(await fly.get("148e21dc03d789")).toEqual({ ok: false, status: 0, error: "network down" });
  });
});

describe("tensorCloudAccess", () => {
  it("gives the trial no cloud tasks", () => {
    expect(tensorCloudAccess("free")).toEqual({ tasks: false, privateRepositories: false });
  });

  it("gives every paid plan cloud tasks, and private repositories from Pro", () => {
    expect(tensorCloudAccess("starter")).toEqual({ tasks: true, privateRepositories: false });
    expect(tensorCloudAccess("builder")).toEqual({ tasks: true, privateRepositories: false });
    for (const plan of ["pro", "max", "ultra", "enterprise"]) {
      expect(tensorCloudAccess(plan)).toEqual({ tasks: true, privateRepositories: true });
    }
  });

  it("gives an unknown plan nothing", () => {
    expect(tensorCloudAccess("")).toEqual({ tasks: false, privateRepositories: false });
    expect(tensorCloudAccess("gold")).toEqual({ tasks: false, privateRepositories: false });
  });
});

describe("publishing", () => {
  it("tidies a name into what an address can hold", async () => {
    const { normalizeSiteName } = await import("@/lib/tensor-cloud");
    expect(normalizeSiteName("Bola's Bakery!")).toBe("bola-s-bakery");
    expect(normalizeSiteName("  --Café  Menu--  ")).toBe("cafe-menu");
    expect(normalizeSiteName("a".repeat(60))).toHaveLength(40);
    expect(normalizeSiteName(`${"a".repeat(39)} b`)).toBe("a".repeat(39));
  });

  it("gives out no name that is too short, empty, or kept back", async () => {
    const { normalizeSiteName } = await import("@/lib/tensor-cloud");
    for (const bad of ["", "ab", "!!!", "www", "API", "admin", "cencori", "Tensor", 42, null]) {
      expect(normalizeSiteName(bad)).toBeNull();
    }
  });

  it("signs a ticket for one name and one action, which expires", async () => {
    const { signDeployTicket, DEPLOY_TICKET_AUDIENCE, DEPLOY_TICKET_TTL_SECONDS } = await import("@/lib/tensor-cloud");
    const ticket = signDeployTicket(
      { userId: "user-1", taskId: "task-1", name: "bakery", action: "publish", replaces: "old-bakery" },
      "a-secret-that-is-long-enough-for-tests",
      1_000,
    );
    const claims = JSON.parse(Buffer.from(ticket.split(".")[1]!, "base64url").toString());
    expect(claims).toMatchObject({
      aud: DEPLOY_TICKET_AUDIENCE,
      sub: "user-1",
      task: "task-1",
      name: "bakery",
      action: "publish",
      replaces: "old-bakery",
      iat: 1_000,
      exp: 1_000 + DEPLOY_TICKET_TTL_SECONDS,
    });
    expect(typeof claims.jti).toBe("string");
    // Nothing to replace: the claim is left out, not sent empty.
    const plain = signDeployTicket({ userId: "u", taskId: "t", name: "bakery", action: "remove" }, "a-secret-that-is-long-enough-for-tests");
    expect(JSON.parse(Buffer.from(plain.split(".")[1]!, "base64url").toString()).replaces).toBeUndefined();
  });

  it("turns the gateway's socket address into its ordinary one", async () => {
    const { gatewayHttpUrl } = await import("@/lib/tensor-cloud");
    expect(gatewayHttpUrl("wss://tensor-gateway.fly.dev")).toBe("https://tensor-gateway.fly.dev");
    expect(gatewayHttpUrl("ws://localhost:8080/v1/connect")).toBe("http://localhost:8080");
  });
});
