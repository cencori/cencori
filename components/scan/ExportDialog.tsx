"use client";

import { useState, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────
type ExportFormat = "csv" | "json" | "pdf";

interface Props {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

const FORMAT_OPTIONS: {
  value: ExportFormat;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "csv",
    label: "CSV",
    description: "Flat table — opens in Excel & Google Sheets",
    icon: "📊",
  },
  {
    value: "json",
    label: "JSON",
    description: "Structured data for developers and pipelines",
    icon: "{ }",
  },
  {
    value: "pdf",
    label: "PDF",
    description: "Formatted report with AI executive summary",
    icon: "📄",
  },
];

// ── Component ────────────────────────────────────────────────────
export default function ExportDialog({ projectId, isOpen, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [includeAi, setIncludeAi] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormat("csv");
      setIncludeAi(true);
      setLoading(false);
      setSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleDownload() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ format });
      if (format === "pdf") params.set("aiSummary", String(includeAi));

      const response = await fetch(
        `/api/scan/projects/${projectId}/exports?${params}`,
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error: ${response.status}`);
      }

      // Convert the response to a Blob and trigger a browser Save dialog
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const fileName = `scan-export-${projectId}.${format}`;

      // Create a temporary hidden <a> and click it
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl); // free memory

      setSuccess(true);

      // Auto-close after showing success for 2 seconds
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Export failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          zIndex: 50,
          transform: "translate(-50%, -50%)",
          background: "#fff",
          borderRadius: 12,
          padding: 28,
          width: 440,
          maxWidth: "95vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, color: "#1A1A1A" }}>
            Export Scan Results
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#888",
            }}
          >
            ✕
          </button>
        </div>

        {/* Format selector */}
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            color: "#555",
            fontWeight: 600,
          }}
        >
          SELECT FORMAT
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 20,
          }}
        >
          {FORMAT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 8,
                cursor: "pointer",
                border:
                  format === opt.value
                    ? "2px solid black"
                    : "2px solid #e5e7eb",
                background: format === opt.value ? "#EEEEEE" : "#fff",
                transition: "all 0.15s",
              }}
            >
              <input
                type="radio"
                name="format"
                value={opt.value}
                checked={format === opt.value}
                onChange={() => setFormat(opt.value)}
                style={{ display: "none" }}
              />
              <span style={{ fontSize: 20 }}>{opt.icon}</span>
              <div>
                <div
                  style={{ fontWeight: 600, fontSize: 14, color: "#1A1A1A" }}
                >
                  {opt.label}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {opt.description}
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* AI Summary toggle — PDF only */}
        {format === "pdf" && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={includeAi}
              onChange={(e) => setIncludeAi(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                Include AI Executive Summary
              </span>
              <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>
                (recommended)
              </span>
            </div>
          </label>
        )}

        {/* Error banner */}
        {error && (
          <div
            style={{
              background: "#FDECEA",
              border: "1px solid #fecaca",
              borderRadius: 6,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: "#7A1515",
            }}
          >
            {error}
          </div>
        )}

        {/* Success state */}
        {success ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <p style={{ margin: 0, fontWeight: 600, color: "#1A5C2E" }}>
              Export ready!
            </p>
          </div>
        ) : (
          <button
            onClick={handleDownload}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 8,
              border: "none",
              background: loading ? "grey" : "black",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 16,
                    height: 16,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Generating…
              </>
            ) : (
              <> Download {format.toUpperCase()}</>
            )}
          </button>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
