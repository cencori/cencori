/**
 * Runs once when the server starts (Next.js instrumentation). In production it starts the sweep
 * that takes up Tensor's background turns and comments left behind by a restart
 * (lib/tensor-background-sweep.ts). Set TENSOR_BACKGROUND_SWEEP=off to keep a server out of it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.TENSOR_BACKGROUND_SWEEP === "off") return;
  // `next build` loads this too; only a running server sweeps.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startBackgroundSweep } = await import("./lib/tensor-background-sweep");
  startBackgroundSweep();
}
