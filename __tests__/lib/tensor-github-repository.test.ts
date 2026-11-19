import { describe, expect, it, vi } from "vitest";
import { createUserRepository, repositoryName } from "@/lib/tensor-cloud-github";

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
});
