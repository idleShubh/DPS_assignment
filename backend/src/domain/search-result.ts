import type { Departure } from "./departure.js";
import type { StationSummary } from "./station.js";

export interface DepartureWindow {
  readonly from: Date;
  readonly to: Date;
}

export interface StationDepartures {
  readonly station: StationSummary;
  readonly departures: readonly Departure[];
}

export type DepartureWarningCode =
  | "LIVEBOARD_TIMEOUT"
  | "LIVEBOARD_UNAVAILABLE"
  | "LIVEBOARD_INVALID_RESPONSE";

export interface DepartureWarning {
  readonly code: DepartureWarningCode;
  readonly station: StationSummary;
}

export interface DepartureSearchResult {
  readonly query: string;
  readonly window: DepartureWindow;
  readonly stations: readonly StationDepartures[];
  readonly warnings: readonly DepartureWarning[];
}
