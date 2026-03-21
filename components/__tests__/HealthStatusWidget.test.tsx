import { render } from "@testing-library/react";
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import HealthStatusWidget from "@/components/dashboard/HealthStatusWidget";
import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";

// Mock global fetch — we never want to hit a real API in component tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper: build a fake health API response
function makeHealthResponse(overrides = {}) {
  return {
    status: "healthy",
    timestamp: "2026-03-06T12:00:00Z",
    summary: "All systems are running smoothly.",
    services: {
      database: { status: "healthy", latencyMs: 12 },
      aiGateway: { status: "healthy", latencyMs: 45 },
      memory: { status: "healthy", latencyMs: 23 },
    },
    ...overrides,
  };
}

// Helper: make fetch return a specific response object
function mockFetchResponse(data: object, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  });
}

describe("HealthStatusWidget", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Loading state ──────────────────────────────────────────

  test("shows loading skeleton before data arrives", () => {
    // Don't resolve fetch — component is stuck in loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    render(<HealthStatusWidget />);
    expect(screen.getByLabelText("Loading health data...")).toBeInTheDocument();
  });

  // ── Success state ──────────────────────────────────────────

  test("renders all three service cards when healthy", async () => {
    mockFetchResponse(makeHealthResponse());
    render(<HealthStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText("Database")).toBeInTheDocument();
      expect(screen.getByText("AI Gateway")).toBeInTheDocument();
      expect(screen.getByText("Memory")).toBeInTheDocument();
    });
  });

  test("shows the AI summary text", async () => {
    mockFetchResponse(makeHealthResponse());
    render(<HealthStatusWidget />);

    await waitFor(() => {
      expect(
        screen.getByText("All systems are running smoothly."),
      ).toBeInTheDocument();
    });
  });

  test('shows "Healthy" labels when all services are healthy', async () => {
    mockFetchResponse(makeHealthResponse());
    render(<HealthStatusWidget />);

    await waitFor(() => {
      const healthyLabels = screen.getAllByText("Healthy");
      expect(healthyLabels).toHaveLength(3);
    });
  });

  test('shows "Degraded" for a service with latencyMs > 500', async () => {
    mockFetchResponse(
      makeHealthResponse({
        services: {
          database: { status: "healthy", latencyMs: 12 },
          aiGateway: { status: "healthy", latencyMs: 750 }, // slow!
          memory: { status: "healthy", latencyMs: 23 },
        },
      }),
    );
    render(<HealthStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText("Degraded")).toBeInTheDocument();
    });
  });

  test('shows "Down" for a service that is down', async () => {
    mockFetchResponse(
      makeHealthResponse({
        services: {
          database: { status: "down", latencyMs: 0 },
          aiGateway: { status: "healthy", latencyMs: 45 },
          memory: { status: "healthy", latencyMs: 23 },
        },
      }),
    );
    render(<HealthStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText("Down")).toBeInTheDocument();
    });
  });

  // ── Refresh ────────────────────────────────────────────────

  test("clicking Refresh triggers a second fetch", async () => {
    mockFetchResponse(makeHealthResponse()); // first fetch (on mount)
    mockFetchResponse(makeHealthResponse()); // second fetch (on refresh)
    render(<HealthStatusWidget />);

    await waitFor(() => screen.getByText("Refresh"));
    fireEvent.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ── Error state ────────────────────────────────────────────

  test("shows error message when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    render(<HealthStatusWidget />);

    await waitFor(() => {
      expect(
        screen.getByText(/could not load health data/i),
      ).toBeInTheDocument();
    });
  });

  test('shows "Try Again" button on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    render(<HealthStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });
  });
});
