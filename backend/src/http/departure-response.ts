import type { DepartureSearchResult } from "../domain/search-result.js";
import type { DepartureResponse } from "./api-types.js";

export function toDepartureResponse(
  result: DepartureSearchResult,
  requestId: string,
): DepartureResponse {
  return {
    requestId,
    query: result.query,
    partial: result.stations.length > 0 && result.warnings.length > 0,
    window: {
      from: result.window.from.toISOString(),
      to: result.window.to.toISOString(),
    },
    stations: result.stations.map(({ station, departures }) => ({
      id: station.id,
      name: station.name,
      departures: departures.map((departure) => ({
        id: departure.id,
        trainNumber: departure.trainNumber,
        destination: departure.destination,
        scheduledDeparture: departure.scheduledDeparture.toISOString(),
        delayMinutes: departure.delayMinutes,
        cancelled: departure.cancelled,
      })),
    })),
    warnings: result.warnings.map(({ code, station }) => ({
      code,
      stationId: station.id,
      stationName: station.name,
    })),
  };
}
