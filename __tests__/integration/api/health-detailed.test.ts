// __tests__/integration/api/health-detailed.test.ts
import { GET } from "@/app/api/health/detailed/route";
import { NextRequest } from "next/server";
import { describe, expect, test, vi, beforeEach } from "vitest";

// Mock all external dependencies
vi.mock("@/lib/supabaseServer", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/providers/index", () => ({
  getProviderHealth: vi.fn(),
}));

vi.mock("@/lib/health-summary", () => ({
  generateHealthSummary: vi.fn().mockResolvedValue("All systems operational."),
}));

import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getProviderHealth } from "@/lib/providers/index";

const mockServerClient = vi.mocked(createServerClient);
const mockAdminClient = vi.mocked(createAdminClient);
const mockProviderHealth = vi.mocked(getProviderHealth);

// ── Helpers ────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}) {
  const req = new NextRequest("http://localhost/api/health/detailed");
  Object.entries(headers).forEach(([k, v]) => req.headers.set(k, v));
  return req;
}

function setupAuth(hasSession: boolean) {
  mockServerClient.mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: hasSession ? { user: { id: "user-123" } } : null },
      }),
    },
  } as unknown as ReturnType<typeof createServerClient>);
}

function setupAdminClient(healthy = true) {
  mockAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          error: healthy ? null : new Error("DB Error"),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as unknown as ReturnType<typeof createAdminClient>);
}

// ── Tests ──────────────────────────────────────────────────────

describe("GET /api/health/detailed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    mockProviderHealth.mockResolvedValue(true);
  });

  test("returns 401 for unauthenticated requests", async () => {
    setupAuth(false);
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  test("returns 200 for authenticated requests", async () => {
    setupAuth(true);
    setupAdminClient(true);
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
  });

  test("allows cron requests authenticated with CRON_SECRET header", async () => {
    setupAuth(false);
    setupAdminClient(true);
    const response = await GET(makeRequest({ "x-cron-secret": "test-secret" }));
    expect(response.status).toBe(200);
  });

  test("response has correct JSON shape", async () => {
    setupAuth(true);
    setupAdminClient(true);
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("services.database.status");
    expect(body).toHaveProperty("services.database.latencyMs");
    expect(body).toHaveProperty("services.aiGateway.status");
    expect(body).toHaveProperty("services.memory.status");
  });

  test("all three service keys are present even when one fails", async () => {
    setupAuth(true);
    setupAdminClient(false);
    mockProviderHealth.mockRejectedValue(new Error("Provider down"));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.services).toHaveProperty("database");
    expect(body.services).toHaveProperty("aiGateway");
    expect(body.services).toHaveProperty("memory");
    expect(response.status).toBe(200);
  });
});
