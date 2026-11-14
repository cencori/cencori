import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import {
  gatewayHttpUrl,
  normalizeSiteName,
  readTensorCloudConfig,
  signDeployTicket,
  SITE_NAME_MAX,
  SITE_NAME_MIN,
} from "@/lib/tensor-cloud";
import {
  claimSiteName,
  deleteDeployment,
  deploymentJson,
  markPublished,
  readCloudAccess,
  readDeployment,
  readTask,
  siteNameAvailable,
  type TensorCloudTask,
} from "@/lib/tensor-cloud-tasks";

// Publishing a project: its site, at <name>.<sites domain>.
//
// This is who owns which name, and the permission to put files there. The files themselves never
// pass through here: the project's workspace uploads them straight to the gateway, which holds
// and serves the sites, with a ticket from this route that names the one address it is for.
//
//   GET     what the project is published as, if anything, and a name to suggest
//   POST    hold a name (or change it) and get a ticket to upload with
//   PATCH   the upload went through: what is served is now this
//   DELETE  stop publishing: the name is let go, and a ticket to remove the copy is returned

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

const BAD_NAME = `A name is ${SITE_NAME_MIN} to ${SITE_NAME_MAX} letters, digits or dashes, and some names are kept back.`;

type Context = { params: Promise<{ id: string }> };

/** The project the request is about, or the answer to give instead. */
async function open(request: NextRequest, context: Context) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return { refused: json({ error: "Your Cencori session is invalid." }, 401) } as const;
  const config = readTensorCloudConfig();
  if (!config) return { refused: json({ error: "Tensor on the web is not available yet." }, 503) } as const;
  const task = await readTask(session.admin, session.user.id, (await context.params).id);
  if (!task || !task.project_name) return { refused: json({ error: "That project does not exist." }, 404) } as const;
  return { session, config, task } as const;
}

/** A free name to start from: the project's own, then the same with a number after it. */
async function suggestName(admin: Parameters<typeof siteNameAvailable>[0], task: TensorCloudTask): Promise<string | null> {
  const base = normalizeSiteName(task.project_name) ?? normalizeSiteName(`${task.project_name ?? ""} site`);
  if (!base) return null;
  for (const candidate of [base, ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => normalizeSiteName(`${base.slice(0, SITE_NAME_MAX - 2)}-${n}`))]) {
    if (candidate && (await siteNameAvailable(admin, candidate, task.id))) return candidate;
  }
  return null;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, task } = opened;
    const deployment = await readDeployment(session.admin, task.id);
    return json({
      deployment: deployment ? deploymentJson(deployment) : null,
      suggestedName: deployment ? null : await suggestName(session.admin, task),
      gateway: gatewayHttpUrl(config.gatewayUrl),
    });
  } catch (error) {
    console.error("[Tensor Cloud] Reading a deployment failed", error);
    return json({ error: "Tensor could not read this project's site." }, 503);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, task } = opened;
    if (task.archived_at) {
      return json({ error: "This project is archived. Unarchive it to publish.", code: "archived" }, 409);
    }
    // Publishing is part of building on the web: a plan that has lapsed cannot publish.
    if (!(await readCloudAccess(session.admin, session.user.id)).tasks) {
      return json(
        { error: "Publishing is part of Tensor's paid plans. Choose a plan to continue.", code: "plan_required" },
        402,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "That request is invalid." }, 400);
    }
    const name = normalizeSiteName(body.name);
    // What was typed is what is claimed, or nothing is: a name is not quietly changed into another.
    if (!name || name !== String(body.name).trim().toLowerCase()) return json({ error: BAD_NAME, code: "bad_name" }, 400);

    const before = await readDeployment(session.admin, task.id);
    const claimed = await claimSiteName(session.admin, task, name);
    if (claimed === "taken") {
      return json({ error: "That name is taken. Try another.", code: "name_taken" }, 409);
    }

    const ticket = signDeployTicket(
      {
        userId: session.user.id,
        taskId: task.id,
        name,
        action: "publish",
        // The copy under the old name goes once the new one is up, and only if there was one.
        replaces: before && before.name !== name && before.published_at ? before.name : null,
      },
      config.ticketSecret,
    );
    return json({
      deployment: deploymentJson(claimed),
      upload: { url: `${gatewayHttpUrl(config.gatewayUrl)}/v1/sites?ticket=${encodeURIComponent(ticket)}` },
    });
  } catch (error) {
    console.error("[Tensor Cloud] Publishing failed", error);
    return json({ error: "Tensor could not publish this project. Try again shortly." }, 503);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, task } = opened;
    const deployment = await markPublished(session.admin, task.id);
    if (!deployment) return json({ error: "This project has no site to mark as published." }, 404);
    return json({ deployment: deploymentJson(deployment) });
  } catch (error) {
    console.error("[Tensor Cloud] Marking a deployment published failed", error);
    return json({ error: "Tensor could not update this project's site." }, 503);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const opened = await open(request, context);
    if ("refused" in opened) return opened.refused;
    const { session, config, task } = opened;
    const deployment = await readDeployment(session.admin, task.id);
    if (!deployment) return json({ removed: true, remove: null });
    await deleteDeployment(session.admin, task.id);
    const ticket = signDeployTicket(
      { userId: session.user.id, taskId: task.id, name: deployment.name, action: "remove" },
      config.ticketSecret,
    );
    return json({
      removed: true,
      remove: { url: `${gatewayHttpUrl(config.gatewayUrl)}/v1/sites?ticket=${encodeURIComponent(ticket)}` },
    });
  } catch (error) {
    console.error("[Tensor Cloud] Unpublishing failed", error);
    return json({ error: "Tensor could not unpublish this project." }, 503);
  }
}
