import { describe, expect, it } from "vitest";

import type { Station } from "../../src/domain/station.js";
import { findStationsBySubstring } from "../../src/stations/station-search.js";

const stations: readonly Station[] = [
  {
    id: "BE.NMBS.3",
    name: "Brussels-South",
    searchNames: ["Brussels-South", "Bruxelles-Midi", "Brussel-Zuid"],
  },
  {
    id: "BE.NMBS.1",
    name: "Bruges",
    searchNames: ["Bruges", "Brugge"],
  },
  {
    id: "BE.NMBS.2",
    name: "Liège-Guillemins",
    searchNames: ["Liège-Guillemins", "Luik-Guillemins"],
  },
  {
    id: "BE.NMBS.4",
    name: "Aachen Hbf",
    searchNames: ["Aachen Hbf"],
  },
];

describe("findStationsBySubstring", () => {
  it("matches without regard to case or surrounding query whitespace", () => {
    const matches = findStationsBySubstring(stations, "  bRu  ");

    expect(matches.map((station) => station.id)).toEqual([
      "BE.NMBS.1",
      "BE.NMBS.3",
    ]);
  });

  it("matches a substring in the middle of a name", () => {
    const matches = findStationsBySubstring(stations, "chen");

    expect(matches.map((station) => station.name)).toEqual(["Aachen Hbf"]);
  });

  it("matches standard and alternative-language station names", () => {
    const matches = findStationsBySubstring(stations, "brux");

    expect(matches.map((station) => station.name)).toEqual([
      "Brussels-South",
    ]);
  });

  it("matches accents and their unaccented equivalents", () => {
    const matches = findStationsBySubstring(stations, "liege");

    expect(matches.map((station) => station.name)).toEqual([
      "Liège-Guillemins",
    ]);
  });

  it("returns an empty result when no station matches", () => {
    expect(findStationsBySubstring(stations, "xyz")).toEqual([]);
  });

  it("does not allow an empty query to match every station", () => {
    expect(findStationsBySubstring(stations, "   ")).toEqual([]);
  });

  it("deduplicates matching stations by stable ID", () => {
    const duplicate: Station = {
      id: "BE.NMBS.1",
      name: "Brugge",
      searchNames: ["Brugge"],
    };

    const matches = findStationsBySubstring(
      [...stations, duplicate],
      "brug",
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe("BE.NMBS.1");
  });

  it("returns matches in deterministic display-name order", () => {
    const reversed = [...stations].reverse();

    const matches = findStationsBySubstring(reversed, "u");

    expect(matches.map((station) => station.name)).toEqual([
      "Bruges",
      "Brussels-South",
      "Liège-Guillemins",
    ]);
    expect(Object.isFrozen(matches)).toBe(true);
  });

  it("does not remove punctuation when matching", () => {
    expect(findStationsBySubstring(stations, "liege guillemins")).toEqual([]);
  });
});
