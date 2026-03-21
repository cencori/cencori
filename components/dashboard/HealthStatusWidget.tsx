// components/dashboard/HealthStatusWidget.tsx
"use client";

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────
type ServiceStatus = "healthy" | "degraded" | "down";

interface ServiceHealth {
  status: ServiceStatus;
  latencyMs: number;
  error?: string;
}

interface HealthData {
  status: ServiceStatus;
  timestamp: string;
  services: {
    database: ServiceHealth;
    aiGateway: ServiceHealth;
    memory: ServiceHealth;
  };
  summary: string;
}

// ── Status helpers ─────────────────────────────────────────────
const STATUS_LABEL: Record<ServiceStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
};

// Card colour sets per status
const STATUS_STYLES: Record<
  ServiceStatus,
  {
    card: string;
    dot: string;
    ring: string;
  }
> = {
  healthy: {
    card: "bg-green-50 border-green-200",
    dot: "bg-green-600",
    ring: "ring-green-200",
  },
  degraded: {
    card: "bg-yellow-50 border-yellow-200",
    dot: "bg-yellow-500",
    ring: "ring-yellow-200",
  },
  down: {
    card: "bg-red-50 border-red-200",
    dot: "bg-red-600",
    ring: "ring-red-200",
  },
};

// A service is 'degraded' if its status says so OR if latency is high
function resolveStatus(service: ServiceHealth): ServiceStatus {
  if (service.status === "down") return "down";
  if (service.latencyMs > 500) return "degraded";
  return service.status;
}

// ── Main Component ─────────────────────────────────────────────
export default function HealthStatusWidget() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false); // controls fade-in

  async function fetchHealth() {
    setLoading(true);
    setError(null);
    setVisible(false);

    try {
      const res = await fetch("/api/health/detailed");
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json: HealthData = await res.json();
      setData(json);
      setTimeout(() => setVisible(true), 50);
    } catch {
      setError("Could not load health data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
  }, []);

  // ── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {/* Skeleton bars */}
        <div
          className="h-4 bg-gray-100 rounded w-full mb-3 animate-pulse"
          aria-label="Loading health data..."
        />
        <div className="h-4 bg-gray-100 rounded w-4/5 mb-4 animate-pulse" />
        {/* Skeleton cards */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-red-600 text-sm mb-3">{error}</p>
        <button
          onClick={fetchHealth}
          className="px-4 py-1.5 rounded-md border border-gray-300 bg-white text-sm text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────
  const serviceEntries = [
    { key: "database", label: "Database" },
    { key: "aiGateway", label: "AI Gateway" },
    { key: "memory", label: "Memory" },
  ] as const;

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-6 transition-all duration-300 ease-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 m-0">
          System Health
        </h3>
        <button
          onClick={fetchHealth}
          className="px-3.5 py-1.5 rounded-md border border-gray-300 bg-white text-sm text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* AI Summary Banner */}
      {data?.summary && (
        <div className="flex gap-2.5 items-start bg-blue-50 border-l-4 border-blue-500 rounded-md px-3.5 py-3 mb-5">
          <span className="text-blue-500 text-xs mt-0.5">✦</span>
          <p className="m-0 text-sm text-gray-600 leading-relaxed">
            {data.summary}
          </p>
        </div>
      )}

      {/* Service Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4 sm:grid-cols-1 md:grid-cols-3">
        {serviceEntries.map(({ key, label }) => {
          const service = data!.services[key];
          const status = resolveStatus(service);
          const s = STATUS_STYLES[status];

          return (
            <div
              key={key}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-lg border ${s.card}`}
            >
              {/* Status dot */}
              <span
                aria-hidden="true"
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ring-4 ${s.dot} ${s.ring}`}
              />

              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-sm text-gray-900">
                  {label}
                </span>
                <span className="text-xs text-gray-500">
                  {STATUS_LABEL[status]}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {service.latencyMs}ms
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timestamp */}
      {data?.timestamp && (
        <p className="text-xs text-gray-400 m-0">
          Last checked: {new Date(data.timestamp).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
