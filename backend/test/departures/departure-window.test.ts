import { describe, expect, it } from "vitest";

import type { Departure } from "../../src/domain/departure.js";
import {
  createDepartureWindow,
  filterDeparturesByWindow,
} from "../../src/departures/departure-window.js";

const now = new Date("2026-07-21T10:00:00.000Z");
const window = createDepartureWindow(now, 15);

describe("createDepartureWindow", () => {
  it("creates a 15-minute window from one reference instant", () => {
    expect(window).toEqual({
      from: new Date("2026-07-21T10:00:00.000Z"),
      to: new Date("2026-07-21T10:15:00.000Z"),
    });
  });

  it.each([
    [new Date("invalid"), 15],
    [now, 0],
    [now, 1.5],
  ])("rejects invalid window input", (reference, minutes) => {
    expect(() => createDepartureWindow(reference, minutes)).toThrow(RangeError);
  });
});

describe("filterDeparturesByWindow", () => {
  it("includes departures on both inclusive boundaries", () => {
    const departures = [
      createDeparture("at-end", "2026-07-21T10:15:00.000Z"),
      createDeparture("at-start", "2026-07-21T10:00:00.000Z"),
    ];

    expect(filterDeparturesByWindow(departures, window).map(({ id }) => id)).toEqual([
      "at-start",
      "at-end",
    ]);
  });

  it("excludes departures immediately outside either boundary", () => {
    const departures = [
      createDeparture("before", "2026-07-21T09:59:59.999Z"),
      createDeparture("after", "2026-07-21T10:15:00.001Z"),
    ];

    expect(filterDeparturesByWindow(departures, window)).toEqual([]);
  });

  it("uses scheduled time regardless of delay or cancellation", () => {
    const delayedPast = createDeparture(
      "delayed-past",
      "2026-07-21T09:55:00.000Z",
      { delayMinutes: 20 },
    );
    const delayedFuture = createDeparture(
      "delayed-future",
      "2026-07-21T10:10:00.000Z",
      { delayMinutes: 60 },
    );
    const cancelled = createDeparture(
      "cancelled",
      "2026-07-21T10:12:00.000Z",
      { cancelled: true },
    );

    expect(
      filterDeparturesByWindow(
        [delayedPast, cancelled, delayedFuture],
        window,
      ).map(({ id }) => id),
    ).toEqual(["delayed-future", "cancelled"]);
  });

  it("sorts equal times deterministically by departure identity", () => {
    const departures = [
      createDeparture("b", "2026-07-21T10:05:00.000Z"),
      createDeparture("a", "2026-07-21T10:05:00.000Z"),
    ];

    const filtered = filterDeparturesByWindow(departures, window);

    expect(filtered.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(Object.isFrozen(filtered)).toBe(true);
  });

  it("handles a window that crosses midnight", () => {
    const midnightWindow = createDepartureWindow(
      new Date("2026-07-21T23:55:00.000Z"),
      15,
    );

    expect(
      filterDeparturesByWindow(
        [createDeparture("next-day", "2026-07-22T00:05:00.000Z")],
        midnightWindow,
      ),
    ).toHaveLength(1);
  });
});

function createDeparture(
  id: string,
  scheduledDeparture: string,
  overrides: Partial<Departure> = {},
): Departure {
  return {
    id,
    stationId: "BE.NMBS.1",
    trainNumber: "IC1",
    destination: "Brugge",
    scheduledDeparture: new Date(scheduledDeparture),
    delayMinutes: 0,
    cancelled: false,
    ...overrides,
  };
}
