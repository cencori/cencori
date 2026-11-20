import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import { readTask } from "@/lib/tensor-cloud-tasks";
import {
  CENCORI_VARIABLE_NAMES,
  CencoriError,
  cencoriToken,
  createCencoriKey,
  createCencoriProject,
  deleteCencoriLink,
  listCencoriProjects,
  readCencoriApp,
  readCencoriLink,
  revokeCencoriKey,
  saveCencoriLink,
  type CencoriLink,
} from "@/lib/tensor-cencori";
import { mergeProjectVariables, SupabaseError } from "@/lib/tensor-supabase";

// A Tensor project's Cencori: which Cencori project its key is in.
//
//   GET     the link, if any
//   PUT     { projectId } or { create: { name } }: make a secret key there, keep it as the
//           project's CENCORI_API_KEY, and remember which key it is
//   DELETE  revoke that key on Cencori and take CENCORI_API_KEY out of the variables

type Context = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

function linkJson(link: CencoriLink | null) {
  return link
    ? { projectId: link.project_id, projectName: link.project_name, keyPrefix: link.key_prefix, linkedAt: link.linked_at }
    : null;
}

async function open(request: NextRequest, context: Context) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, []);
  if (session === "forbidden") return { refused: json({ error: "Only the project's owner can change its Cencori." }, 403) } as const;
  if (!session) return { refused: json({ error: "Your Cencori session is invalid." }, 401) } as const;
  const config = readTensorCloudConfig();
  const app = readCencoriApp();
  if (!config || !app) return { refused: json({ error: "Cencori is not available here yet." }, 503) } as const;
  const task = await readTask(session.admin, session.user.id, id);
  if (!task || !task.project_name) return { refused: json({ error: "That project does not exist." }, 404) } as const;
  return { session, config, app, task } as const;
}

function failed(error: unknown, what: string) {
  if (error instanceof CencoriError) return json({ error: error.message }, error.status === 401 ? 409 : error.status);
  if (error instanceof SupabaseError) return json({ error: error.message }, error.status);
  console.error(`[Tensor Cencori] ${what} failed`, error);
  return json({ error: "Tensor could not reach Cencori. Try again shortly." }, 503);
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    return json({ link: linkJson(await readCencoriLink(opened.session.admin, opened.task.id)) });
  } catch (error) {
    return failed(error, "Reading a project's Cencori");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, app, task } = opened;
    const token = await cencoriToken(session.admin, config, app, session.user.id);
    if (!token) return json({ error: "Connect Cencori first.", code: "not_connected" }, 409);

    const body = (await request.json().catch(() => null)) as { projectId?: unknown; create?: { name?: unknown } } | null;
    let project: { id: string; name: string } | undefined;
    if (body?.create && typeof body.create === "object") {
      const name = typeof body.create.name === "string" ? body.create.name.trim().slice(0, 60) : "";
      if (!name) return json({ error: "Give the Cencori project a name." }, 400);
      project = await createCencoriProject(token, name);
    } else if (typeof body?.projectId === "string") {
      project = (await listCencoriProjects(token)).find((one) => one.id === body.projectId);
      if (!project) return json({ error: "That Cencori project was not found." }, 404);
    } else {
      return json({ error: "Choose a Cencori project, or make a new one." }, 400);
    }

    // A key from an earlier link is revoked: the project has one Cencori key at a time.
    const earlier = await readCencoriLink(session.admin, task.id);
    const made = await createCencoriKey(token, project.id, `Tensor: ${task.project_name}`);
    await mergeProjectVariables(session.admin, config, task, [{ name: "CENCORI_API_KEY", value: made.key }]);
    await saveCencoriLink(session.admin, task, { projectId: project.id, projectName: project.name, keyId: made.id, keyPrefix: made.prefix });
    if (earlier && earlier.key_id !== made.id) await revokeCencoriKey(token, earlier.project_id, earlier.key_id).catch(() => {});
    return json({ link: linkJson(await readCencoriLink(session.admin, task.id)), variablesChanged: true });
  } catch (error) {
    return failed(error, "Giving a project a Cencori key");
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, app, task } = opened;
    const link = await readCencoriLink(session.admin, task.id);
    if (link) {
      const token = await cencoriToken(session.admin, config, app, session.user.id);
      // Revoked when the connection still works; otherwise the person revokes it in Cencori.
      if (token) await revokeCencoriKey(token, link.project_id, link.key_id).catch(() => {});
      await deleteCencoriLink(session.admin, task.id);
    }
    await mergeProjectVariables(session.admin, config, task, [], CENCORI_VARIABLE_NAMES);
    return json({ link: null, variablesChanged: true });
  } catch (error) {
    return failed(error, "Taking Cencori out of a project");
  }
}
