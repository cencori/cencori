import { after, NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { queueBackgroundTurn, readBackgroundTurn, recentSiteChanges, runBackgroundTurn } from "@/lib/tensor-background-turn";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import { authenticateProjectRequest } from "@/lib/tensor-cloud-project-auth";
import { readTask } from "@/lib/tensor-cloud-tasks";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

type Context = { params: Promise<{ id: string }> };

const MAX_PROMPT = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A turn in the project with no page open (lib/tensor-background-turn.ts). Its owner asks for one
 * with a message and is answered at once with its id; the turn runs on after the answer, and
 * GET ?run=<id> says how it went. Comments on the published app will queue theirs the same way.
 */
export async function POST(request: NextRequest, context: Context) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, []);
  if (session === "forbidden") return json({ error: "Only the project's owner can do this." }, 403);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const cloud = readTensorCloudConfig();
  if (!cloud) return json({ error: "Tensor on the web is not available yet." }, 503);

  let body: { prompt?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > MAX_PROMPT) return json({ error: "Say what Tensor should do." }, 400);

  try {
    const task = await readTask(session.admin, session.user.id, id);
    if (!task) return json({ error: "That project does not exist." }, 404);
    const row = await queueBackgroundTurn(session.admin, { prompt, source: "manual", taskId: id, userId: session.user.id });
    const admin = session.admin;
    after(() =>
      runBackgroundTurn(admin, cloud, row).catch((error) => console.error("[Tensor Background] A turn failed", error)),
    );
    return json({ run: { id: row.id, status: row.status } }, 202);
  } catch (error) {
    console.error("[Tensor Background] Queueing a turn failed", error);
    return json({ error: "Tensor could not start that." }, 503);
  }
}

export async function GET(request: NextRequest, context: Context) {
  const id = (await context.params).id;
  const session = await authenticateProjectRequest(request, id, ["GET"]);
  if (session === "forbidden") return json({ error: "That is not this project's." }, 403);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const run = request.nextUrl.searchParams.get("run") ?? "";
  // With no run named: what Tensor changed lately from comments on the site, for the chat.
  if (!run) {
    try {
      return json({ changes: await recentSiteChanges(session.admin, session.user.id, id) });
    } catch (error) {
      console.error("[Tensor Background] Reading recent changes failed", error);
      return json({ error: "Tensor could not read that." }, 503);
    }
  }
  if (!UUID.test(run)) return json({ error: "That request is invalid." }, 400);
  try {
    const row = await readBackgroundTurn(session.admin, session.user.id, run);
    if (!row || row.task_id !== id) return json({ error: "That run does not exist." }, 404);
    return json({
      run: {
        createdAt: row.created_at,
        error: row.error,
        finishedAt: row.finished_at,
        id: row.id,
        reply: row.reply,
        source: row.source,
        startedAt: row.started_at,
        status: row.status,
      },
    });
  } catch (error) {
    console.error("[Tensor Background] Reading a turn failed", error);
    return json({ error: "Tensor could not read that." }, 503);
  }
}
