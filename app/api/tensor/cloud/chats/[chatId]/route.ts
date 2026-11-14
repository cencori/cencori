import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { FlyMachines, readTensorCloudConfig } from "@/lib/tensor-cloud";
import {
  deleteChatRow,
  destroyTask,
  isThreadId,
  readChat,
  readTask,
  setChatThread,
  touchChat,
} from "@/lib/tensor-cloud-tasks";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * Notes what just happened in a chat: its runtime thread, the first time there is one, and that
 * it is the most recently used.
 *
 * The thread id comes from the page, which got it from the sandbox. It is only ever used to ask
 * that same account's own sandbox for a conversation, so a made-up one opens nothing.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ chatId: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }

  try {
    const chat = await readChat(session.admin, session.user.id, (await context.params).chatId);
    if (!chat) return json({ error: "That chat does not exist." }, 404);

    if (body.threadId !== undefined) {
      if (!isThreadId(body.threadId)) return json({ error: "That request is invalid." }, 400);
      await setChatThread(session.admin, chat.id, body.threadId);
    } else {
      await touchChat(session.admin, chat.id);
    }
    return json({ ok: true });
  } catch (error) {
    console.error("[Tensor Cloud] Updating a chat failed", error);
    return json({ error: "Tensor could not update this chat." }, 503);
  }
}

/**
 * Deletes a chat.
 *
 * In a project, only the conversation goes: the project and its files stay, with its other chats.
 * A plain chat is its whole workspace, so deleting it destroys the sandbox and what was built in
 * it. Deleting a project itself is the task's own DELETE.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ chatId: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Tensor on the web is not available yet." }, 503);

  try {
    const chat = await readChat(session.admin, session.user.id, (await context.params).chatId);
    if (!chat) return json({ error: "That chat does not exist." }, 404);
    const task = await readTask(session.admin, session.user.id, chat.task_id);

    if (task && !task.project_name) {
      await destroyTask(session.admin, new FlyMachines(config), task);
      return json({ deleted: true, workspace: true });
    }
    await deleteChatRow(session.admin, chat.id);
    return json({ deleted: true, workspace: false });
  } catch (error) {
    console.error("[Tensor Cloud] Deleting a chat failed", error);
    return json({ error: "Tensor could not delete this chat." }, 503);
  }
}
