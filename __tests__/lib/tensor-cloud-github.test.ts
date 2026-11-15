import { describe, expect, it } from "vitest";
import {
  GITHUB_STATE_TTL_SECONDS,
  openGithubTokens,
  sealGithubTokens,
  signGatewayTicket,
  signGithubState,
  tensorSiteOrigin,
  tensorSitePath,
  verifyGithubState,
} from "@/lib/tensor-cloud";
import { listPushableRepositories, normalizeBranch, pushableRepository, readGithubApp } from "@/lib/tensor-cloud-github";

const secret = "task-secret-task-secret-task-secret-task";
const userId = "0195c0de-0000-7000-8000-00000000000a";
const now = 1_800_000_000;

describe("where a GitHub sign-in may return to", () => {
  it("is the Tensor site and nowhere else", () => {
    expect(tensorSiteOrigin("https://tensorade.app")).toBe("https://tensorade.app");
    expect(tensorSiteOrigin("https://www.tensorade.app/")).toBe("https://www.tensorade.app");
    for (const other of ["https://evil.example", "https://tensorade.app.evil.example", "http://tensorade.app", "//tensorade.app", "", null, 7]) {
      expect(tensorSiteOrigin(other, true)).toBeNull();
    }
  });

  it("is a local site only outside production", () => {
    expect(tensorSiteOrigin("http://127.0.0.1:3000", false)).toBe("http://127.0.0.1:3000");
    expect(tensorSiteOrigin("http://127.0.0.1:3000", true)).toBeNull();
  });

  it("is a path on that site, never another address dressed as one", () => {
    expect(tensorSitePath("/chat/abc?settings=git")).toBe("/chat/abc?settings=git");
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil.example", "chat", "/a b", "/" + "a".repeat(400), null]) {
      expect(tensorSitePath(bad)).toBe("/chat");
    }
  });
});

describe("the state a GitHub sign-in carries", () => {
  const state = { userId, site: "https://tensorade.app", path: "/chat/abc?settings=git" };

  it("comes back as it went out", () => {
    expect(verifyGithubState(signGithubState(state, secret, now), secret, now + 60)).toEqual(state);
  });

  it("is refused when it is forged, changed, stale, or something else this app signed", () => {
    const signed = signGithubState(state, secret, now);
    expect(verifyGithubState(signed, `${secret}x`, now)).toBeNull();
    expect(verifyGithubState(signed, secret, now + GITHUB_STATE_TTL_SECONDS + 1)).toBeNull();
    const [header, payload, signature] = signed.split(".");
    const claims = JSON.parse(Buffer.from(payload!, "base64url").toString());
    const tampered = Buffer.from(JSON.stringify({ ...claims, sub: "someone-else" })).toString("base64url");
    expect(verifyGithubState(`${header}.${tampered}.${signature}`, secret, now)).toBeNull();
    // A ticket for the gateway is signed by the same app, and is not a sign-in's state.
    const ticket = signGatewayTicket({ userId, taskId: "t", machineId: "148e21dc03d789" }, secret, now);
    expect(verifyGithubState(ticket, secret, now)).toBeNull();
    for (const junk of ["", "a.b.c", null, undefined, 3]) expect(verifyGithubState(junk, secret, now)).toBeNull();
  });

  it("cannot be signed for somewhere that is not the Tensor site", () => {
    const elsewhere = signGithubState({ ...state, site: "https://evil.example" }, secret, now);
    expect(verifyGithubState(elsewhere, secret, now)).toBeNull();
    // A path that is not one is replaced, not followed.
    const sideways = signGithubState({ ...state, path: "//evil.example" }, secret, now);
    expect(verifyGithubState(sideways, secret, now)?.path).toBe("/chat");
  });
});

describe("a person's GitHub tokens", () => {
  const tokens = { accessToken: "ghu_access", accessExpiresAt: now + 28_800, refreshToken: "ghr_refresh", refreshExpiresAt: now + 15_000_000 };

  it("are sealed so that only the same secret and the same person open them", () => {
    const sealed = sealGithubTokens(tokens, secret, userId);
    expect(openGithubTokens(sealed, secret, userId)).toEqual(tokens);
    expect(sealed).not.toContain("ghu_access");
    expect(sealed).not.toContain("ghr_refresh");
    expect(openGithubTokens(sealed, secret, "0195c0de-0000-7000-8000-00000000000b")).toBeNull();
    expect(openGithubTokens(sealed, `${secret}x`, userId)).toBeNull();
    expect(openGithubTokens("v1:a:b:c", secret, userId)).toBeNull();
  });

  it("may be ones that do not expire", () => {
    const lasting = { accessToken: "ghu_access", accessExpiresAt: null, refreshToken: null, refreshExpiresAt: null };
    expect(openGithubTokens(sealGithubTokens(lasting, secret, userId), secret, userId)).toEqual(lasting);
  });
});

describe("what GitHub says a person may push to", () => {
  const repo = (id: number, name: string, push: boolean, more: Record<string, unknown> = {}) => ({
    id,
    full_name: `bola/${name}`,
    private: false,
    default_branch: "main",
    permissions: { push },
    ...more,
  });

  /** Stands in for GitHub: answers each address with what is given for it. */
  const githubOf = (answers: Record<string, unknown>) => {
    const asked: { url: string; authorization: string | null }[] = [];
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url).replace("https://api.github.com", "");
      asked.push({ url: path, authorization: new Headers(init?.headers).get("authorization") });
      return path in answers ? new Response(JSON.stringify(answers[path])) : new Response("{}", { status: 404 });
    }) as typeof fetch;
    return { fetcher, asked };
  };

  it("lists only repositories they can write to, across every account the app is on, asked as them", async () => {
    const { fetcher, asked } = githubOf({
      "/user/installations?per_page=100": { installations: [{ id: 11 }, { id: 22 }] },
      "/user/installations/11/repositories?per_page=100&page=1": { repositories: [repo(2, "zebra", true), repo(1, "read-only", false)] },
      "/user/installations/22/repositories?per_page=100&page=1": {
        repositories: [repo(3, "apple", true, { private: true, default_branch: "trunk" }), repo(4, "old", true, { archived: true })],
      },
    });
    expect(await listPushableRepositories("ghu_token", fetcher)).toEqual([
      { id: 3, fullName: "bola/apple", private: true, defaultBranch: "trunk" },
      { id: 2, fullName: "bola/zebra", private: false, defaultBranch: "main" },
    ]);
    expect(asked.every((one) => one.authorization === "Bearer ghu_token")).toBe(true);
  });

  it("says it could not ask, which is not the same as there being none", async () => {
    expect(await listPushableRepositories("ghu_token", githubOf({}).fetcher)).toBeNull();
  });

  it("allows a push only to a repository GitHub says they can write to now", async () => {
    const { fetcher } = githubOf({
      "/repositories/5": repo(5, "mine", true),
      "/repositories/6": repo(6, "theirs", false),
      "/repositories/7": repo(7, "shelved", true, { archived: true }),
    });
    expect(await pushableRepository("ghu_token", 5, fetcher)).toEqual({ id: 5, fullName: "bola/mine", private: false, defaultBranch: "main" });
    expect(await pushableRepository("ghu_token", 6, fetcher)).toBeNull();
    expect(await pushableRepository("ghu_token", 7, fetcher)).toBeNull();
    // Gone, or the app was taken off it, or it was never theirs: GitHub answers the same.
    expect(await pushableRepository("ghu_token", 8, fetcher)).toBeNull();
  });
});

describe("a branch to push to", () => {
  it("is a plain branch name", () => {
    for (const good of ["main", "tensor", "feature/new-menu", "release-1.2", "a"]) expect(normalizeBranch(good)).toBe(good);
    expect(normalizeBranch("  main  ")).toBe("main");
  });

  it("is nothing git would take as something else", () => {
    for (const bad of ["", " ", "-f", "--force", "a..b", "a b", "a//b", "a/", "a.", "a.lock", "refs~1", "x:y", "a\nb", "$(id)", "`id`", "a;b", null, 4]) {
      expect(normalizeBranch(bad), String(bad)).toBeNull();
    }
  });
});

describe("the GitHub App's sign-in credentials", () => {
  it("are read when they are both there", () => {
    expect(readGithubApp({ GITHUB_APP_CLIENT_ID: "Iv1", GITHUB_APP_CLIENT_SECRET: "s" })).toEqual({ clientId: "Iv1", clientSecret: "s", slug: "cencori" });
    expect(readGithubApp({ GITHUB_APP_CLIENT_ID: "Iv1" })).toBeNull();
    expect(readGithubApp({})).toBeNull();
  });
});
