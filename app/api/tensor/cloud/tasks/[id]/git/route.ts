import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import {
  connectionJson,
  deleteGitConnection,
  mintPushToken,
  tensorCommitter,
  normalizeBranch,
  notePush,
  pushableRepository,
  readGitConnection,
  readGithubAccount,
  readGithubApp,
  saveGitConnection,
} from "@/lib/tensor-cloud-github";
import { readCloudAccess, readTask } from "@/lib/tensor-cloud-tasks";

// The GitHub repository a project pushes to.
//
//   GET     the repository it is connected to, if any
//   PUT     connect it to a repository ({ repositoryId, branch? })
//   DELETE  disconnect it
//   POST    what is needed to push now: the repository, the branch, and a token for the hour
//   PATCH   the push went through
//
// Whether this person may push to the repository is asked of GitHub, with their own token, when
// the project is connected and again before every push (lib/tensor-cloud-github.ts).

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

const SIGN_IN = { error: "Sign in with GitHub again to continue.", code: "github_signin" } as const;
const NO_ACCESS = {
  error: "You can no longer push to that repository through the Cencori app on GitHub. Check that the app is still installed on it and that you have write access.",
  code: "github_no_access",
} as const;

type Context = { params: Promise<{ id: string }> };

/** The project the request is about, or the answer to give instead. */
async function open(request: NextRequest, context: Context) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, ["GET", "POST", "PATCH"]);
  if (session === "forbidden") return { refused: json({ error: "Tensor cannot do that for you. Ask the project's owner to do it in the project's settings." }, 403) } as const;
  if (!session) return { refused: json({ error: "Your Cencori session is invalid." }, 401) } as const;
  const config = readTensorCloudConfig();
  const app = readGithubApp();
  if (!config || !app) return { refused: json({ error: "GitHub is not available yet." }, 503) } as const;
  const task = await readTask(session.admin, session.user.id, id);
  if (!task || !task.project_name) return { refused: json({ error: "That project does not exist." }, 404) } as const;
  return { session, config, app, task } as const;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const connection = await readGitConnection(opened.session.admin, opened.task.id);
    return json({ connection: connection ? connectionJson(connection) : null });
  } catch (error) {
    console.error("[Tensor Cloud] Reading a git connection failed", error);
    return json({ error: "Tensor could not read this project's repository." }, 503);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, app, task } = opened;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "That request is invalid." }, 400);
    }
    const repositoryId = Number(body.repositoryId);
    if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) return json({ error: "Choose a repository." }, 400);

    const access = await readCloudAccess(session.admin, session.user.id);
    if (!access.tasks) {
      return json({ error: "Pushing to GitHub is part of Tensor's paid plans. Choose a plan to continue.", code: "plan_required" }, 402);
    }
    const account = await readGithubAccount(session.admin, config, app, session.user.id);
    if (!account?.token) return json(SIGN_IN, 401);
    const repo = await pushableRepository(account.token, repositoryId);
    if (!repo) return json(NO_ACCESS, 403);
    if (repo.private && !access.privateRepositories) {
      return json({ error: "Private repositories are part of the Pro plan and up. Choose a public repository, or a larger plan.", code: "plan_required" }, 402);
    }
    const branch = body.branch === undefined || body.branch === null || body.branch === "" ? repo.defaultBranch : normalizeBranch(body.branch);
    if (!branch) return json({ error: "That is not a branch name git accepts." }, 400);

    return json({ connection: connectionJson(await saveGitConnection(session.admin, task, repo, branch)) });
  } catch (error) {
    console.error("[Tensor Cloud] Connecting a repository failed", error);
    return json({ error: "Tensor could not connect that repository. Try again shortly." }, 503);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    await deleteGitConnection(opened.session.admin, opened.task.id);
    return json({ disconnected: true });
  } catch (error) {
    console.error("[Tensor Cloud] Disconnecting a repository failed", error);
    return json({ error: "Tensor could not disconnect this project. Try again shortly." }, 503);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, app, task } = opened;
    const connection = await readGitConnection(session.admin, task.id);
    if (!connection) return json({ error: "This project is not connected to a repository." }, 404);

    const access = await readCloudAccess(session.admin, session.user.id);
    if (!access.tasks || (connection.private && !access.privateRepositories)) {
      return json({ error: "Your plan no longer includes pushing to this repository. Choose a plan to continue.", code: "plan_required" }, 402);
    }
    const account = await readGithubAccount(session.admin, config, app, session.user.id);
    if (!account?.token) return json(SIGN_IN, 401);
    // Asked again every time: access given on GitHub can be taken away there.
    const repo = await pushableRepository(account.token, Number(connection.repository_id));
    if (!repo) return json(NO_ACCESS, 403);

    const [made, tensor] = await Promise.all([mintPushToken(repo, app), tensorCommitter(app)]);
    const person = { name: account.login, email: `${account.githubUserId}+${account.login}@users.noreply.github.com` };
    if (!made) return json({ error: "Tensor could not get permission to push from GitHub. Try again shortly." }, 503);
    return json({
      // The repository's name as it is now: it may have been renamed since it was connected.
      repository: repo.fullName,
      branch: connection.branch,
      token: made.token,
      expiresAt: made.expiresAt,
      // Tensor's commits are Tensor's: its app's bot is the author (so it is among the repository's
      // contributors, as v0's is), and the person is named beside it as co-author. On Cencori's app
      // there is no Tensor bot, and the person is the author as before.
      author: tensor ?? person,
      coAuthor: tensor ? person : null,
    });
  } catch (error) {
    console.error("[Tensor Cloud] Preparing a push failed", error);
    return json({ error: "Tensor could not prepare the push. Try again shortly." }, 503);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const connection = await notePush(opened.session.admin, opened.task.id);
    if (!connection) return json({ error: "This project is not connected to a repository." }, 404);
    return json({ connection: connectionJson(connection) });
  } catch (error) {
    console.error("[Tensor Cloud] Noting a push failed", error);
    return json({ error: "Tensor could not update this project's repository." }, 503);
  }
}
