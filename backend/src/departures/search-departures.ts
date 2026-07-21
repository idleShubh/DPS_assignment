import type {
  DepartureSearchResult,
  DepartureWarning,
  StationDepartures,
} from "../domain/search-result.js";
import type { Station } from "../domain/station.js";
import type { IRailClient } from "../irail/irail-client.js";
import { IRailError } from "../irail/irail-errors.js";
import { noopLogger, type Logger } from "../logging/logger.js";
import type { StationCatalogue } from "../stations/station-catalogue.js";
import { findStationsBySubstring } from "../stations/station-search.js";
import { systemClock, type Clock } from "../time/clock.js";
import {
  InvalidDepartureError,
  normalizeDepartures,
} from "./departure-normalizer.js";
import {
  createDepartureWindow,
  filterDeparturesByWindow,
} from "./departure-window.js";

interface SearchDeparturesOptions {
  readonly stationCatalogue: StationCatalogue;
  readonly irailClient: IRailClient;
  readonly windowMinutes: number;
  readonly concurrency: number;
  readonly clock?: Clock;
  readonly logger?: Logger;
}

type StationResult =
  | { readonly ok: true; readonly value: StationDepartures }
  | { readonly ok: false; readonly warning: DepartureWarning };

export interface DepartureSearchService {
  search(
    query: string,
    context?: DepartureSearchContext,
  ): Promise<DepartureSearchResult>;
}

export interface DepartureSearchContext {
  readonly requestId?: string;
}

export class AllLiveboardsFailedError extends Error {
  readonly warnings: readonly DepartureWarning[];

  constructor(warnings: readonly DepartureWarning[]) {
    super("Every matching station liveboard failed.");
    this.name = "AllLiveboardsFailedError";
    this.warnings = Object.freeze([...warnings]);
  }

  get onlyTimeouts(): boolean {
    return this.warnings.every(
      (warning) => warning.code === "LIVEBOARD_TIMEOUT",
    );
  }
}

export class SearchDepartures implements DepartureSearchService {
  private readonly stationCatalogue: StationCatalogue;
  private readonly irailClient: IRailClient;
  private readonly windowMinutes: number;
  private readonly concurrency: number;
  private readonly clock: Clock;
  private readonly logger: Logger;

  constructor(options: SearchDeparturesOptions) {
    this.stationCatalogue = options.stationCatalogue;
    this.irailClient = options.irailClient;
    this.windowMinutes = options.windowMinutes;
    this.concurrency = options.concurrency;
    this.clock = options.clock ?? systemClock;
    this.logger = options.logger ?? noopLogger;
  }

  async search(
    query: string,
    context: DepartureSearchContext = {},
  ): Promise<DepartureSearchResult> {
    const referenceInstant = new Date(this.clock.now());
    const window = createDepartureWindow(referenceInstant, this.windowMinutes);
    const catalogue = await this.stationCatalogue.getStations();
    const matchingStations = findStationsBySubstring(catalogue, query);

    if (matchingStations.length === 0) {
      return Object.freeze({ query, window, stations: [], warnings: [] });
    }

    const results = await mapWithConcurrency(
      matchingStations,
      this.concurrency,
      (station) => this.loadStation(station, window, context),
    );
    const stations = results
      .filter((result): result is Extract<StationResult, { ok: true }> => result.ok)
      .map((result) => result.value);
    const warnings = results
      .filter((result): result is Extract<StationResult, { ok: false }> => !result.ok)
      .map((result) => result.warning);

    if (stations.length === 0) {
      this.logger.warn(
        {
          event: "departure_search_failed",
          ...requestLogContext(context),
          query,
          failedStationIds: warnings.map(({ station }) => station.id),
        },
        "Every matching liveboard failed",
      );
      throw new AllLiveboardsFailedError(warnings);
    }

    if (warnings.length > 0) {
      this.logger.warn(
        {
          event: "departure_search_partial",
          ...requestLogContext(context),
          query,
          successfulStationCount: stations.length,
          failedStationIds: warnings.map(({ station }) => station.id),
        },
        "Departure search returned partial results",
      );
    }

    return Object.freeze({
      query,
      window,
      stations: Object.freeze(stations),
      warnings: Object.freeze(warnings),
    });
  }

  private async loadStation(
    station: Station,
    window: DepartureSearchResult["window"],
    context: DepartureSearchContext,
  ): Promise<StationResult> {
    try {
      const liveboard = await this.irailClient.getLiveboard(station.id);
      const departures = filterDeparturesByWindow(
        normalizeDepartures(station.id, liveboard.departures.departure),
        window,
      );

      return {
        ok: true,
        value: Object.freeze({
          station: Object.freeze({ id: station.id, name: station.name }),
          departures,
        }),
      };
    } catch (error) {
      const code = warningCodeFor(error);
      this.logger.warn(
        {
          event: "liveboard_failed",
          ...requestLogContext(context),
          stationId: station.id,
          warningCode: code,
          ...describeLiveboardError(error),
        },
        "Station liveboard failed",
      );
      return {
        ok: false,
        warning: Object.freeze({
          code,
          station: Object.freeze({ id: station.id, name: station.name }),
        }),
      };
    }
  }
}

function requestLogContext(
  context: DepartureSearchContext,
): Record<string, unknown> {
  return context.requestId ? { requestId: context.requestId } : {};
}

function describeLiveboardError(error: unknown): Record<string, unknown> {
  if (error instanceof IRailError) {
    return {
      upstreamKind: error.kind,
      upstreamStatus: error.status,
    };
  }

  if (error instanceof InvalidDepartureError) {
    return { upstreamKind: "invalid-departure" };
  }

  return {};
}

function warningCodeFor(error: unknown): DepartureWarning["code"] {
  if (error instanceof InvalidDepartureError) {
    return "LIVEBOARD_INVALID_RESPONSE";
  }
  if (error instanceof IRailError) {
    if (error.kind === "timeout") {
      return "LIVEBOARD_TIMEOUT";
    }
    if (error.kind === "invalid-response") {
      return "LIVEBOARD_INVALID_RESPONSE";
    }
    return "LIVEBOARD_UNAVAILABLE";
  }

  throw error;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<R>,
): Promise<readonly R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
    throw new RangeError("Concurrency must be a positive whole number.");
  }

  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      const value = values[index];
      if (value !== undefined) {
        results[index] = await operation(value);
      }
    }
  }

  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
