import { describe, expect, it, vi } from "vitest";

import {
  createDeparturesClient,
  DeparturesApiError,
} from "./departures";
import type { DepartureResponse, ErrorResponse } from "./types";

const successfulResponse: DepartureResponse = {
  requestId: "request-1",
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
};

describe("createDeparturesClient", () => {
  it("requests and validates departures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(successfulResponse));
    const client = createDeparturesClient({
      baseUrl: "https://example.test",
      fetchImplementation: fetchMock,
    });
    const controller = new AbortController();

    const response = await client.getDepartures("Bru & Midi", controller.signal);

    expect(response).toEqual(successfulResponse);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://example.test/api/departures?q=Bru+%26+Midi",
    );
    expect(options).toMatchObject({
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  });

  it.each([
    [400, "QUERY_TOO_SHORT", "validation"],
    [504, "UPSTREAM_TIMEOUT", "upstream"],
    [500, "INTERNAL_ERROR", "internal"],
  ] as const)(
    "classifies a %s %s response as %s",
    async (status, code, expectedKind) => {
      const body: ErrorResponse = {
        error: {
          code,
          message: "Request failed",
          requestId: "request-error",
        },
      };
      const client = createDeparturesClient({
        baseUrl: "https://example.test",
        fetchImplementation: vi
          .fn<typeof fetch>()
          .mockResolvedValue(jsonResponse(body, status)),
      });

      const error = await captureApiError(() => client.getDepartures("Bru"));

      expect(error).toMatchObject({
        kind: expectedKind,
        status,
        code,
        requestId: "request-error",
      });
    },
  );

  it("classifies transport failures as network errors", async () => {
    const client = createDeparturesClient({
      baseUrl: "https://example.test",
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockRejectedValue(new TypeError("network unavailable")),
    });

    const error = await captureApiError(() => client.getDepartures("Bru"));

    expect(error.kind).toBe("network");
  });

  it("does not convert an aborted request into a network error", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("Aborted", "AbortError");
    const client = createDeparturesClient({
      baseUrl: "https://example.test",
      fetchImplementation: vi.fn<typeof fetch>().mockImplementation(async () => {
        controller.abort();
        throw abortError;
      }),
    });

    await expect(
      client.getDepartures("Bru", controller.signal),
    ).rejects.toBe(abortError);
  });

  it.each([
    ["malformed JSON", new Response("{bad-json", { status: 200 })],
    ["unexpected success shape", jsonResponse({ stations: [] })],
    [
      "contradictory partial state",
      jsonResponse({
        ...successfulResponse,
        partial: true,
        warnings: [],
      }),
    ],
    ["unexpected error shape", jsonResponse({ message: "failed" }, 502)],
  ])("classifies %s as an invalid response", async (_description, response) => {
    const client = createDeparturesClient({
      baseUrl: "https://example.test",
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(response),
    });

    const error = await captureApiError(() => client.getDepartures("Bru"));

    expect(error.kind).toBe("invalid-response");
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function captureApiError(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(DeparturesApiError);
    return error as DeparturesApiError;
  }
  throw new Error("Expected a DeparturesApiError.");
}
