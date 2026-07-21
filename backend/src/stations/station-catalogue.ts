import type { Station } from "../domain/station.js";
import type { IRailClient } from "../irail/irail-client.js";
import { IRailError } from "../irail/irail-errors.js";
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
        this.retryRefreshAt =
          this.clock.now() + Math.min(this.ttlMs, 60_000);
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
      this.refreshPromise = this.loadStations().finally(() => {
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

    return stations;
  }
}
