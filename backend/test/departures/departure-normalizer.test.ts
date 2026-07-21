import { describe, expect, it } from "vitest";

import {
  InvalidDepartureError,
  normalizeDepartures,
} from "../../src/departures/departure-normalizer.js";
import type { IRailDepartureRecord } from "../../src/irail/irail-types.js";

const validRecord: IRailDepartureRecord = {
  id: 0,
  departureConnection:
    "http://irail.be/connections/8891009/20260721/IC3033",
  time: 1_753_089_600,
  delay: 240,
  station: "Antwerpen-Centraal",
  vehicle: "BE.NMBS.IC3033",
  vehicleinfo: { shortname: "IC3033" },
  canceled: 0,
};

describe("normalizeDepartures", () => {
  it("normalizes the required departure fields", () => {
    const [departure] = normalizeDepartures("BE.NMBS.1", [validRecord]);

    expect(departure).toEqual({
      id: validRecord.departureConnection,
      stationId: "BE.NMBS.1",
      trainNumber: "IC3033",
      destination: "Antwerpen-Centraal",
      scheduledDeparture: new Date(1_753_089_600_000),
      delayMinutes: 4,
      cancelled: false,
    });
  });

  it("floors partial delay minutes", () => {
    const [departure] = normalizeDepartures("BE.NMBS.1", [
      { ...validRecord, delay: "119" },
    ]);

    expect(departure?.delayMinutes).toBe(1);
  });

  it("uses the vehicle identifier when shortname is unavailable", () => {
    const [departure] = normalizeDepartures("BE.NMBS.1", [
      { ...validRecord, vehicleinfo: undefined },
    ]);

    expect(departure?.trainNumber).toBe("IC3033");
  });

  it("uses direction as a destination fallback", () => {
    const [departure] = normalizeDepartures("BE.NMBS.1", [
      {
        ...validRecord,
        station: undefined,
        direction: { name: "Oostende" },
      },
    ]);

    expect(departure?.destination).toBe("Oostende");
  });

  it.each([
    [true, true],
    [false, false],
    [1, true],
    [0, false],
    ["1", true],
    ["0", false],
  ])("converts cancellation flag %s to %s", (flag, expected) => {
    const [departure] = normalizeDepartures("BE.NMBS.1", [
      { ...validRecord, canceled: flag },
    ]);

    expect(departure?.cancelled).toBe(expected);
  });

  it("deduplicates departures by stable departure identity", () => {
    const departures = normalizeDepartures("BE.NMBS.1", [
      validRecord,
      { ...validRecord },
    ]);

    expect(departures).toHaveLength(1);
  });

  it.each([
    ["missing connection", { departureConnection: undefined }],
    ["missing train", { vehicle: undefined, vehicleinfo: undefined }],
    ["missing destination", { station: undefined, direction: undefined }],
    ["invalid time", { time: "not-a-time" }],
    ["out-of-range time", { time: Number.MAX_VALUE }],
    ["negative delay", { delay: -1 }],
    ["invalid cancellation", { canceled: "yes" }],
  ])("rejects a record with %s", (_description, invalidFields) => {
    expect(() =>
      normalizeDepartures("BE.NMBS.1", [
        { ...validRecord, ...invalidFields },
      ]),
    ).toThrow(InvalidDepartureError);
  });

  it("does not globally deduplicate the same train across stations", () => {
    const first = normalizeDepartures("BE.NMBS.1", [validRecord]);
    const second = normalizeDepartures("BE.NMBS.2", [
      {
        ...validRecord,
        departureConnection:
          "http://irail.be/connections/8892000/20260721/IC3033",
      },
    ]);

    expect(first[0]?.trainNumber).toBe(second[0]?.trainNumber);
    expect(first[0]?.stationId).not.toBe(second[0]?.stationId);
  });
});
