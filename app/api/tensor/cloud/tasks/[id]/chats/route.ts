import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { normalizeTaskTitle, readTensorCloudConfig } from "@/lib/tensor-cloud";
import {
  chatJson,
  countChats,
  insertChat,
  MAX_CHATS_PER_TASK,
  readCloudAccess,
  readTask,
} from "@/lib/tensor-cloud-tasks";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * Starts another chat in a project.
 *
 * Nothing is created on Fly: the chat shares the project's sandbox and files, and becomes its
 * own thread in the agent runtime when its first message is sent. So this is only a row, and the
 * project's machine is woken, if it sleeps, when the chat is opened.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  if (!readTensorCloudConfig()) return json({ error: "Tensor on the web is not available yet." }, 503);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }

  try {
    const task = await readTask(session.admin, session.user.id, (await context.params).id);
    if (!task || task.status === "failed") return json({ error: "That project does not exist." }, 404);
    // More than one conversation over the same files is what a project is for. A plain chat's
    // workspace holds that chat alone.
    if (!task.project_name) {
      return json({ error: "Only a project can hold more than one chat." }, 409);
    }
    if (!(await readCloudAccess(session.admin, session.user.id)).tasks) {
      return json(
        { error: "Tensor on the web is part of Tensor's paid plans. Choose a plan to continue.", code: "plan_required" },
        402,
      );
    }
    if ((await countChats(session.admin, task.id)) >= MAX_CHATS_PER_TASK) {
      return json(
        { error: "This project has reached the number of chats it can hold. Delete one to start another.", code: "chat_limit" },
        409,
      );
    }

    const chat = await insertChat(session.admin, {
      taskId: task.id,
      userId: session.user.id,
      title: normalizeTaskTitle(body.title),
    });
    return json({ chat: chatJson(chat, task) }, 201);
  } catch (error) {
    console.error("[Tensor Cloud] Starting a chat in a project failed", error);
    return json({ error: "Tensor could not start this chat." }, 503);
  }
}
