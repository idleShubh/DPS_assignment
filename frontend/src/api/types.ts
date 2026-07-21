export interface DepartureResponse {
  readonly requestId: string;
  readonly query: string;
  readonly partial: boolean;
  readonly window: {
    readonly from: string;
    readonly to: string;
  };
  readonly stations: readonly StationResponse[];
  readonly warnings: readonly DepartureWarningResponse[];
}

export interface StationResponse {
  readonly id: string;
  readonly name: string;
  readonly departures: readonly DepartureItemResponse[];
}

export interface DepartureItemResponse {
  readonly id: string;
  readonly trainNumber: string;
  readonly destination: string;
  readonly scheduledDeparture: string;
  readonly delayMinutes: number;
  readonly cancelled: boolean;
}

export type DepartureWarningCode =
  | "LIVEBOARD_TIMEOUT"
  | "LIVEBOARD_UNAVAILABLE"
  | "LIVEBOARD_INVALID_RESPONSE";

export interface DepartureWarningResponse {
  readonly code: DepartureWarningCode;
  readonly stationId: string;
  readonly stationName: string;
}

export type ApiErrorCode =
  | "QUERY_REQUIRED"
  | "QUERY_TOO_SHORT"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ErrorResponse {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly requestId: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}
