export interface IRailStationRecord {
  readonly id: string;
  readonly "@id"?: string;
  readonly name: string;
  readonly standardname: string;
  readonly locationX?: number | string;
  readonly locationY?: number | string;
}

export interface IRailStationsResponse {
  readonly version: string;
  readonly timestamp: number;
  readonly stations: readonly IRailStationRecord[];
}

export interface IRailDepartureRecord {
  readonly id?: number | string;
  readonly delay?: number | string;
  readonly station?: string;
  readonly time?: number | string;
  readonly vehicle?: string;
  readonly vehicleinfo?: Readonly<Record<string, unknown>>;
  readonly canceled?: number | string | boolean;
  readonly departureConnection?: string;
  readonly direction?: Readonly<Record<string, unknown>> | string;
  readonly [field: string]: unknown;
}

export interface IRailLiveboardResponse {
  readonly version: string;
  readonly timestamp: number;
  readonly station: string;
  readonly stationinfo: IRailStationRecord;
  readonly departures: {
    readonly number: number;
    readonly departure: readonly IRailDepartureRecord[];
  };
}
