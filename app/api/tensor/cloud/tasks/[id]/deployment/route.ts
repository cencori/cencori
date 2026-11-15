import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import {
  gatewayHttpUrl,
  normalizeSiteName,
  readTensorCloudConfig,
  signDeployTicket,
  SITE_NAME_MAX,
  SITE_NAME_MIN,
  sitesFly,
} from "@/lib/tensor-cloud";
import {
  claimSiteName,
  countSiteMachines,
  deleteDeployment,
  deploymentJson,
  destroySiteMachine,
  applySitePlan,
  ensureSiteMachine,
  giveSiteVariables,
  planFor,
  markPublished,
  readCloudAccess,
  readDeployment,
  readTask,
  readVariables,
  siteNameAvailable,
  type SiteUsage,
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
//
// A project is published as one of two things, and says which ("kind"). A static site is files.
// An app has a server of its own, so it is given a machine and a disk to run on, which cost money
// for as long as it stays published: a plan includes a number of them, and the machine is
// destroyed, with the app's live data, when the project is unpublished.

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

const BAD_NAME = `A name is ${SITE_NAME_MIN} to ${SITE_NAME_MAX} letters, digits or dashes, and some names are kept back.`;

type Context = { params: Promise<{ id: string }> };

/** The project the request is about, or the answer to give instead. */
async function open(request: NextRequest, context: Context) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, ["GET", "POST", "PATCH"]);
  if (session === "forbidden") return { refused: json({ error: "Tensor cannot do that for you. Ask the project's owner to do it in the project's settings." }, 403) } as const;
  if (!session) return { refused: json({ error: "Your Cencori session is invalid." }, 401) } as const;
  const config = readTensorCloudConfig();
  if (!config) return { refused: json({ error: "Tensor on the web is not available yet." }, 503) } as const;
  const task = await readTask(session.admin, session.user.id, id);
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
    const access = await readCloudAccess(session.admin, session.user.id);
    // A published app: its plan as it is now is applied (looking is one of the times it is), and
    // what it has used this month is said.
    let usage: SiteUsage | null = null;
    if (deployment?.published_at) {
      const applied = await applySitePlan(config, deployment, await planFor(session.admin, session.user.id, deployment, access));
      if (applied.ok) {
        usage = applied.usage;
        // Served again: the grace period, if one had begun, is over.
        if (!usage.paused && deployment.paused_at) {
          await session.admin.from("tensor_cloud_deployments").update({ paused_at: null, pause_warned_at: null }).eq("task_id", task.id);
          deployment.paused_at = null;
        }
        // Paused just now: an app's grace period begins (a site of files has none).
        if (usage.paused && !deployment.paused_at && deployment.kind === "app") {
          const now = new Date().toISOString();
          await session.admin.from("tensor_cloud_deployments").update({ paused_at: now }).eq("task_id", task.id);
          deployment.paused_at = now;
        }
      } else console.error(`[Tensor Cloud] Applying the plan to what task ${task.id} published failed: ${applied.error}`);
    }
    return json({
      usage,
      // What the owner's plan allows a published app with a server of its own.
      allowance: { backendApps: access.backendApps, site: access.site },
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
    const access = await readCloudAccess(session.admin, session.user.id);
    if (!access.tasks) {
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

    const asApp = body.kind === "app";
    const before = await readDeployment(session.admin, task.id);
    if (asApp) {
      if (!config.sitesImage) {
        return json(
          { error: "Projects that run a server of their own cannot be published yet.", code: "apps_unavailable" },
          503,
        );
      }
      if (access.backendApps === 0 || !access.site) {
        return json(
          { error: "This project runs a server of its own, which your plan does not include publishing.", code: "plan_required" },
          402,
        );
      }
      // A project that already has its machine is updating, which is always allowed.
      if (!before?.machine_id && (await countSiteMachines(session.admin, session.user.id, task.id)) >= access.backendApps) {
        const apps = access.backendApps === 1 ? "one published app" : `${access.backendApps} published apps`;
        return json(
          {
            error: `Your plan includes ${apps} with a server of its own. Unpublish one, or choose a larger plan.`,
            code: "app_limit",
          },
          409,
        );
      }
    }

    const claimed = await claimSiteName(session.admin, task, name);
    if (claimed === "taken") {
      return json({ error: "That name is taken. Try another.", code: "name_taken" }, 409);
    }

    let machineId: string | null = null;
    if (asApp) {
      const machine = await ensureSiteMachine(session.admin, sitesFly(config), config, claimed, access.site?.volumeGb ?? 1);
      if (!machine.ok) {
        console.error(`[Tensor Cloud] Making a site machine for task ${task.id} failed: ${machine.error}`);
        return json({ error: "Tensor could not set up somewhere for this app to run. Try again shortly." }, 503);
      }
      machineId = machine.machineId;
      // The app is started as soon as it arrives, so it has its variables before then: an app
      // that needs a database address would otherwise fail its first start.
      const given = await giveSiteVariables(config, claimed, machineId, await readVariables(session.admin, config, task.id));
      if (!given.ok) {
        console.error(`[Tensor Cloud] Giving variables to the site machine of task ${task.id} failed: ${given.error}`);
        return json({ error: "Tensor could not give the app its environment variables. Try again shortly." }, 503);
      }
    }

    const ticket = signDeployTicket(
      {
        userId: session.user.id,
        taskId: task.id,
        name,
        action: "publish",
        // The copy under the old name goes once the new one is up, and only if there was one.
        replaces: before && before.name !== name && before.published_at ? before.name : null,
        machineId,
        // A site of files carries them too: what it sends counts against the account's data.
        limits: access.site,
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
    const { session, config, task } = opened;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const kind = body.kind === "app" ? "app" : "static";
    const deployment = await markPublished(session.admin, task.id, kind);
    if (!deployment) return json({ error: "This project has no site to mark as published." }, 404);
    // It was an app and is now files: the machine it ran on has nothing left to do.
    if (kind === "static" && (deployment.machine_id || deployment.volume_id)) {
      await destroySiteMachine(session.admin, sitesFly(config), deployment);
    }
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
    // An app's machine and disk go first. If they cannot be destroyed the project stays
    // published: letting the name go would leave a machine running that nothing remembers.
    if ((deployment.machine_id || deployment.volume_id) && !(await destroySiteMachine(session.admin, sitesFly(config), deployment))) {
      return json({ error: "Tensor could not take this app down. Try again shortly." }, 503);
    }
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
