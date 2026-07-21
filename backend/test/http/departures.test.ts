import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/create-app.js";
import {
  AllLiveboardsFailedError,
  type DepartureSearchService,
} from "../../src/departures/search-departures.js";
import type { DepartureSearchResult } from "../../src/domain/search-result.js";
import { IRailError } from "../../src/irail/irail-errors.js";
import type { Logger } from "../../src/logging/logger.js";

const completeResult: DepartureSearchResult = {
  query: "Bru",
  window: {
    from: new Date("2026-07-21T10:00:00.000Z"),
    to: new Date("2026-07-21T10:15:00.000Z"),
  },
  stations: [
    {
      station: { id: "BE.NMBS.1", name: "Bruges" },
      departures: [
        {
          id: "connection-1",
          stationId: "BE.NMBS.1",
          trainNumber: "IC3033",
          destination: "Oostende",
          scheduledDeparture: new Date("2026-07-21T10:08:00.000Z"),
          delayMinutes: 4,
          cancelled: false,
        },
      ],
    },
  ],
  warnings: [],
};

describe("GET /api/health", () => {
  it("exposes a health check through the deployed API service prefix", async () => {
    const response = await request(createApp({ departureSearch: createService() }))
      .get("/api/health")
      .expect(200)
      .expect("Content-Type", /json/);

    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/departures", () => {
  it("returns the documented successful response", async () => {
    const service = createService();
    const logger = createLogger();
    vi.mocked(service.search).mockResolvedValue(completeResult);

    const response = await request(createApp({ departureSearch: service, logger }))
      .get("/api/departures")
      .query({ q: "  Bru  " })
      .expect(200)
      .expect("Content-Type", /json/);

    expect(service.search).toHaveBeenCalledWith("Bru", {
      requestId: response.body.requestId,
    });
    expect(response.body).toMatchObject({
      requestId: expect.any(String),
      query: "Bru",
      partial: false,
      window: {
        from: "2026-07-21T10:00:00.000Z",
        to: "2026-07-21T10:15:00.000Z",
      },
      stations: [
        {
          id: "BE.NMBS.1",
          name: "Bruges",
          departures: [
            {
              id: "connection-1",
              trainNumber: "IC3033",
              destination: "Oostende",
              scheduledDeparture: "2026-07-21T10:08:00.000Z",
              delayMinutes: 4,
              cancelled: false,
            },
          ],
        },
      ],
      warnings: [],
    });
    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "request_completed",
        requestId: response.body.requestId,
        method: "GET",
        path: "/api/departures",
        statusCode: 200,
        durationMs: expect.any(Number),
      }),
      "Request completed",
    );
  });

  it.each([
    ["missing", undefined, "QUERY_REQUIRED"],
    ["blank", "   ", "QUERY_REQUIRED"],
    ["short", "Br", "QUERY_TOO_SHORT"],
  ])("rejects a %s query", async (_description, query, code) => {
    const service = createService();
    const app = createApp({ departureSearch: service });
    const operation = request(app).get("/api/departures");
    const response = query === undefined
      ? await operation.expect(400)
      : await operation.query({ q: query }).expect(400);

    expect(response.body.error).toMatchObject({
      code,
      requestId: expect.any(String),
    });
    expect(service.search).not.toHaveBeenCalled();
  });

  it("returns partial data and structured warnings", async () => {
    const service = createService();
    vi.mocked(service.search).mockResolvedValue({
      ...completeResult,
      warnings: [
        {
          code: "LIVEBOARD_TIMEOUT",
          station: { id: "BE.NMBS.2", name: "Brussels-Central" },
        },
      ],
    });

    const response = await request(createApp({ departureSearch: service }))
      .get("/api/departures?q=Bru")
      .expect(200);

    expect(response.body.partial).toBe(true);
    expect(response.body.warnings).toEqual([
      {
        code: "LIVEBOARD_TIMEOUT",
        stationId: "BE.NMBS.2",
        stationName: "Brussels-Central",
      },
    ]);
  });

  it("maps total liveboard timeouts to 504", async () => {
    const service = createService();
    const logger = createLogger();
    vi.mocked(service.search).mockRejectedValue(
      new AllLiveboardsFailedError([
        {
          code: "LIVEBOARD_TIMEOUT",
          station: { id: "1", name: "Bruges" },
        },
      ]),
    );

    const response = await request(createApp({ departureSearch: service, logger }))
      .get("/api/departures?q=Bru")
      .expect(504);

    expect(response.body.error.code).toBe("UPSTREAM_TIMEOUT");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "request_upstream_failure",
        requestId: response.body.error.requestId,
        errorCode: "UPSTREAM_TIMEOUT",
        failedStationIds: ["1"],
      }),
      "All matching liveboards failed",
    );
  });

  it("maps station-catalogue failures to an upstream error", async () => {
    const service = createService();
    vi.mocked(service.search).mockRejectedValue(
      new IRailError("unavailable", {
        kind: "http",
        endpoint: "stations",
        status: 503,
      }),
    );

    const response = await request(createApp({ departureSearch: service }))
      .get("/api/departures?q=Bru")
      .expect(502);

    expect(response.body.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("does not expose unexpected internal errors", async () => {
    const service = createService();
    const logger = createLogger();
    vi.mocked(service.search).mockRejectedValue(
      new Error("sensitive implementation detail"),
    );

    const response = await request(createApp({ departureSearch: service, logger }))
      .get("/api/departures?q=Bru")
      .expect(500);

    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("sensitive");
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "unexpected_request_error",
        requestId: response.body.error.requestId,
        errorName: "Error",
        errorMessage: "sensitive implementation detail",
        stack: expect.any(String),
      }),
      "Unexpected request error",
    );
  });
});

function createService(): DepartureSearchService {
  return { search: vi.fn() };
}

function createLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}
