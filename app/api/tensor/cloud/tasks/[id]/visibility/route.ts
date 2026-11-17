import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import { readDeployment, readTask, setSiteVisibility } from "@/lib/tensor-cloud-tasks";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * Who may see a project's published site: anyone with its address, or whoever has its password
 * (lib/tensor-cloud-tasks.ts setSiteVisibility). Only the project's owner may change it: the
 * project's own credential, which Tensor works with in the project, may not.
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, []);
  if (session === "forbidden") return json({ error: "Only the project's owner can change who sees it." }, 403);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Tensor on the web is not available yet." }, 503);

  let body: { mode?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }
  const mode = body.mode === "password" ? "password" : body.mode === "public" ? "public" : null;
  if (!mode) return json({ error: "That request is invalid." }, 400);
  const password = typeof body.password === "string" ? body.password : null;
  if (mode === "password" && (!password || password.length < 6 || password.length > 200)) {
    return json({ error: "A password is 6 to 200 characters." }, 400);
  }

  try {
    const task = await readTask(session.admin, session.user.id, id);
    if (!task || !task.project_name) return json({ error: "That project does not exist." }, 404);
    // The ticket names the site's address; one not published yet goes by a placeholder, as the
    // gateway keeps the setting by project.
    const deployment = await readDeployment(session.admin, task.id);
    const saved = await setSiteVisibility(
      session.admin,
      config,
      { id: task.id, user_id: session.user.id },
      deployment?.name ?? "unpublished",
      mode,
      password,
    );
    if (!saved.ok) return json({ error: saved.error }, saved.status);
    return json({ visibility: mode });
  } catch (error) {
    console.error("[Tensor Cloud] Changing who sees a site failed", error);
    return json({ error: "Tensor could not change who sees this site." }, 503);
  }
}
