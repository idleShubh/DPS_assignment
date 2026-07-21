export interface Station {
  readonly id: string;
  readonly name: string;
  readonly searchNames: readonly string[];
}

export interface StationSummary {
  readonly id: string;
  readonly name: string;
}
