import { describe, expect, it, vi } from "vitest";
import { signSupabaseState, supabaseCodeChallenge, supabaseCodeVerifier, verifySupabaseState } from "@/lib/tensor-cloud";
import { newDatabasePassword, projectVariables, SupabaseError } from "@/lib/tensor-supabase";

const SECRET = "a-secret-for-tests-that-is-long-enough";

describe("the state sent to Supabase", () => {
  it("comes back as it went, and only signed by this app", () => {
    const { state, nonce } = signSupabaseState({ userId: "u1", site: "https://tensorade.app", path: "/chat/abc?settings=integrations" }, SECRET);
    expect(verifySupabaseState(state, SECRET)).toEqual({ userId: "u1", site: "https://tensorade.app", path: "/chat/abc?settings=integrations", nonce });
    expect(verifySupabaseState(state, "another-secret")).toBeNull();
    expect(verifySupabaseState(`${state}x`, SECRET)).toBeNull();
  });

  it("has run out after twenty minutes", () => {
    const { state } = signSupabaseState({ userId: "u1", site: "https://tensorade.app", path: "/" }, SECRET, 1_000);
    expect(verifySupabaseState(state, SECRET, 1_000 + 21 * 60)).toBeNull();
  });

  it("gives a PKCE verifier only this server can work out, and its challenge", () => {
    const verifier = supabaseCodeVerifier("nonce-1", SECRET);
    expect(verifier).toBe(supabaseCodeVerifier("nonce-1", SECRET));
    expect(verifier).not.toBe(supabaseCodeVerifier("nonce-2", SECRET));
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(supabaseCodeChallenge(verifier)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

function answers(routes: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    const body = routes[path];
    return body === undefined ? new Response("{}", { status: 404 }) : new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("what an app is given to reach a Supabase project", () => {
  it("its address and keys, for the server and the browser", async () => {
    const fetcher = answers({
      "/v1/projects/abcdefghijklmnopqrst/api-keys": [
        { name: "anon", api_key: "anon-key", type: "legacy" },
        { name: "service_role", api_key: "service-key", type: "legacy" },
      ],
    });
    const variables = await projectVariables("token", "abcdefghijklmnopqrst", null, fetcher);
    expect(variables).toEqual([
      { name: "SUPABASE_URL", value: "https://abcdefghijklmnopqrst.supabase.co" },
      { name: "NEXT_PUBLIC_SUPABASE_URL", value: "https://abcdefghijklmnopqrst.supabase.co" },
      { name: "SUPABASE_ANON_KEY", value: "anon-key" },
      { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: "anon-key" },
      { name: "SUPABASE_SERVICE_ROLE_KEY", value: "service-key" },
    ]);
  });

  it("the new kind of keys when that is what the project has", async () => {
    const fetcher = answers({
      "/v1/projects/abcdefghijklmnopqrst/api-keys": [
        { name: "default", api_key: "sb_publishable_x", type: "publishable" },
        { name: "default", api_key: "sb_secret_y", type: "secret" },
      ],
    });
    const variables = await projectVariables("token", "abcdefghijklmnopqrst", null, fetcher);
    expect(variables.find((one) => one.name === "SUPABASE_ANON_KEY")?.value).toBe("sb_publishable_x");
    expect(variables.find((one) => one.name === "SUPABASE_SERVICE_ROLE_KEY")?.value).toBe("sb_secret_y");
  });

  it("a database address through the pooler when the password is known", async () => {
    const fetcher = answers({
      "/v1/projects/abcdefghijklmnopqrst/api-keys": [{ name: "anon", api_key: "anon-key" }],
      "/v1/projects/abcdefghijklmnopqrst/config/database/pooler": [
        { database_type: "PRIMARY", db_user: "postgres.abcdefghijklmnopqrst", db_host: "aws-0-eu-central-1.pooler.supabase.com", db_port: 6543, db_name: "postgres" },
      ],
    });
    const variables = await projectVariables("token", "abcdefghijklmnopqrst", "p@ss word", fetcher);
    expect(variables.find((one) => one.name === "DATABASE_URL")?.value).toBe(
      "postgresql://postgres.abcdefghijklmnopqrst:p%40ss%20word@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
    );
  });

  it("the direct address when there is no pooler, and a clear refusal before the keys exist", async () => {
    const direct = answers({ "/v1/projects/abcdefghijklmnopqrst/api-keys": [{ name: "anon", api_key: "anon-key" }] });
    const variables = await projectVariables("token", "abcdefghijklmnopqrst", "pw", direct);
    expect(variables.find((one) => one.name === "DATABASE_URL")?.value).toBe("postgresql://postgres:pw@db.abcdefghijklmnopqrst.supabase.co:5432/postgres");
    await expect(projectVariables("token", "abcdefghijklmnopqrst", null, answers({ "/v1/projects/abcdefghijklmnopqrst/api-keys": [] }))).rejects.toBeInstanceOf(
      SupabaseError,
    );
  });

  it("makes passwords long and safe in an address", () => {
    const password = newDatabasePassword();
    expect(password).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newDatabasePassword()).not.toBe(password);
  });
});
