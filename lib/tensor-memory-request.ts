import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorCloudTask } from "@/lib/tensor-cloud-tasks";
import { authenticateTensorDataRequest } from "@/lib/tensor-data";
import type { TurnPlace } from "@/lib/tensor-memory";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Who is asking memory for something: a cloud task's sandbox (its token names the person and the
 * project), or a signed-in app acting for the person alone (no project).
 */
export type MemoryCaller = { admin: Admin; userId: string; taskId: string | null };

export async function memoryCaller(authorization: string | null): Promise<MemoryCaller | null> {
  const admin = createAdminClient();
  const task = await authenticateTensorCloudTask(admin, authorization);
  if (task) return { admin, userId: task.userId, taskId: task.taskId };
  if (task === null) return null;
  const session = await authenticateTensorDataRequest(authorization);
  return session ? { admin: session.admin, userId: session.user.id, taskId: null } : null;
}

/** Where a sandbox's thread is: its project, and the runtime's id for the conversation. */
export function threadPlace(caller: MemoryCaller, threadId: unknown): TurnPlace | null {
  if (!caller.taskId || typeof threadId !== "string") return null;
  const thread = threadId.trim().slice(0, 120);
  return thread ? { kind: "project", taskId: caller.taskId, threadId: thread } : null;
}

export function memoryJson(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

export function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
