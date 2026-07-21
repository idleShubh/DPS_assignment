export interface Departure {
  readonly id: string;
  readonly stationId: string;
  readonly trainNumber: string;
  readonly destination: string;
  readonly scheduledDeparture: Date;
  readonly delayMinutes: number;
  readonly cancelled: boolean;
}
