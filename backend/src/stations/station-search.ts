import type { Station } from "../domain/station.js";

export function findStationsBySubstring(
  stations: readonly Station[],
  query: string,
): readonly Station[] {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) {
    return [];
  }

  const matchesById = new Map<string, Station>();

  for (const station of stations) {
    const matches = station.searchNames.some((name) =>
      normalizeForSearch(name).includes(normalizedQuery),
    );

    if (matches && !matchesById.has(station.id)) {
      matchesById.set(station.id, station);
    }
  }

  return Object.freeze(
    [...matchesById.values()].sort(
      (left, right) =>
        left.name.localeCompare(right.name, "en") ||
        left.id.localeCompare(right.id, "en"),
    ),
  );
}

function normalizeForSearch(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en");
}
