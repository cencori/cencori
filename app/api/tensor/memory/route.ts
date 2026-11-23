import { NextRequest } from "next/server";
import { forgetEverything, forgetMemory, listMemories, setMemoryEnabled } from "@/lib/tensor-memory";
import { authenticateTensorDataRequest } from "@/lib/tensor-data";
import { memoryJson } from "@/lib/tensor-memory-request";

/**
 * The person's own view of Tensor's memory (Settings, Memory on the web):
 *
 *   GET     everything remembered, about them and about each project, and whether memory is on
 *   PATCH   `{ enabled }` turns memory on or off
 *   DELETE  `?id=mem_…` forgets one fact; `?all=1` forgets everything, chats' record included
 */
async function session(request: NextRequest) {
  return authenticateTensorDataRequest(request.headers.get("authorization"));
}

export async function GET(request: NextRequest) {
  const signedIn = await session(request);
  if (!signedIn) return memoryJson({ error: "Your Cencori session is invalid." }, 401);
  try {
    return memoryJson(await listMemories(signedIn.admin, signedIn.user.id));
  } catch (error) {
    console.error("[Tensor Memory] Listing memories failed", error);
    return memoryJson({ error: "Tensor could not read its memory just now." }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const signedIn = await session(request);
  if (!signedIn) return memoryJson({ error: "Your Cencori session is invalid." }, 401);
  let enabled: unknown;
  try {
    ({ enabled } = (await request.json()) as { enabled?: unknown });
  } catch {
    return memoryJson({ error: "That request is invalid." }, 400);
  }
  if (typeof enabled !== "boolean") return memoryJson({ error: "Say whether memory is on." }, 400);
  try {
    await setMemoryEnabled(signedIn.admin, signedIn.user.id, enabled);
    return memoryJson({ enabled });
  } catch (error) {
    console.error("[Tensor Memory] Changing the memory setting failed", error);
    return memoryJson({ error: "Tensor could not change this just now." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  const signedIn = await session(request);
  if (!signedIn) return memoryJson({ error: "Your Cencori session is invalid." }, 401);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  try {
    if (url.searchParams.get("all") === "1") {
      await forgetEverything(signedIn.admin, signedIn.user.id);
      return memoryJson({ forgotten: true });
    }
    if (!id || !/^(mem_)?[0-9a-f-]{36}$/i.test(id)) return memoryJson({ error: "Say which memory to forget." }, 400);
    return memoryJson({ forgotten: await forgetMemory(signedIn.admin, signedIn.user.id, id) });
  } catch (error) {
    console.error("[Tensor Memory] Forgetting failed", error);
    return memoryJson({ error: "Tensor could not forget this just now." }, 503);
  }
}
