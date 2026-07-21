import type { Station } from "../domain/station.js";
import type { IRailClient } from "../irail/irail-client.js";
import { IRailError } from "../irail/irail-errors.js";
import { noopLogger, type Logger } from "../logging/logger.js";
import { systemClock, type Clock } from "../time/clock.js";
import {
  InvalidStationError,
  normalizeStations,
} from "./station-normalizer.js";

interface CachedStations {
  readonly loadedAt: number;
  readonly stations: readonly Station[];
}

export interface StationCatalogue {
  getStations(): Promise<readonly Station[]>;
}

export class CachedStationCatalogue implements StationCatalogue {
  private cache: CachedStations | undefined;
  private refreshPromise: Promise<readonly Station[]> | undefined;
  private retryRefreshAt: number | undefined;

  constructor(
    private readonly irailClient: IRailClient,
    private readonly ttlMs: number,
    private readonly clock: Clock = systemClock,
    private readonly logger: Logger = noopLogger,
  ) {}

  async getStations(): Promise<readonly Station[]> {
    if (
      this.cache &&
      (this.isFresh(this.cache) || this.isRefreshBackoffActive())
    ) {
      return this.cache.stations;
    }

    try {
      return await this.refresh();
    } catch (error) {
      if (this.cache) {
        return this.cache.stations;
      }

      throw error;
    }
  }

  private isFresh(cache: CachedStations): boolean {
    return this.clock.now() - cache.loadedAt < this.ttlMs;
  }

  private isRefreshBackoffActive(): boolean {
    return (
      this.retryRefreshAt !== undefined &&
      this.clock.now() < this.retryRefreshAt
    );
  }

  private refresh(): Promise<readonly Station[]> {
    if (!this.refreshPromise) {
      this.logger.info(
        { event: "station_catalogue_refresh_started" },
        "Refreshing station catalogue",
      );
      this.refreshPromise = this.loadStations()
        .catch((error: unknown) => {
          const errorContext = describeCatalogueError(error);
          if (this.cache) {
            this.retryRefreshAt =
              this.clock.now() + Math.min(this.ttlMs, 60_000);
            this.logger.warn(
              {
                event: "station_catalogue_stale_fallback",
                ...errorContext,
              },
              "Station catalogue refresh failed; serving stale data",
            );
          } else {
            this.logger.warn(
              {
                event: "station_catalogue_unavailable",
                ...errorContext,
              },
              "Station catalogue could not be loaded",
            );
          }
          throw error;
        })
        .finally(() => {
          this.refreshPromise = undefined;
        });
    }

    return this.refreshPromise;
  }

  private async loadStations(): Promise<readonly Station[]> {
    const response = await this.irailClient.getStations();
    let stations: readonly Station[];
    try {
      stations = normalizeStations(response.stations);
    } catch (error) {
      if (error instanceof InvalidStationError) {
        throw new IRailError("iRail returned invalid station data.", {
          kind: "invalid-response",
          endpoint: "stations",
          cause: error,
        });
      }
      throw error;
    }

    this.cache = {
      loadedAt: this.clock.now(),
      stations,
    };
    this.retryRefreshAt = undefined;
    this.logger.info(
      {
        event: "station_catalogue_refresh_completed",
        stationCount: stations.length,
      },
      "Station catalogue refreshed",
    );

    return stations;
  }
}

function describeCatalogueError(error: unknown): Record<string, unknown> {
  if (error instanceof IRailError) {
    return {
      upstreamKind: error.kind,
      upstreamStatus: error.status,
    };
  }

  return {
    errorName: error instanceof Error ? error.name : "UnknownThrownValue",
  };
}
