import { createAdminClient } from "@/lib/supabaseAdmin";

export type AuditCategory =
  | "project"
  | "api_key"
  | "agent"
  | "member"
  | "security"
  | "billing"
  | "provider"
  | "webhook"
  | "sso"
  | "settings"
  | "budget"
  | "prompt"
  | "cache"
  | "integration"
  | "memory"
  | "export"
  | "rate_plan"
  | "end_user";

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "revoked"
  | "activated"
  | "deactivated"
  | "configured"
  | "removed"
  | "exported"
  | "invited"
  | "joined"
  | "left"
  | "role_changed"
  | "tier_changed"
  | "topup"
  | "enforced"
  | "deployed"
  | "reviewed";

export type AuditActorType = "user" | "system" | "api" | "webhook";

export interface AuditLogEntry {
  organizationId: string;
  projectId?: string | null;
  category: AuditCategory;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  actorIp?: string | null;
  actorType?: AuditActorType;
  description: string;
  metadata?: Record<string, unknown>;
}

function toRow(entry: AuditLogEntry) {
  return {
    organization_id: entry.organizationId,
    project_id: entry.projectId ?? null,
    category: entry.category,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    actor_id: entry.actorId ?? null,
    actor_email: entry.actorEmail ?? null,
    actor_ip: entry.actorIp ?? null,
    actor_type: entry.actorType ?? "user",
    description: entry.description,
    metadata: entry.metadata ?? null,
  };
}

/** Fire-and-forget — never throws, never blocks. */
export function writeAuditLog(entry: AuditLogEntry): void {
  try {
    const supabase = createAdminClient();
    Promise.resolve(
      supabase.from("audit_logs").insert(toRow(entry))
    ).then(({ error }) => {
      if (error) {
        console.error("[AuditLog] Failed to write audit log:", error.message);
      }
    }).catch((err: unknown) => {
      console.error("[AuditLog] Unexpected error:", err);
    });
  } catch (err) {
    console.error("[AuditLog] Unexpected error:", err);
  }
}

/** Awaitable version for critical paths that need confirmation. */
export async function writeAuditLogAsync(
  entry: AuditLogEntry
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("audit_logs").insert(toRow(entry));
  if (error) {
    console.error("[AuditLog] Failed to write audit log:", error.message);
    throw error;
  }
}

/** Convenience helper to extract actor fields from a user object. */
export function getAuditActor(
  user: { id: string; email?: string },
  ip?: string | null
) {
  return {
    actorId: user.id,
    actorEmail: user.email ?? null,
    actorIp: ip ?? null,
  };
}
