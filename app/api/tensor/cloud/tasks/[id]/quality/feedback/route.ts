import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import { readTask } from "@/lib/tensor-cloud-tasks";
import { QualityError, qualityThread, qualityThreads, readQualityConfig, readQualityLink } from "@/lib/tensor-quality";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * What visitors said about a project's published app, through Quality. The list (`?status=`,
 * `?search=`, `?cursor=`), or one thread (`?thread=<id>`) with the console messages, failed
 * requests and clicks from just before it. The project's agent reads this to fix what was flagged.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, ["GET"]);
  if (session === "forbidden") return json({ error: "That is not this project's." }, 403);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readQualityConfig();
  if (!config) return json({ error: "Quality is not available yet." }, 503);
  try {
    const task = await readTask(session.admin, session.user.id, id);
    if (!task) return json({ error: "That project does not exist." }, 404);
    if (!(await readQualityLink(session.admin, id))) {
      return json({ error: "Quality is off for this project. Its owner can turn it on in Project settings." }, 409);
    }
    const params = request.nextUrl.searchParams;
    const thread = params.get("thread");
    if (thread) return json(await qualityThread(config, session.user.id, id, thread));
    return json(
      await qualityThreads(config, session.user.id, id, {
        cursor: params.get("cursor") ?? undefined,
        limit: Number(params.get("limit")) || undefined,
        search: params.get("search") ?? undefined,
        status: params.get("status") ?? undefined,
      }),
    );
  } catch (error) {
    if (error instanceof QualityError) return json({ error: error.message }, error.status === 404 ? 404 : 503);
    console.error("[Tensor Quality] Reading a project's feedback failed", error);
    return json({ error: "Tensor could not read this project's feedback." }, 503);
  }
}
