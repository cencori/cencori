import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { readTensorCloudConfig, type TensorCloudConfig } from "@/lib/tensor-cloud";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import { readTask, type TensorCloudTask } from "@/lib/tensor-cloud-tasks";
import {
  createProject,
  deleteLink,
  PAWABASE_ORIGIN,
  PAWABASE_VARIABLE_NAMES,
  PawabaseError,
  pawabaseConnection,
  readLink,
  readPawabaseApp,
  readProject,
  retryProject,
  saveLink,
  setLinkStatus,
  variablesFor,
  type PawabaseLink,
  type PawabaseProject,
} from "@/lib/tensor-pawabase";
import { mergeProjectVariables } from "@/lib/tensor-supabase";

// A Tensor project's Pawabase project (lib/tensor-pawabase.ts). Only the project's owner: not the
// project's own credential, which Tensor works with in the project.
//
//   GET     which Pawabase project it uses, if any; a project still being made is checked on, and
//           its variables written once it is running
//   PUT     { create: { name }, withSecretKey? } makes a new Pawabase project for it;
//           { projectRef, withSecretKey? } links one the person already has;
//           { retry: true } tries a project Pawabase failed to make again
//   DELETE  unlinks it; ?variables=remove also takes its variables out of the project's

type Context = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

function linkJson(link: PawabaseLink | null) {
  return link
    ? {
        projectId: link.project_id,
        projectRef: link.project_ref,
        projectName: link.project_name,
        organization: link.organization,
        createdByTensor: link.created_by_tensor,
        withSecretKey: link.with_secret_key,
        status: link.status,
        failureReason: link.failure_reason,
        linkedAt: link.linked_at,
        dashboardUrl: `${PAWABASE_ORIGIN}/projects/${encodeURIComponent(link.project_ref)}`,
      }
    : null;
}

async function open(request: NextRequest, context: Context) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, []);
  if (session === "forbidden") return { refused: json({ error: "Only the project's owner can change its Pawabase." }, 403) } as const;
  if (!session) return { refused: json({ error: "Your Cencori session is invalid." }, 401) } as const;
  const config = readTensorCloudConfig();
  const app = readPawabaseApp();
  if (!config || !app) return { refused: json({ error: "Pawabase is not available yet." }, 503) } as const;
  const task = await readTask(session.admin, session.user.id, id);
  if (!task || !task.project_name) return { refused: json({ error: "That project does not exist." }, 404) } as const;
  return { session, config, app, task } as const;
}

function failed(error: unknown, what: string) {
  if (error instanceof PawabaseError) return json({ error: error.message }, error.status === 401 ? 409 : error.status);
  console.error(`[Tensor Pawabase] ${what} failed`, error);
  return json({ error: "Tensor could not reach Pawabase. Try again shortly." }, 503);
}

/**
 * Brings a link up to date with its project: a running one gets its variables written (once), a
 * failed one keeps Pawabase's reason, one still coming up is left to be asked about again.
 */
async function settle(
  admin: Parameters<typeof readLink>[0],
  config: TensorCloudConfig,
  task: TensorCloudTask,
  token: string,
  link: PawabaseLink,
  project: PawabaseProject,
): Promise<{ link: PawabaseLink; variablesChanged: boolean }> {
  if (project.state === "failed") {
    await setLinkStatus(admin, task.id, "failed", project.failureReason ?? "Pawabase could not make this project.");
    return { link: { ...link, failure_reason: project.failureReason, status: "failed" }, variablesChanged: false };
  }
  if (project.state !== "running" || !project.apiUrl) return { link, variablesChanged: false };
  try {
    await mergeProjectVariables(admin, config, task, await variablesFor(token, project, link.with_secret_key));
  } catch (error) {
    // Running, but not ready to hand out its address or keys yet: asked again next time.
    if (error instanceof PawabaseError && error.status === 409) return { link, variablesChanged: false };
    throw error;
  }
  await setLinkStatus(admin, task.id, "ready");
  return { link: { ...link, failure_reason: null, status: "ready" }, variablesChanged: true };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, app, task } = opened;
    const link = await readLink(session.admin, task.id);
    if (!link || link.status === "ready") return json({ link: linkJson(link) });

    const connection = await pawabaseConnection(session.admin, config, app, session.user.id);
    if (!connection) return json({ link: linkJson(link) });
    const project = await readProject(connection.token, link.project_ref);
    if (!project) return json({ link: linkJson(link) });
    const settled = await settle(session.admin, config, task, connection.token, link, project);
    return json({ link: linkJson(settled.link), projectState: project.state, ...(settled.variablesChanged ? { variablesChanged: true } : {}) });
  } catch (error) {
    return failed(error, "Reading a project's Pawabase");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, app, task } = opened;
    const connection = await pawabaseConnection(session.admin, config, app, session.user.id);
    if (!connection) return json({ error: "Connect Pawabase first.", code: "not_connected" }, 409);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "That request is invalid." }, 400);
    }
    const withSecretKey = body.withSecretKey === true;

    if (body.retry === true) {
      const link = await readLink(session.admin, task.id);
      if (!link || link.status !== "failed") return json({ error: "There is no failed Pawabase project to try again." }, 409);
      await retryProject(connection.token, link.project_ref);
      await setLinkStatus(session.admin, task.id, "creating");
      return json({ link: linkJson({ ...link, failure_reason: null, status: "creating" }) });
    }

    const create = body.create as Record<string, unknown> | undefined;
    if (create && typeof create === "object") {
      const name = typeof create.name === "string" ? create.name.trim().slice(0, 80) : "";
      if (!name) return json({ error: "Give the Pawabase project a name." }, 400);
      const project = await createProject(connection.token, { name, taskId: task.id });
      await saveLink(session.admin, task, {
        createdByTensor: true,
        organization: connection.organization,
        projectId: project.id,
        projectName: project.name,
        projectRef: project.ref,
        status: "creating",
        withSecretKey,
      });
      const link = (await readLink(session.admin, task.id)) as PawabaseLink;
      // Pawabase answers at once with the project still coming up; a retried request may find it up.
      const settled = await settle(session.admin, config, task, connection.token, link, project);
      return json({ link: linkJson(settled.link), ...(settled.variablesChanged ? { variablesChanged: true } : {}) });
    }

    const projectRef = typeof body.projectRef === "string" ? body.projectRef.trim() : "";
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(projectRef)) return json({ error: "Choose one of your Pawabase projects." }, 400);
    const project = await readProject(connection.token, projectRef);
    if (!project) return json({ error: "That Pawabase project was not found." }, 404);
    await saveLink(session.admin, task, {
      createdByTensor: false,
      organization: connection.organization,
      projectId: project.id,
      projectName: project.name,
      projectRef: project.ref,
      status: "creating",
      withSecretKey,
    });
    const link = (await readLink(session.admin, task.id)) as PawabaseLink;
    const settled = await settle(session.admin, config, task, connection.token, link, project);
    return json({ link: linkJson(settled.link), ...(settled.variablesChanged ? { variablesChanged: true } : {}) });
  } catch (error) {
    return failed(error, "Linking a project to Pawabase");
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, task } = opened;
    await deleteLink(session.admin, task.id);
    const remove = request.nextUrl.searchParams.get("variables") === "remove";
    if (remove) await mergeProjectVariables(session.admin, config, task, [], PAWABASE_VARIABLE_NAMES);
    return json({ link: null, variablesChanged: remove });
  } catch (error) {
    return failed(error, "Unlinking a project from Pawabase");
  }
}
