import { describe, expect, it, vi } from "vitest";

import type { IRailClient } from "../../src/irail/irail-client.js";
import { IRailError } from "../../src/irail/irail-errors.js";
import type { Logger } from "../../src/logging/logger.js";
import type { IRailStationsResponse } from "../../src/irail/irail-types.js";
import { CachedStationCatalogue } from "../../src/stations/station-catalogue.js";

const firstResponse: IRailStationsResponse = {
  version: "1.2",
  timestamp: 1,
  stations: [
    {
      id: "BE.NMBS.1",
      name: "Bruges",
      standardname: "Brugge",
    },
  ],
};

const secondResponse: IRailStationsResponse = {
  version: "1.2",
  timestamp: 2,
  stations: [
    {
      id: "BE.NMBS.2",
      name: "Brussels-Central",
      standardname: "Bruxelles-Central",
    },
  ],
};

describe("CachedStationCatalogue", () => {
  it("loads and reuses a fresh station catalogue", async () => {
    const client = createClient();
    vi.mocked(client.getStations).mockResolvedValue(firstResponse);
    const clock = createClock(1_000);
    const catalogue = new CachedStationCatalogue(client, 60_000, clock);

    const first = await catalogue.getStations();
    clock.now.mockReturnValue(60_999);
    const second = await catalogue.getStations();

    expect(second).toBe(first);
    expect(client.getStations).toHaveBeenCalledTimes(1);
  });

  it("refreshes a catalogue at the TTL boundary", async () => {
    const client = createClient();
    vi.mocked(client.getStations)
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse);
    const clock = createClock(1_000);
    const catalogue = new CachedStationCatalogue(client, 60_000, clock);

    await catalogue.getStations();
    clock.now.mockReturnValue(61_000);
    const refreshed = await catalogue.getStations();

    expect(refreshed[0]?.id).toBe("BE.NMBS.2");
    expect(client.getStations).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight refresh across concurrent callers", async () => {
    const response = deferred<IRailStationsResponse>();
    const client = createClient();
    vi.mocked(client.getStations).mockReturnValue(response.promise);
    const catalogue = new CachedStationCatalogue(
      client,
      60_000,
      createClock(1_000),
    );

    const firstCall = catalogue.getStations();
    const secondCall = catalogue.getStations();
    response.resolve(firstResponse);

    const [first, second] = await Promise.all([firstCall, secondCall]);
    expect(second).toBe(first);
    expect(client.getStations).toHaveBeenCalledTimes(1);
  });

  it("serves stale station data when a refresh fails", async () => {
    const client = createClient();
    vi.mocked(client.getStations)
      .mockResolvedValueOnce(firstResponse)
      .mockRejectedValueOnce(new Error("upstream unavailable"));
    const clock = createClock(1_000);
    const logger = createLogger();
    const catalogue = new CachedStationCatalogue(client, 60_000, clock, logger);
    const loaded = await catalogue.getStations();

    clock.now.mockReturnValue(61_000);
    const stale = await catalogue.getStations();

    expect(stale).toBe(loaded);
    expect(client.getStations).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "station_catalogue_stale_fallback",
        errorName: "Error",
      }),
      "Station catalogue refresh failed; serving stale data",
    );
  });

  it("retries refresh after a failed stale fallback", async () => {
    const client = createClient();
    vi.mocked(client.getStations)
      .mockResolvedValueOnce(firstResponse)
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(secondResponse);
    const clock = createClock(1_000);
    const catalogue = new CachedStationCatalogue(client, 60_000, clock);

    await catalogue.getStations();
    clock.now.mockReturnValue(61_000);
    await catalogue.getStations();

    clock.now.mockReturnValue(120_999);
    const staleDuringBackoff = await catalogue.getStations();
    expect(staleDuringBackoff[0]?.id).toBe("BE.NMBS.1");
    expect(client.getStations).toHaveBeenCalledTimes(2);

    clock.now.mockReturnValue(121_000);
    const refreshed = await catalogue.getStations();

    expect(refreshed[0]?.id).toBe("BE.NMBS.2");
    expect(client.getStations).toHaveBeenCalledTimes(3);
  });

  it("propagates the error when no catalogue has loaded", async () => {
    const failure = new Error("upstream unavailable");
    const client = createClient();
    vi.mocked(client.getStations).mockRejectedValue(failure);
    const catalogue = new CachedStationCatalogue(
      client,
      60_000,
      createClock(1_000),
    );

    await expect(catalogue.getStations()).rejects.toBe(failure);
  });

  it("classifies invalid normalized station data as an upstream response error", async () => {
    const client = createClient();
    vi.mocked(client.getStations).mockResolvedValue({
      ...firstResponse,
      stations: [{ id: "BE.NMBS.1", name: "   ", standardname: "Brugge" }],
    });
    const catalogue = new CachedStationCatalogue(
      client,
      60_000,
      createClock(1_000),
    );

    await expect(catalogue.getStations()).rejects.toMatchObject<Partial<IRailError>>({
      kind: "invalid-response",
      endpoint: "stations",
    });
  });
});

function createClient(): IRailClient {
  return {
    getStations: vi.fn(),
    getLiveboard: vi.fn(),
  };
}

function createClock(now: number) {
  return { now: vi.fn(() => now) };
}

function createLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
