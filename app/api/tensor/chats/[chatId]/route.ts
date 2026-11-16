import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { normalizeTaskTitle } from "@/lib/tensor-cloud";
import { readTask } from "@/lib/tensor-cloud-tasks";
import {
  deletePlainChat,
  isUuid,
  plainChatJson,
  plainMessageJson,
  readPlainChat,
  readPlainMessages,
  updatePlainChat,
} from "@/lib/tensor-chats";

type Context = { params: Promise<{ chatId: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/** A plain chat and its messages, in order. */
export async function GET(request: NextRequest, context: Context) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  try {
    const chat = await readPlainChat(session.admin, session.user.id, (await context.params).chatId);
    if (!chat) return json({ error: "That chat does not exist." }, 404);
    const messages = await readPlainMessages(session.admin, chat.id);
    return json({ chat: plainChatJson(chat), messages: messages.map(plainMessageJson) });
  } catch (error) {
    console.error("[Tensor Chats] Reading a chat failed", error);
    return json({ error: "Tensor could not load this chat." }, 503);
  }
}

/** Renames a plain chat, archives it or brings it back, or records the project it was turned into. */
export async function PATCH(request: NextRequest, context: Context) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }
  try {
    const chat = await readPlainChat(session.admin, session.user.id, (await context.params).chatId);
    if (!chat) return json({ error: "That chat does not exist." }, 404);
    if (body.title !== undefined) {
      const title = normalizeTaskTitle(body.title);
      if (!title) return json({ error: "A chat needs a name." }, 400);
      await updatePlainChat(session.admin, chat.id, { title });
      return json({ ok: true, title });
    }
    // The project this chat was turned into: one of this account's own.
    if (body.projectTaskId !== undefined) {
      const taskId = body.projectTaskId;
      if (!isUuid(taskId)) return json({ error: "That request is invalid." }, 400);
      const task = await readTask(session.admin, session.user.id, taskId);
      if (!task?.project_name) return json({ error: "That project does not exist." }, 404);
      await updatePlainChat(session.admin, chat.id, { projectTaskId: taskId });
      return json({ ok: true });
    }
    if (body.archived !== undefined) {
      if (typeof body.archived !== "boolean") return json({ error: "That request is invalid." }, 400);
      await updatePlainChat(session.admin, chat.id, { archived: body.archived });
      return json({ ok: true });
    }
    return json({ error: "That request is invalid." }, 400);
  } catch (error) {
    console.error("[Tensor Chats] Updating a chat failed", error);
    return json({ error: "Tensor could not update this chat." }, 503);
  }
}

/** Deletes a plain chat and its messages. */
export async function DELETE(request: NextRequest, context: Context) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  try {
    const chat = await readPlainChat(session.admin, session.user.id, (await context.params).chatId);
    if (!chat) return json({ error: "That chat does not exist." }, 404);
    await deletePlainChat(session.admin, chat.id);
    return json({ ok: true });
  } catch (error) {
    console.error("[Tensor Chats] Deleting a chat failed", error);
    return json({ error: "Tensor could not delete this chat." }, 503);
  }
}
