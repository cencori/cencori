// "use client";

// import { useState, useEffect, useCallback } from "react";

// // ── Types ────────────────────────────────────────────────────────
// type ModelStatus = "available" | "degraded" | "unavailable";

// interface ModelHealth {
//   model: string;
//   provider: string;
//   status: ModelStatus;
//   latencyMs: number;
//   lastChecked: string;
//   uptime24h: number;
//   circuitBreaker: "closed" | "open" | "half-open";
// }

// interface Props {
//   projectId: string;
//   orgSlug: string;
//   projectSlug: string;
// }

// // ── Status style maps ─────────────────────────────────────────────
// const STATUS_STYLES: Record<
//   ModelStatus,
//   {
//     badge: string;
//     dot: string;
//     card: string;
//     label: string;
//   }
// > = {
//   available: {
//     badge: "bg-green-100 text-green-800",
//     dot: "bg-green-500",
//     card: "border-green-200",
//     label: "Available",
//   },
//   degraded: {
//     badge: "bg-yellow-100 text-yellow-800",
//     dot: "bg-yellow-500",
//     card: "border-yellow-200",
//     label: "Degraded",
//   },
//   unavailable: {
//     badge: "bg-red-100 text-red-800",
//     dot: "bg-red-500",
//     card: "border-red-200",
//     label: "Unavailable",
//   },
// };

// // ── Sort helper ───────────────────────────────────────────────────
// // Exported so unit tests can test sort order without rendering
// export function sortModelsByStatus(models: ModelHealth[]): ModelHealth[] {
//   const order: Record<ModelStatus, number> = {
//     unavailable: 0, // most urgent first
//     degraded: 1,
//     available: 2,
//   };
//   return [...models].sort((a, b) => order[a.status] - order[b.status]);
// }

// // ── Component ────────────────────────────────────────────────────
// export default function ModelAvailabilityDashboard({
//   projectId,
//   //orgSlug,
//   //projectSlug,
// }: Props) {
//   const [models, setModels] = useState<ModelHealth[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [countdown, setCountdown] = useState(30);
//   const [checking, setChecking] = useState<string | null>(null); // modelName being checked

//   const fetchModels = useCallback(async () => {
//     try {
//       const res = await fetch(`/api/projects/${projectId}/providers/health`);
//       if (!res.ok) throw new Error(`Request failed: ${res.status}`);
//       const data = await res.json();
//       setModels(sortModelsByStatus(data.models ?? []));
//       setError(null);
//     } catch (err: unknown) {
//       setError(
//         err instanceof Error ? err.message : "Failed to load health data",
//       );
//     } finally {
//       setLoading(false);
//     }
//   }, [projectId]);

//   // Initial fetch + auto-refresh every 30 seconds
//   useEffect(() => {
//     fetchModels();

//     const interval = setInterval(() => {
//       setCountdown((prev) => {
//         if (prev <= 1) {
//           fetchModels(); // refresh when countdown hits 0
//           return 30; // reset countdown
//         }
//         return prev - 1;
//       });
//     }, 1000);

//     return () => clearInterval(interval);
//   }, [fetchModels]);

//   const handleCheckNow = async (modelName: string, provider: string) => {
//     setChecking(modelName);
//     try {
//       const res = await fetch(`/api/projects/${projectId}/providers/health`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ modelName, provider }),
//       });
//       if (!res.ok) throw new Error("Check failed");
//       const data = await res.json();

//       // Update just this model in the list
//       setModels((prev) =>
//         sortModelsByStatus(
//           prev.map((m) => (m.model === modelName ? data.model : m)),
//         ),
//       );
//     } catch {
//       // Silently fail on manual check — the auto-refresh will correct it
//     } finally {
//       setChecking(null);
//     }
//   };

//   // ── Loading skeleton ──────────────────────────────────────────
//   if (loading) {
//     return (
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//         {[1, 2, 3, 4].map((i) => (
//           <div
//             key={i}
//             className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse"
//           >
//             <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
//             <div className="h-3 bg-gray-100 rounded w-1/3 mb-4" />
//             <div className="h-6 bg-gray-100 rounded w-1/2" />
//           </div>
//         ))}
//       </div>
//     );
//   }

//   // ── Error state ───────────────────────────────────────────────
//   if (error) {
//     return (
//       <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
//         <p className="text-red-600 text-sm mb-3">{error}</p>
//         <button
//           onClick={fetchModels}
//           className="px-4 py-2 bg-white border border-red-300 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
//         >
//           Retry
//         </button>
//       </div>
//     );
//   }

//   // ── Empty state ───────────────────────────────────────────────
//   if (models.length === 0) {
//     return (
//       <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
//         <p className="text-gray-500 text-sm">
//           No health data yet. The cron job checks every 2 minutes.
//         </p>
//       </div>
//     );
//   }

//   // ── Main render ───────────────────────────────────────────────
//   return (
//     <div>
//       {/* Header with countdown */}
//       <div className="flex items-center justify-between mb-6">
//         <p className="text-sm text-gray-500">
//           {models.length} model{models.length !== 1 ? "s" : ""} monitored
//         </p>
//         <p className="text-xs text-gray-400">Refreshing in {countdown}s</p>
//       </div>

//       {/* Model cards grid */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//         {models.map((model) => {
//           const s = STATUS_STYLES[model.status];
//           const isChecking = checking === model.model;

//           return (
//             <div
//               key={model.model}
//               className={`bg-white border rounded-xl p-5 transition-all duration-200 ${s.card}`}
//             >
//               {/* Model name + provider */}
//               <div className="flex items-start justify-between mb-3">
//                 <div>
//                   <h3 className="font-semibold text-sm text-gray-900 leading-tight">
//                     {model.model}
//                   </h3>
//                   <p className="text-xs text-gray-500 mt-0.5">
//                     {model.provider}
//                   </p>
//                 </div>

//                 {/* Status badge */}
//                 <span
//                   className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}
//                 >
//                   {/* Pulsing dot while checking, static dot otherwise */}
//                   <span
//                     className={`w-1.5 h-1.5 rounded-full ${s.dot} ${isChecking ? "animate-ping" : ""}`}
//                   />
//                   {isChecking ? "Checking…" : s.label}
//                 </span>
//               </div>

//               {/* Metrics row */}
//               <div className="flex items-center gap-4 mb-4">
//                 <div>
//                   <p className="text-[10px] text-gray-400 uppercase tracking-wide">
//                     Latency
//                   </p>
//                   <p className="text-sm font-mono font-medium text-gray-900">
//                     {model.latencyMs}ms
//                   </p>
//                 </div>
//                 <div>
//                   <p className="text-[10px] text-gray-400 uppercase tracking-wide">
//                     Uptime 24h
//                   </p>
//                   <p className="text-sm font-mono font-medium text-gray-900">
//                     {model.uptime24h}%
//                   </p>
//                 </div>
//                 <div>
//                   <p className="text-[10px] text-gray-400 uppercase tracking-wide">
//                     Circuit
//                   </p>
//                   <p className="text-xs text-gray-600 capitalize">
//                     {model.circuitBreaker}
//                   </p>
//                 </div>
//               </div>

//               {/* Latency bar (visual gauge) */}
//               <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
//                 <div
//                   className={`h-full rounded-full transition-all ${s.dot}`}
//                   style={{
//                     // Scale: 0ms = 0%, 3000ms = 100%
//                     width: `${Math.min((model.latencyMs / 3000) * 100, 100)}%`,
//                   }}
//                 />
//               </div>

//               {/* Footer: last checked + check now */}
//               <div className="flex items-center justify-between">
//                 <p className="text-[10px] text-gray-400">
//                   {new Date(model.lastChecked).toLocaleTimeString()}
//                 </p>
//                 <button
//                   onClick={() => handleCheckNow(model.model, model.provider)}
//                   disabled={isChecking}
//                   className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
//                 >
//                   {isChecking ? "Checking…" : "Check Now"}
//                 </button>
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────
type ModelStatus = "available" | "degraded" | "unavailable";

interface ModelHealth {
  model: string;
  provider: string;
  status: ModelStatus;
  latencyMs: number;
  lastChecked: string;
  uptime24h: number;
  circuitBreaker: "closed" | "open" | "half-open";
}

interface Props {
  projectId: string;
  orgSlug: string;
  projectSlug: string;
}

// ── Status style maps ─────────────────────────────────────────────
const STATUS_STYLES: Record<
  ModelStatus,
  {
    badge: string;
    dot: string;
    card: string;
    label: string;
  }
> = {
  available: {
    badge: "bg-green-100 text-green-800",
    dot: "bg-green-500",
    card: "border-green-200",
    label: "Available",
  },
  degraded: {
    badge: "bg-yellow-100 text-yellow-800",
    dot: "bg-yellow-500",
    card: "border-yellow-200",
    label: "Degraded",
  },
  unavailable: {
    badge: "bg-red-100 text-red-800",
    dot: "bg-red-500",
    card: "border-red-200",
    label: "Unavailable",
  },
};

// ── Sort helper ───────────────────────────────────────────────────
export function sortModelsByStatus(models: ModelHealth[]): ModelHealth[] {
  const order: Record<ModelStatus, number> = {
    unavailable: 0,
    degraded: 1,
    available: 2,
  };
  return [...models].sort((a, b) => order[a.status] - order[b.status]);
}

// ── Component ────────────────────────────────────────────────────
export default function ModelAvailabilityDashboard({
  projectId,
  //orgSlug,
  //projectSlug,
}: Props) {
  const [models, setModels] = useState<ModelHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [checking, setChecking] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    console.log(
      "[ModelAvailabilityDashboard] fetchModels called for projectId:",
      projectId,
    );

    try {
      const res = await fetch(`/api/projects/${projectId}/health`);

      console.log(
        "[ModelAvailabilityDashboard] API response status:",
        res.status,
      );

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = await res.json();

      console.log(
        "[ModelAvailabilityDashboard] Models received:",
        data.models?.length ?? 0,
      );
      data.models?.forEach((m: ModelHealth) => {
        console.log(
          `[ModelAvailabilityDashboard]   ${m.model}: ${m.status} (${m.latencyMs}ms, ${m.uptime24h}% uptime)`,
        );
      });

      const sorted = sortModelsByStatus(data.models ?? []);
      console.log(
        "[ModelAvailabilityDashboard] Sorted order:",
        sorted.map((m) => `${m.model}(${m.status})`).join(" → "),
      );

      setModels(sorted);
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load health data";
      console.error("[ModelAvailabilityDashboard] Fetch failed:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial fetch + auto-refresh every 30 seconds
  useEffect(() => {
    console.log(
      "[ModelAvailabilityDashboard] Component mounted — starting auto-refresh interval",
    );
    fetchModels();

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          console.log(
            "[ModelAvailabilityDashboard] Countdown reached zero — auto-refreshing...",
          );
          fetchModels();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      console.log(
        "[ModelAvailabilityDashboard] Component unmounting — clearing interval",
      );
      clearInterval(interval);
    };
  }, [fetchModels]);

  const handleCheckNow = async (modelName: string, provider: string) => {
    console.log(
      `[ModelAvailabilityDashboard] Check Now clicked for: ${modelName} (${provider})`,
    );
    setChecking(modelName);

    try {
      const res = await fetch(`/api/projects/${projectId}/health`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelName, provider }),
      });

      console.log(
        "[ModelAvailabilityDashboard] POST response status:",
        res.status,
      );

      if (!res.ok) throw new Error("Check failed");

      const data = await res.json();

      console.log(
        `[ModelAvailabilityDashboard] Manual check result for ${modelName}:`,
        data.model?.status,
        `(${data.model?.latencyMs}ms)`,
      );

      setModels((prev) =>
        sortModelsByStatus(
          prev.map((m) => (m.model === modelName ? data.model : m)),
        ),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ModelAvailabilityDashboard] Check Now failed:", message);
    } finally {
      setChecking(null);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    console.log("[ModelAvailabilityDashboard] Rendering loading skeleton");
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse"
          >
            <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-1/3 mb-4" />
            <div className="h-6 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────
  if (error) {
    console.log("[ModelAvailabilityDashboard] Rendering error state:", error);
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 text-sm mb-3">{error}</p>
        <button
          onClick={fetchModels}
          className="px-4 py-2 bg-white border border-red-300 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────
  if (models.length === 0) {
    console.log(
      "[ModelAvailabilityDashboard] Rendering empty state — no models found",
    );
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
        <p className="text-gray-500 text-sm">
          No health data yet. The cron job checks every 2 minutes.
        </p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────
  console.log(
    `[ModelAvailabilityDashboard] Rendering ${models.length} model cards, countdown: ${countdown}s`,
  );

  return (
    <div>
      {/* Header with countdown */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">
          {models.length} model{models.length !== 1 ? "s" : ""} monitored
        </p>
        <p className="text-xs text-gray-400">Refreshing in {countdown}s</p>
      </div>

      {/* Model cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((model) => {
          const s = STATUS_STYLES[model.status];
          const isChecking = checking === model.model;

          return (
            <div
              key={model.model}
              className={`bg-white border rounded-xl p-5 transition-all duration-200 ${s.card}`}
            >
              {/* Model name + provider */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm text-gray-900 leading-tight">
                    {model.model}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {model.provider}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${s.dot} ${isChecking ? "animate-ping" : ""}`}
                  />
                  {isChecking ? "Checking…" : s.label}
                </span>
              </div>

              {/* Metrics row */}
              <div className="flex items-center gap-4 mb-4">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                    Latency
                  </p>
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {model.latencyMs}ms
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                    Uptime 24h
                  </p>
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {model.uptime24h}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                    Circuit
                  </p>
                  <p className="text-xs text-gray-600 capitalize">
                    {model.circuitBreaker}
                  </p>
                </div>
              </div>

              {/* Latency bar */}
              <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${s.dot}`}
                  style={{
                    width: `${Math.min((model.latencyMs / 3000) * 100, 100)}%`,
                  }}
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-400">
                  {new Date(model.lastChecked).toLocaleTimeString()}
                </p>
                <button
                  onClick={() => handleCheckNow(model.model, model.provider)}
                  disabled={isChecking}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isChecking ? "Checking…" : "Check Now"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
