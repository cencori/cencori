import { describe, expect, it, vi } from "vitest";
import { createUserRepository, listInstalledOwners, repositoryName } from "@/lib/tensor-cloud-github";

describe("a new repository for a project", () => {
  it("takes a name GitHub accepts", () => {
    expect(repositoryName("Chess Game")).toBe("Chess-Game");
    expect(repositoryName("my.app_v2")).toBe("my.app_v2");
    expect(repositoryName("é!")).toBeNull();
    expect(repositoryName("..")).toBeNull();
  });

  it("says plainly when the name is taken or the app may not create repositories", async () => {
    const answer = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    expect(await createUserRepository("t", "chess", true, answer(422))).toEqual({ ok: false, reason: "exists" });
    expect(await createUserRepository("t", "chess", true, answer(403))).toEqual({ ok: false, reason: "not_allowed" });
    const made = await createUserRepository(
      "t",
      "chess",
      true,
      answer(201, { id: 7, full_name: "bola/chess", private: true, default_branch: "main" }),
    );
    expect(made).toEqual({ ok: true, repository: { id: 7, fullName: "bola/chess", private: true, defaultBranch: "main" } });
  });

  it("is made in an organization when one is chosen", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify({ id: 8, full_name: "sensory/chess", private: true, default_branch: "main" }), { status: 201 });
    }) as unknown as typeof fetch;
    await createUserRepository("t", "chess", true, fetcher, "sensory");
    await createUserRepository("t", "chess", true, fetcher);
    expect(calls).toEqual(["https://api.github.com/orgs/sensory/repos", "https://api.github.com/user/repos"]);
  });

  it("lists the accounts the app is installed on", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          installations: [
            { account: { login: "bola", type: "User" }, repository_selection: "all" },
            { account: { login: "sensory", type: "Organization" }, repository_selection: "selected" },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    expect(await listInstalledOwners("t", fetcher)).toEqual([
      { login: "bola", organization: false, allRepositories: true },
      { login: "sensory", organization: true, allRepositories: false },
    ]);
  });
});
