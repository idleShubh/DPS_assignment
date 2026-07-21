import type { Departure } from "../domain/departure.js";
import type { IRailDepartureRecord } from "../irail/irail-types.js";

export class InvalidDepartureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDepartureError";
  }
}

export function normalizeDepartures(
  stationId: string,
  records: readonly IRailDepartureRecord[],
): readonly Departure[] {
  const departuresById = new Map<string, Departure>();

  for (const [index, record] of records.entries()) {
    const departure = normalizeDeparture(stationId, record, index);
    if (!departuresById.has(departure.id)) {
      departuresById.set(departure.id, departure);
    }
  }

  return Object.freeze([...departuresById.values()]);
}

function normalizeDeparture(
  stationId: string,
  record: IRailDepartureRecord,
  index: number,
): Departure {
  const path = `departure[${index}]`;
  const id = requireNonBlankString(
    record.departureConnection,
    `${path}.departureConnection`,
  );
  const trainNumber = readTrainNumber(record, path);
  const destination = readDestination(record, path);
  const scheduledSeconds = readNonNegativeNumber(record.time, `${path}.time`);
  const delaySeconds = readNonNegativeNumber(record.delay, `${path}.delay`);
  const cancelled = readBooleanFlag(record.canceled, `${path}.canceled`);
  const scheduledDeparture = new Date(scheduledSeconds * 1_000);
  if (!Number.isFinite(scheduledDeparture.getTime())) {
    throw new InvalidDepartureError(`${path}.time is outside the valid date range.`);
  }

  return Object.freeze({
    id,
    stationId,
    trainNumber,
    destination,
    scheduledDeparture,
    delayMinutes: Math.floor(delaySeconds / 60),
    cancelled,
  });
}

function readTrainNumber(record: IRailDepartureRecord, path: string): string {
  const shortName = readOptionalNestedString(record.vehicleinfo, "shortname");
  if (shortName) {
    return shortName;
  }

  const vehicle = requireNonBlankString(record.vehicle, `${path}.vehicle`);
  return vehicle.replace(/^BE\.NMBS\./, "");
}

function readDestination(record: IRailDepartureRecord, path: string): string {
  if (typeof record.station === "string" && record.station.trim()) {
    return record.station.trim();
  }

  if (typeof record.direction === "string" && record.direction.trim()) {
    return record.direction.trim();
  }

  const directionName = readOptionalNestedString(record.direction, "name");
  if (directionName) {
    return directionName;
  }

  throw new InvalidDepartureError(`${path} has no destination.`);
}

function readOptionalNestedString(
  value: unknown,
  field: string,
): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const nestedValue = (value as Readonly<Record<string, unknown>>)[field];
  if (typeof nestedValue !== "string" || !nestedValue.trim()) {
    return undefined;
  }

  return nestedValue.trim();
}

function requireNonBlankString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new InvalidDepartureError(`${path} must be a non-blank string.`);
  }

  return value.trim();
}

function readNonNegativeNumber(value: unknown, path: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (
    typeof parsed !== "number" ||
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    throw new InvalidDepartureError(`${path} must be a non-negative number.`);
  }

  return parsed;
}

function readBooleanFlag(value: unknown, path: string): boolean {
  if (value === true || value === 1 || value === "1") {
    return true;
  }
  if (value === false || value === 0 || value === "0") {
    return false;
  }

  throw new InvalidDepartureError(`${path} must be a boolean flag.`);
}
