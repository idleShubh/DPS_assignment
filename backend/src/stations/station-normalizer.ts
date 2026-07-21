import type { Station } from "../domain/station.js";
import type { IRailStationRecord } from "../irail/irail-types.js";

export class InvalidStationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStationError";
  }
}

export function normalizeStations(
  records: readonly IRailStationRecord[],
): readonly Station[] {
  const stationsById = new Map<string, Station>();

  for (const record of records) {
    const station = normalizeStation(record);
    const existing = stationsById.get(station.id);

    if (!existing) {
      stationsById.set(station.id, station);
      continue;
    }

    stationsById.set(
      station.id,
      freezeStation({
        ...existing,
        searchNames: uniqueNames([
          ...existing.searchNames,
          ...station.searchNames,
        ]),
      }),
    );
  }

  return Object.freeze(
    [...stationsById.values()].sort(
      (left, right) =>
        left.name.localeCompare(right.name, "en") ||
        left.id.localeCompare(right.id, "en"),
    ),
  );
}

function normalizeStation(record: IRailStationRecord): Station {
  const id = record.id.trim();
  const name = record.name.trim();
  const standardName = record.standardname.trim();

  if (!id || !name || !standardName) {
    throw new InvalidStationError(
      "iRail station IDs and names must not be blank.",
    );
  }

  return freezeStation({
    id,
    name,
    searchNames: uniqueNames([name, standardName]),
  });
}

function uniqueNames(names: readonly string[]): readonly string[] {
  const uniqueNames = new Map<string, string>();

  for (const name of names) {
    const trimmedName = name.trim();
    const key = trimmedName.toLocaleLowerCase("en");
    if (trimmedName && !uniqueNames.has(key)) {
      uniqueNames.set(key, trimmedName);
    }
  }

  return Object.freeze([...uniqueNames.values()]);
}

function freezeStation(station: Station): Station {
  return Object.freeze({
    ...station,
    searchNames: Object.freeze([...station.searchNames]),
  });
}
