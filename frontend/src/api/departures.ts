import type {
  ApiErrorCode,
  DepartureResponse,
  DepartureWarningCode,
  ErrorResponse,
} from "./types";

type FetchImplementation = typeof fetch;

export type DeparturesApiErrorKind =
  | "validation"
  | "upstream"
  | "internal"
  | "network"
  | "invalid-response";

export class DeparturesApiError extends Error {
  readonly kind: DeparturesApiErrorKind;
  readonly status: number | undefined;
  readonly code: ApiErrorCode | undefined;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    options: {
      readonly kind: DeparturesApiErrorKind;
      readonly status?: number;
      readonly code?: ApiErrorCode;
      readonly requestId?: string;
      readonly cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "DeparturesApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

export interface DeparturesClient {
  getDepartures(query: string, signal?: AbortSignal): Promise<DepartureResponse>;
}

export function createDeparturesClient(options?: {
  readonly baseUrl?: string;
  readonly fetchImplementation?: FetchImplementation;
}): DeparturesClient {
  const baseUrl = normalizeBaseUrl(options?.baseUrl ?? defaultBaseUrl());
  const fetchImplementation = options?.fetchImplementation ?? fetch;

  return {
    async getDepartures(query: string, signal?: AbortSignal) {
      const url = new URL("/api/departures", `${baseUrl}/`);
      url.searchParams.set("q", query);

      let response: Response;
      try {
        response = await fetchImplementation(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal,
        });
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        throw new DeparturesApiError("Unable to reach the departures API.", {
          kind: "network",
          cause: error,
        });
      }

      const body = await readJson(response);
      if (!response.ok) {
        if (!isErrorResponse(body)) {
          throw invalidResponseError(response.status);
        }
        throw new DeparturesApiError(body.error.message, {
          kind: errorKindFor(body.error.code),
          status: response.status,
          code: body.error.code,
          requestId: body.error.requestId,
        });
      }

      if (!isDepartureResponse(body)) {
        throw invalidResponseError(response.status);
      }

      return body;
    },
  };
}

export const departuresClient = createDeparturesClient();

function defaultBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }
  return globalThis.location?.origin ?? "http://localhost";
}

function normalizeBaseUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TypeError("API base URL must use http or https.");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new DeparturesApiError("The departures API returned malformed JSON.", {
      kind: "invalid-response",
      status: response.status,
      cause: error,
    });
  }
}

function invalidResponseError(status: number): DeparturesApiError {
  return new DeparturesApiError(
    "The departures API returned an unexpected response.",
    { kind: "invalid-response", status },
  );
}

function errorKindFor(code: ApiErrorCode): DeparturesApiErrorKind {
  if (code === "QUERY_REQUIRED" || code === "QUERY_TOO_SHORT") {
    return "validation";
  }
  if (code === "UPSTREAM_TIMEOUT" || code === "UPSTREAM_UNAVAILABLE") {
    return "upstream";
  }
  return "internal";
}

function isDepartureResponse(value: unknown): value is DepartureResponse {
  if (!isRecord(value)) {
    return false;
  }
  if (
    !isString(value.requestId) ||
    !isString(value.query) ||
    typeof value.partial !== "boolean" ||
    !isWindow(value.window) ||
    !Array.isArray(value.stations) ||
    !value.stations.every(isStation) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(isWarning)
  ) {
    return false;
  }
  return value.partial
    ? value.stations.length > 0 && value.warnings.length > 0
    : value.warnings.length === 0;
}

function isWindow(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.from) || !isString(value.to)) {
    return false;
  }
  return isValidTimestamp(value.from) && isValidTimestamp(value.to);
}

function isStation(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    Array.isArray(value.departures) &&
    value.departures.every(isDeparture)
  );
}

function isDeparture(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.trainNumber) &&
    isString(value.destination) &&
    isString(value.scheduledDeparture) &&
    isValidTimestamp(value.scheduledDeparture) &&
    typeof value.delayMinutes === "number" &&
    Number.isSafeInteger(value.delayMinutes) &&
    value.delayMinutes >= 0 &&
    typeof value.cancelled === "boolean"
  );
}

const warningCodes: ReadonlySet<DepartureWarningCode> = new Set([
  "LIVEBOARD_TIMEOUT",
  "LIVEBOARD_UNAVAILABLE",
  "LIVEBOARD_INVALID_RESPONSE",
]);

function isWarning(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    warningCodes.has(value.code as DepartureWarningCode) &&
    isString(value.stationId) &&
    isString(value.stationName)
  );
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  if (!isRecord(value) || !isRecord(value.error)) {
    return false;
  }
  return (
    isApiErrorCode(value.error.code) &&
    isString(value.error.message) &&
    isString(value.error.requestId)
  );
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    value === "QUERY_REQUIRED" ||
    value === "QUERY_TOO_SHORT" ||
    value === "UPSTREAM_TIMEOUT" ||
    value === "UPSTREAM_UNAVAILABLE" ||
    value === "INTERNAL_ERROR"
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
