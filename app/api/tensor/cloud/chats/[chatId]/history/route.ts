import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { cleanHistory } from "@/lib/tensor-cloud-history";
import { readChat } from "@/lib/tensor-cloud-tasks";

/**
 * A project chat's conversation as last seen (lib/tensor-cloud-history.ts): read when the chat is
 * opened, so it shows at once, and while its sandbox cannot be started; replaced when a turn ends.
 */

const TABLE = "tensor_cloud_chat_history";
/** A request body larger than this is not a conversation the page would send. */
const MAX_BODY = 4_000_000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

export async function GET(request: NextRequest, context: { params: Promise<{ chatId: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  try {
    const chat = await readChat(session.admin, session.user.id, (await context.params).chatId);
    if (!chat) return json({ error: "That chat does not exist." }, 404);
    const { data, error } = await session.admin.from(TABLE).select("items, updated_at").eq("chat_id", chat.id).maybeSingle();
    if (error) throw error;
    return json({ items: data?.items ?? [], updatedAt: data?.updated_at ?? null });
  } catch (error) {
    console.error("[Tensor Cloud] Reading a chat's history failed", error);
    return json({ error: "Tensor could not read this chat." }, 503);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ chatId: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return json({ error: "That conversation is too large to keep." }, 413);
  let body: { items?: unknown };
  try {
    body = (await request.json()) as { items?: unknown };
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }
  try {
    const chat = await readChat(session.admin, session.user.id, (await context.params).chatId);
    if (!chat) return json({ error: "That chat does not exist." }, 404);
    const items = cleanHistory(body.items);
    const { error } = await session.admin
      .from(TABLE)
      .upsert({ chat_id: chat.id, user_id: session.user.id, items, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
    if (error) throw error;
    return json({ saved: items.length });
  } catch (error) {
    console.error("[Tensor Cloud] Keeping a chat's history failed", error);
    return json({ error: "Tensor could not keep this chat." }, 503);
  }
}
