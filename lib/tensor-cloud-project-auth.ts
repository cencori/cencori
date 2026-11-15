import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { authenticateTensorCloudTask } from "@/lib/tensor-cloud-tasks";

/**
 * Who is asking about a project: its owner, signed in, or the project's own agent.
 *
 * The agent works inside the project's machine, which holds the project's credential (the task
 * token it makes model calls with). With it, the agent can do some of what the owner can do with
 * the project's settings, so that someone can ask Tensor to "make it live" and have it done. It
 * acts only for the project the credential is for, and only in the ways a route lets it
 * (`agentMethods`): it may publish and push, but not unpublish, delete, or connect a repository.
 *
 * Returns null for no one, "forbidden" for the agent asking for something it may not do.
 */
export async function authenticateProjectRequest(
  request: NextRequest,
  taskId: string,
  agentMethods: readonly string[],
): Promise<{ admin: ReturnType<typeof createAdminClient>; user: { id: string }; agent: boolean } | "forbidden" | null> {
  const admin = createAdminClient();
  const agent = await authenticateTensorCloudTask(admin, request.headers.get("authorization"));
  if (agent === null) return null;
  if (agent) {
    if (agent.taskId !== taskId || !agentMethods.includes(request.method)) return "forbidden";
    return { admin, user: { id: agent.userId }, agent: true };
  }
  const session = await authenticateTensorBillingRequest(request);
  return session ? { admin: session.admin, user: { id: session.user.id }, agent: false } : null;
}
