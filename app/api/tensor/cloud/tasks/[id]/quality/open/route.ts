import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import { readDeployment, readTask, sitesDomainOf } from "@/lib/tensor-cloud-tasks";
import { QualityError, qualitySignInUrl, readQualityConfig, readQualityLink } from "@/lib/tensor-quality";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

type Context = { params: Promise<{ id: string }> };

/**
 * A one-time link that opens the project's published app with its owner signed in to Quality
 * (lib/tensor-quality.ts), so they never sign in to Quality themselves. The link lasts five
 * minutes, so it is asked for when they click Open, never ahead of time.
 */
export async function POST(request: NextRequest, context: Context) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, []);
  if (session === "forbidden") return json({ error: "Only the project's owner can open it signed in." }, 403);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const cloud = readTensorCloudConfig();
  const config = readQualityConfig();
  if (!cloud || !config) return json({ error: "Quality is not available yet." }, 503);

  let body: { path?: unknown } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as typeof body;
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }

  try {
    const [task, deployment, link, sitesDomain] = await Promise.all([
      readTask(session.admin, session.user.id, id),
      readDeployment(session.admin, id),
      readQualityLink(session.admin, id),
      sitesDomainOf(cloud),
    ]);
    if (!task || !task.project_name) return json({ error: "That project does not exist." }, 404);
    if (!deployment) return json({ error: "This app is not published." }, 409);
    if (!link) return json({ error: "Quality is off for this app." }, 409);
    const url = await qualitySignInUrl(session.admin, config, {
      link,
      path: typeof body.path === "string" ? body.path : undefined,
      siteName: deployment.name,
      sitesDomain,
      title: task.title || task.project_name,
    });
    return json({ url });
  } catch (error) {
    if (error instanceof QualityError) {
      if (error.status === 409) return json({ error: "Quality is off for this app." }, 409);
      return json({ error: error.message }, error.status === 400 ? 400 : 503);
    }
    console.error("[Tensor Quality] Making a signed-in link failed", error);
    return json({ error: "Tensor could not open this app signed in to Quality." }, 503);
  }
}
