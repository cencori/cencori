import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import { readDeployment, readTask, sitesDomainOf } from "@/lib/tensor-cloud-tasks";
import {
  disableQuality,
  enableQuality,
  QualityError,
  type QualityMode,
  readQualityConfig,
  readQualityLink,
} from "@/lib/tensor-quality";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

type Context = { params: Promise<{ id: string }> };

/**
 * Quality's visitor feedback on a project's published app (lib/tensor-quality.ts): whether it is
 * on, and who may comment. Its owner turns it on and off; the project's agent may read the state.
 */
export async function GET(request: NextRequest, context: Context) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, ["GET"]);
  if (session === "forbidden") return json({ error: "That is not this project's." }, 403);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  try {
    const task = await readTask(session.admin, session.user.id, id);
    if (!task) return json({ error: "That project does not exist." }, 404);
    const [link, deployment] = await Promise.all([readQualityLink(session.admin, id), readDeployment(session.admin, id)]);
    return json({
      quality: {
        available: Boolean(readQualityConfig()),
        enabled: Boolean(link),
        mode: link?.mode ?? "members",
        published: Boolean(deployment),
      },
    });
  } catch (error) {
    console.error("[Tensor Quality] Reading a project's Quality setting failed", error);
    return json({ error: "Tensor could not read this project's Quality setting." }, 503);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, []);
  if (session === "forbidden") return json({ error: "Only the project's owner can change this." }, 403);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const cloud = readTensorCloudConfig();
  const config = readQualityConfig();
  if (!cloud || !config) return json({ error: "Quality is not available yet." }, 503);

  let body: { enabled?: unknown; mode?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }
  if (typeof body.enabled !== "boolean") return json({ error: "That request is invalid." }, 400);
  const mode: QualityMode = body.mode === "anyone" ? "anyone" : "members";

  try {
    const [task, deployment, existing, sitesDomain] = await Promise.all([
      readTask(session.admin, session.user.id, id),
      readDeployment(session.admin, id),
      readQualityLink(session.admin, id),
      sitesDomainOf(cloud),
    ]);
    if (!task || !task.project_name) return json({ error: "That project does not exist." }, 404);
    const owner = { id: task.id, user_id: session.user.id };
    if (!body.enabled) {
      if (existing) {
        await disableQuality(session.admin, cloud, config, owner, deployment?.name ?? "unpublished");
      }
      return json({ quality: { available: true, enabled: false, mode, published: Boolean(deployment) } });
    }
    // Quality is tied to the address an app is served at, so it comes on once there is one.
    if (!deployment) return json({ error: "Publish the app first, then turn Quality on." }, 409);
    const link = await enableQuality(session.admin, cloud, config, {
      mode,
      siteName: deployment.name,
      existing,
      sitesDomain,
      task: owner,
      title: task.title || task.project_name,
    });
    return json({ quality: { available: true, enabled: true, mode: link.mode, published: true } });
  } catch (error) {
    if (error instanceof QualityError) return json({ error: error.message }, error.status === 400 ? 400 : 503);
    console.error("[Tensor Quality] Changing a project's Quality setting failed", error);
    return json({ error: "Tensor could not change Quality for this project." }, 503);
  }
}
