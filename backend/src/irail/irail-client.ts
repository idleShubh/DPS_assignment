import type { AppConfig } from "../config.js";
import { IRailError } from "./irail-errors.js";
import type {
  IRailDepartureRecord,
  IRailLiveboardResponse,
  IRailStationRecord,
  IRailStationsResponse,
} from "./irail-types.js";

type FetchImplementation = typeof fetch;
type IRailEndpoint = "stations" | "liveboard";

export interface IRailClient {
  getStations(): Promise<IRailStationsResponse>;
  getLiveboard(stationId: string): Promise<IRailLiveboardResponse>;
}

export class HttpIRailClient implements IRailClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly fetchImplementation: FetchImplementation;

  constructor(
    config: AppConfig["irail"],
    fetchImplementation: FetchImplementation = fetch,
  ) {
    this.baseUrl = config.baseUrl;
    this.timeoutMs = config.timeoutMs;
    this.userAgent = config.userAgent;
    this.fetchImplementation = fetchImplementation;
  }

  async getStations(): Promise<IRailStationsResponse> {
    const url = this.createUrl("/stations/");
    url.searchParams.set("format", "json");
    url.searchParams.set("lang", "en");

    const body = await this.requestJson(url, "stations");
    return parseStationsResponse(body);
  }

  async getLiveboard(stationId: string): Promise<IRailLiveboardResponse> {
    const url = this.createUrl("/liveboard/");
    url.searchParams.set("id", stationId);
    url.searchParams.set("arrdep", "departure");
    url.searchParams.set("format", "json");
    url.searchParams.set("lang", "en");
    url.searchParams.set("alerts", "false");

    const body = await this.requestJson(url, "liveboard");
    return parseLiveboardResponse(body);
  }

  private createUrl(path: string): URL {
    return new URL(path, `${this.baseUrl}/`);
  }

  private async requestJson(
    url: URL,
    endpoint: IRailEndpoint,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImplementation(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": this.userAgent,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new IRailError(
          `iRail ${endpoint} request failed with status ${response.status}.`,
          { kind: "http", endpoint, status: response.status },
        );
      }

      try {
        return await response.json();
      } catch (error) {
        throw new IRailError(
          `iRail ${endpoint} returned malformed JSON.`,
          { kind: "invalid-response", endpoint, cause: error },
        );
      }
    } catch (error) {
      if (error instanceof IRailError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new IRailError(`iRail ${endpoint} request timed out.`, {
          kind: "timeout",
          endpoint,
          cause: error,
        });
      }

      throw new IRailError(`iRail ${endpoint} request failed.`, {
        kind: "network",
        endpoint,
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseStationsResponse(body: unknown): IRailStationsResponse {
  const response = requireRecord(body, "stations");
  const version = requireString(response.version, "stations.version");
  const timestamp = requireFiniteNumber(
    response.timestamp,
    "stations.timestamp",
  );
  const rawStations = Array.isArray(response.station)
    ? response.station
    : [response.station];

  const stations = rawStations.map((station, index) =>
    parseStation(station, `stations.station[${index}]`),
  );

  return { version, timestamp, stations };
}

function parseLiveboardResponse(body: unknown): IRailLiveboardResponse {
  const response = requireRecord(body, "liveboard");
  const version = requireString(response.version, "liveboard.version");
  const timestamp = requireFiniteNumber(
    response.timestamp,
    "liveboard.timestamp",
  );
  const station = requireString(response.station, "liveboard.station");
  const stationinfo = parseStation(
    response.stationinfo,
    "liveboard.stationinfo",
  );
  const departures = requireRecord(
    response.departures,
    "liveboard.departures",
  );
  const number = requireFiniteNumber(
    departures.number,
    "liveboard.departures.number",
  );

  let departure: readonly IRailDepartureRecord[];
  if (departures.departure === undefined && number === 0) {
    departure = [];
  } else if (Array.isArray(departures.departure)) {
    departure = departures.departure.map((item, index) =>
      requireRecord(
        item,
        `liveboard.departures.departure[${index}]`,
      ),
    );
  } else {
    throw invalidResponse("liveboard.departures.departure must be an array.");
  }

  return {
    version,
    timestamp,
    station,
    stationinfo,
    departures: { number, departure },
  };
}

function parseStation(value: unknown, path: string): IRailStationRecord {
  const station = requireRecord(value, path);
  const parsed: IRailStationRecord = {
    id: requireString(station.id, `${path}.id`),
    name: requireString(station.name, `${path}.name`),
    standardname: requireString(station.standardname, `${path}.standardname`),
  };

  return parsed;
}

function requireRecord(
  value: unknown,
  path: string,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResponse(`${path} must be an object.`);
  }

  return value as Readonly<Record<string, unknown>>;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw invalidResponse(`${path} must be a non-empty string.`);
  }

  return value;
}

function requireFiniteNumber(value: unknown, path: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    throw invalidResponse(`${path} must be a finite number.`);
  }

  return parsed;
}

function invalidResponse(message: string): IRailError {
  return new IRailError(`Invalid iRail response: ${message}`, {
    kind: "invalid-response",
    endpoint: message.startsWith("stations") ? "stations" : "liveboard",
  });
}
