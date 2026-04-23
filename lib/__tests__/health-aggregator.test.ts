import { aggregateHealthData } from "@/app/api/health/detailed/route";
import { describe, expect, test } from "vitest";

// Helper to build a service health object quickly
function makeService(status: "healthy" | "degraded" | "down", latencyMs = 100) {
  return { status, latencyMs };
}

describe("aggregateHealthData", () => {
  test('returns "healthy" when all services are healthy', () => {
    const services = {
      database: makeService("healthy", 12),
      aiGateway: makeService("healthy", 45),
      memory: makeService("healthy", 23),
    };
    expect(aggregateHealthData(services)).toBe("healthy");
  });

  test('returns "degraded" when one service is degraded', () => {
    const services = {
      database: makeService("healthy", 12),
      aiGateway: makeService("degraded", 600), // slow
      memory: makeService("healthy", 23),
    };
    expect(aggregateHealthData(services)).toBe("degraded");
  });

  test('returns "down" when one service is down', () => {
    const services = {
      database: makeService("healthy", 12),
      aiGateway: makeService("down", 0),
      memory: makeService("healthy", 23),
    };
    expect(aggregateHealthData(services)).toBe("down");
  });

  test('returns "down" when ALL services are down', () => {
    const services = {
      database: makeService("down", 0),
      aiGateway: makeService("down", 0),
      memory: makeService("down", 0),
    };
    expect(aggregateHealthData(services)).toBe("down");
  });

  test('"down" takes priority over "degraded"', () => {
    const services = {
      database: makeService("degraded", 600),
      aiGateway: makeService("down", 0),
      memory: makeService("healthy", 23),
    };
    // Even though database is only degraded, one 'down' makes overall 'down'
    expect(aggregateHealthData(services)).toBe("down");
  });
});
