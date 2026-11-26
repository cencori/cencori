import "server-only";

import { createAdminClient } from "@/lib/supabaseAdmin";
import { adoptOrphanedTurns } from "@/lib/tensor-background-turn";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import { sweepQualityInbox } from "@/lib/tensor-quality-inbox";

/**
 * Once a minute, on every server (started from instrumentation.ts): turns and comments that the
 * server holding them dropped (a deploy, a restart) are taken up again. Turns are claimed one by
 * one, so servers running side by side during a deploy never take the same one.
 */

const EVERY_MS = 60_000;
/** A moment after start, so a deploy's new server is serving before it takes anything on. */
const FIRST_AFTER_MS = 20_000;

let started = false;

export function startBackgroundSweep(): void {
  if (started) return;
  started = true;
  const sweep = async () => {
    const cloud = readTensorCloudConfig();
    if (!cloud) return;
    const admin = createAdminClient();
    try {
      const adopted = await adoptOrphanedTurns(admin, cloud);
      if (adopted) console.info(`[Tensor Background] Took up ${adopted} turn(s) left by another server`);
      await sweepQualityInbox(admin, cloud);
    } catch (error) {
      console.error("[Tensor Background] Sweep failed", error);
    }
  };
  setTimeout(() => {
    void sweep();
    setInterval(() => void sweep(), EVERY_MS).unref?.();
  }, FIRST_AFTER_MS).unref?.();
}
