import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { createPlainChat, listPlainChats, plainChatJson, titleFromMessage } from "@/lib/tensor-chats";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/** The account's plain chats, most recently used first. */
export async function GET(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  try {
    const chats = await listPlainChats(session.admin, session.user.id);
    return json({ chats: chats.map(plainChatJson) });
  } catch (error) {
    console.error("[Tensor Chats] Listing chats failed", error);
    return json({ error: "Tensor could not load your chats." }, 503);
  }
}

/**
 * Starts a plain chat. Every account may: a plain chat runs no sandbox, and each answer is billed
 * by what it costs against the plan's month, the trial's included.
 */
export async function POST(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  let body: { title?: unknown } = {};
  try {
    body = (await request.json()) as { title?: unknown };
  } catch {
    // No body is a chat with no name yet; its first message names it.
  }
  const title = typeof body.title === "string" && body.title.trim() ? titleFromMessage(body.title) : null;
  try {
    const chat = await createPlainChat(session.admin, session.user.id, title);
    return json({ chat: plainChatJson(chat) }, 201);
  } catch (error) {
    console.error("[Tensor Chats] Creating a chat failed", error);
    return json({ error: "Tensor could not start a chat." }, 503);
  }
}
