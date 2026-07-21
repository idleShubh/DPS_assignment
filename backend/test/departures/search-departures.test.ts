import { describe, expect, it, vi } from "vitest";

import {
  AllLiveboardsFailedError,
  SearchDepartures,
} from "../../src/departures/search-departures.js";
import type { Station } from "../../src/domain/station.js";
import type { IRailClient } from "../../src/irail/irail-client.js";
import { IRailError } from "../../src/irail/irail-errors.js";
import type { IRailLiveboardResponse } from "../../src/irail/irail-types.js";
import type { StationCatalogue } from "../../src/stations/station-catalogue.js";

const now = new Date("2026-07-21T10:00:00.000Z");
const stations: readonly Station[] = [
  { id: "1", name: "Bruges", searchNames: ["Bruges", "Brugge"] },
  {
    id: "2",
    name: "Brussels-Central",
    searchNames: ["Brussels-Central", "Bruxelles-Central"],
  },
];

describe("SearchDepartures", () => {
  it("aggregates every matching station using one captured window", async () => {
    const client = createClient();
    vi.mocked(client.getLiveboard).mockImplementation(async (stationId) =>
      liveboard(stationId, [
        departure(`${stationId}-inside`, "2026-07-21T10:10:00.000Z"),
        departure(`${stationId}-outside`, "2026-07-21T10:16:00.000Z"),
      ]),
    );
    const clock = { now: vi.fn(() => now.getTime()) };
    const service = createService(client, stations, { clock });

    const result = await service.search("Bru");

    expect(result.window).toEqual({
      from: now,
      to: new Date("2026-07-21T10:15:00.000Z"),
    });
    expect(result.stations.map(({ station }) => station.id)).toEqual(["1", "2"]);
    expect(result.stations.every(({ departures }) => departures.length === 1)).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(clock.now).toHaveBeenCalledTimes(1);
  });

  it("returns successful stations plus warnings for partial failures", async () => {
    const client = createClient();
    vi.mocked(client.getLiveboard).mockImplementation(async (stationId) => {
      if (stationId === "2") {
        throw new IRailError("timed out", {
          kind: "timeout",
          endpoint: "liveboard",
        });
      }
      return liveboard(stationId, []);
    });
    const service = createService(client, stations);

    const result = await service.search("bru");

    expect(result.stations).toHaveLength(1);
    expect(result.stations[0]?.station.id).toBe("1");
    expect(result.warnings).toEqual([
      {
        code: "LIVEBOARD_TIMEOUT",
        station: { id: "2", name: "Brussels-Central" },
      },
    ]);
  });

  it("classifies malformed departure data as an invalid response", async () => {
    const client = createClient();
    vi.mocked(client.getLiveboard).mockImplementation(async (stationId) =>
      stationId === "1"
        ? liveboard(stationId, [])
        : liveboard(stationId, [{ ...departure("bad", now.toISOString()), time: "bad" }]),
    );
    const service = createService(client, stations);

    const result = await service.search("bru");

    expect(result.warnings[0]?.code).toBe("LIVEBOARD_INVALID_RESPONSE");
  });

  it("throws when every matching liveboard times out", async () => {
    const client = createClient();
    vi.mocked(client.getLiveboard).mockRejectedValue(
      new IRailError("timed out", {
        kind: "timeout",
        endpoint: "liveboard",
      }),
    );
    const service = createService(client, stations);

    const error = await captureAllFailed(() => service.search("bru"));

    expect(error.onlyTimeouts).toBe(true);
    expect(error.warnings).toHaveLength(2);
  });

  it("marks mixed total failures as more than timeouts", async () => {
    const client = createClient();
    vi.mocked(client.getLiveboard)
      .mockRejectedValueOnce(
        new IRailError("timed out", {
          kind: "timeout",
          endpoint: "liveboard",
        }),
      )
      .mockRejectedValueOnce(
        new IRailError("network unavailable", {
          kind: "network",
          endpoint: "liveboard",
        }),
      );
    const service = createService(client, stations, { concurrency: 1 });

    const error = await captureAllFailed(() => service.search("bru"));

    expect(error.onlyTimeouts).toBe(false);
  });

  it("returns an empty success without requesting liveboards", async () => {
    const client = createClient();
    const service = createService(client, stations);

    const result = await service.search("xyz");

    expect(result.stations).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(client.getLiveboard).not.toHaveBeenCalled();
  });

  it("does not disguise unexpected programming errors as upstream warnings", async () => {
    const failure = new Error("unexpected defect");
    const client = createClient();
    vi.mocked(client.getLiveboard).mockRejectedValue(failure);
    const service = createService(client, [stations[0]!]);

    await expect(service.search("bru")).rejects.toBe(failure);
  });

  it("keeps liveboard requests within the concurrency limit", async () => {
    const manyStations = Array.from({ length: 7 }, (_, index): Station => ({
      id: String(index),
      name: `Bru ${index}`,
      searchNames: [`Bru ${index}`],
    }));
    let active = 0;
    let maximumActive = 0;
    const client = createClient();
    vi.mocked(client.getLiveboard).mockImplementation(async (stationId) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return liveboard(stationId, []);
    });
    const service = createService(client, manyStations, { concurrency: 2 });

    await service.search("bru");

    expect(maximumActive).toBe(2);
    expect(client.getLiveboard).toHaveBeenCalledTimes(7);
  });
});

function createService(
  client: IRailClient,
  catalogueStations: readonly Station[],
  overrides: { readonly concurrency?: number; readonly clock?: { now(): number } } = {},
) {
  const catalogue: StationCatalogue = {
    getStations: vi.fn().mockResolvedValue(catalogueStations),
  };
  return new SearchDepartures({
    stationCatalogue: catalogue,
    irailClient: client,
    windowMinutes: 15,
    concurrency: overrides.concurrency ?? 5,
    clock: overrides.clock ?? { now: () => now.getTime() },
  });
}

function createClient(): IRailClient {
  return { getStations: vi.fn(), getLiveboard: vi.fn() };
}

function liveboard(
  stationId: string,
  departures: IRailLiveboardResponse["departures"]["departure"],
): IRailLiveboardResponse {
  return {
    version: "1.2",
    timestamp: Math.floor(now.getTime() / 1_000),
    station: `Station ${stationId}`,
    stationinfo: {
      id: stationId,
      name: `Station ${stationId}`,
      standardname: `Station ${stationId}`,
    },
    departures: { number: departures.length, departure: departures },
  };
}

function departure(id: string, time: string) {
  return {
    departureConnection: id,
    time: Math.floor(new Date(time).getTime() / 1_000),
    delay: 0,
    station: "Destination",
    vehicle: "BE.NMBS.IC1",
    canceled: 0,
  };
}

async function captureAllFailed(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(AllLiveboardsFailedError);
    return error as AllLiveboardsFailedError;
  }
  throw new Error("Expected every liveboard to fail.");
}
