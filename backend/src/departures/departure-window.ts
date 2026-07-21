import type { Departure } from "../domain/departure.js";
import type { DepartureWindow } from "../domain/search-result.js";

export function createDepartureWindow(
  referenceInstant: Date,
  windowMinutes: number,
): DepartureWindow {
  if (!Number.isFinite(referenceInstant.getTime())) {
    throw new RangeError("Reference instant must be a valid date.");
  }
  if (!Number.isSafeInteger(windowMinutes) || windowMinutes <= 0) {
    throw new RangeError("Departure window must be a positive whole number.");
  }

  return Object.freeze({
    from: new Date(referenceInstant.getTime()),
    to: new Date(referenceInstant.getTime() + windowMinutes * 60_000),
  });
}

export function filterDeparturesByWindow(
  departures: readonly Departure[],
  window: DepartureWindow,
): readonly Departure[] {
  const from = window.from.getTime();
  const to = window.to.getTime();

  return Object.freeze(
    departures
      .filter((departure) => {
        const scheduled = departure.scheduledDeparture.getTime();
        return scheduled >= from && scheduled <= to;
      })
      .sort(
        (left, right) =>
          left.scheduledDeparture.getTime() -
            right.scheduledDeparture.getTime() ||
          left.id.localeCompare(right.id, "en"),
      ),
  );
}
