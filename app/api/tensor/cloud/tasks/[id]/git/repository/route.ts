import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import {
  connectionJson,
  createUserRepository,
  pushableRepository,
  readGithubAccount,
  readGithubApp,
  repositoryName,
  saveGitConnection,
} from "@/lib/tensor-cloud-github";
import { readCloudAccess, readTask } from "@/lib/tensor-cloud-tasks";

// POST { name }: make a new repository on the person's GitHub account and connect this project
// to it, in one step (v0's "Create Repository"). Private on plans that include private
// repositories, public otherwise.

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const id = (await context.params).id;
    const session = await authenticateProjectRequest(request, id, []);
    if (session === "forbidden") return json({ error: "Ask the project's owner to do this in its settings." }, 403);
    if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
    const config = readTensorCloudConfig();
    const app = readGithubApp();
    if (!config || !app) return json({ error: "GitHub is not available yet." }, 503);
    const task = await readTask(session.admin, session.user.id, id);
    if (!task || !task.project_name) return json({ error: "That project does not exist." }, 404);

    const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
    const name = repositoryName(body?.name);
    if (!name) return json({ error: "Use letters, numbers, hyphens, underscores and periods." }, 400);

    const access = await readCloudAccess(session.admin, session.user.id);
    if (!access.tasks) {
      return json({ error: "Pushing to GitHub is part of Tensor's paid plans. Choose a plan to continue.", code: "plan_required" }, 402);
    }
    const account = await readGithubAccount(session.admin, config, app, session.user.id);
    if (!account?.token) return json({ error: "Sign in with GitHub again to continue.", code: "github_signin" }, 401);

    const made = await createUserRepository(account.token, name, access.privateRepositories);
    if (!made.ok) {
      if (made.reason === "exists") return json({ error: `You already have a repository called ${name}. Choose another name.` }, 409);
      if (made.reason === "not_allowed") {
        return json(
          { error: "Tensor is not allowed to create repositories on your GitHub yet. Create one on GitHub and choose it here, or try again after the Cencori app's permissions are updated.", code: "github_cannot_create" },
          403,
        );
      }
      return json({ error: "GitHub could not create the repository. Try again shortly." }, 502);
    }
    // Pushed to through the Cencori app, so it must be within the app's reach: the account's
    // installation covers it when set to all repositories, or once it is added there.
    const repo = (await pushableRepository(account.token, made.repository.id)) ?? made.repository;
    const branch = repo.defaultBranch || "main";
    const connection = await saveGitConnection(session.admin, task, repo, branch);
    return json({ connection: connectionJson(connection), repository: repo });
  } catch (error) {
    console.error("[Tensor Cloud] Creating a repository failed", error);
    return json({ error: "Tensor could not create the repository. Try again shortly." }, 503);
  }
}
