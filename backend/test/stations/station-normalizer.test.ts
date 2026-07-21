import { describe, expect, it } from "vitest";

import {
  InvalidStationError,
  normalizeStations,
} from "../../src/stations/station-normalizer.js";

describe("normalizeStations", () => {
  it("normalizes, sorts, and exposes both localized and standard names", () => {
    const stations = normalizeStations([
      {
        id: " BE.NMBS.2 ",
        name: " Ghent-Sint-Pieters ",
        standardname: " Gent-Sint-Pieters ",
      },
      {
        id: "BE.NMBS.1",
        name: "Antwerp-Central",
        standardname: "Antwerpen-Centraal",
      },
    ]);

    expect(stations).toEqual([
      {
        id: "BE.NMBS.1",
        name: "Antwerp-Central",
        searchNames: ["Antwerp-Central", "Antwerpen-Centraal"],
      },
      {
        id: "BE.NMBS.2",
        name: "Ghent-Sint-Pieters",
        searchNames: ["Ghent-Sint-Pieters", "Gent-Sint-Pieters"],
      },
    ]);
  });

  it("deduplicates by station ID and merges searchable names", () => {
    const stations = normalizeStations([
      {
        id: "BE.NMBS.1",
        name: "Brussels-Central",
        standardname: "Bruxelles-Central",
      },
      {
        id: "BE.NMBS.1",
        name: "Brussels-Central",
        standardname: "Brussel-Centraal",
      },
    ]);

    expect(stations).toEqual([
      {
        id: "BE.NMBS.1",
        name: "Brussels-Central",
        searchNames: [
          "Brussels-Central",
          "Bruxelles-Central",
          "Brussel-Centraal",
        ],
      },
    ]);
  });

  it("deduplicates equivalent names without regard to case", () => {
    const stations = normalizeStations([
      {
        id: "BE.NMBS.1",
        name: "Brugge",
        standardname: "BRUGGE",
      },
    ]);

    expect(stations[0]?.searchNames).toEqual(["Brugge"]);
  });

  it("rejects records that become blank after trimming", () => {
    expect(() =>
      normalizeStations([
        { id: "BE.NMBS.1", name: "   ", standardname: "Brugge" },
      ]),
    ).toThrow(InvalidStationError);
  });

  it("returns immutable station data", () => {
    const stations = normalizeStations([
      { id: "BE.NMBS.1", name: "Brugge", standardname: "Brugge" },
    ]);

    expect(Object.isFrozen(stations)).toBe(true);
    expect(Object.isFrozen(stations[0])).toBe(true);
    expect(Object.isFrozen(stations[0]?.searchNames)).toBe(true);
  });
});
