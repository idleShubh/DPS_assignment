import { describe, expect, it, vi } from "vitest";

import { HttpIRailClient } from "../../src/irail/irail-client.js";
import { IRailError } from "../../src/irail/irail-errors.js";

const clientConfig = {
  baseUrl: "https://example.test",
  timeoutMs: 50,
  userAgent: "LagoviaTest/1.0 (test@example.com)",
};

const station = {
  id: "BE.NMBS.008891009",
  "@id": "http://irail.be/stations/NMBS/008891009",
  name: "Bruges",
  standardname: "Brugge",
  locationX: 3.216726,
  locationY: 51.197226,
};

describe("HttpIRailClient", () => {
  it("retrieves stations with the required query and headers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        version: "1.2",
        timestamp: 1_753_000_000,
        station: [station],
      }),
    );
    const client = new HttpIRailClient(clientConfig, fetchMock);

    const result = await client.getStations();

    expect(result.stations).toEqual([
      {
        id: station.id,
        name: station.name,
        standardname: station.standardname,
      },
    ]);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://example.test/stations/?format=json&lang=en",
    );
    expect(options?.headers).toEqual({
      Accept: "application/json",
      "User-Agent": clientConfig.userAgent,
    });
  });

  it("retrieves a departure liveboard by stable station ID", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        version: "1.2",
        timestamp: 1_753_000_000,
        station: "Bruges",
        stationinfo: station,
        departures: {
          number: "1",
          departure: [
            {
              id: 0,
              time: "1753000300",
              delay: "60",
              station: "Oostende",
              vehicle: "BE.NMBS.IC3033",
              canceled: "0",
            },
          ],
        },
      }),
    );
    const client = new HttpIRailClient(clientConfig, fetchMock);

    const result = await client.getLiveboard(station.id);

    expect(result.departures.number).toBe(1);
    expect(result.departures.departure).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] ?? [];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.pathname).toBe("/liveboard/");
    expect(Object.fromEntries(parsedUrl.searchParams)).toEqual({
      id: station.id,
      arrdep: "departure",
      format: "json",
      lang: "en",
      alerts: "false",
    });
  });

  it("accepts a zero-departure liveboard with no departure array", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        version: "1.2",
        timestamp: 1_753_000_000,
        station: "Bruges",
        stationinfo: station,
        departures: { number: 0 },
      }),
    );
    const client = new HttpIRailClient(clientConfig, fetchMock);

    const result = await client.getLiveboard(station.id);

    expect(result.departures.departure).toEqual([]);
  });

  it.each([404, 429, 503])(
    "preserves an upstream HTTP status of %s",
    async (status) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("Upstream failure", { status }));
      const client = new HttpIRailClient(clientConfig, fetchMock);

      const error = await captureIRailError(() => client.getStations());

      expect(error).toMatchObject({
        kind: "http",
        endpoint: "stations",
        status,
      });
    },
  );

  it("classifies malformed JSON as an invalid response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpIRailClient(clientConfig, fetchMock);

    const error = await captureIRailError(() =>
      client.getLiveboard(station.id),
    );

    expect(error).toMatchObject({
      kind: "invalid-response",
      endpoint: "liveboard",
    });
  });

  it("classifies an unexpected response shape", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ version: "1.2", timestamp: 123 }));
    const client = new HttpIRailClient(clientConfig, fetchMock);

    const error = await captureIRailError(() => client.getStations());

    expect(error).toMatchObject({
      kind: "invalid-response",
      endpoint: "stations",
    });
  });

  it("classifies transport failures as network errors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network unavailable"));
    const client = new HttpIRailClient(clientConfig, fetchMock);

    const error = await captureIRailError(() => client.getStations());

    expect(error).toMatchObject({ kind: "network", endpoint: "stations" });
  });

  it("aborts and classifies requests that exceed the timeout", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_input, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const client = new HttpIRailClient(
      { ...clientConfig, timeoutMs: 5 },
      fetchMock,
    );

    const error = await captureIRailError(() => client.getStations());

    expect(error).toMatchObject({ kind: "timeout", endpoint: "stations" });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function captureIRailError(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(IRailError);
    return error as IRailError;
  }

  throw new Error("Expected operation to throw an IRailError.");
}
