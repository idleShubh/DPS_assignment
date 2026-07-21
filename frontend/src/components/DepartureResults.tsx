import type {
  DepartureItemResponse,
  DepartureResponse,
  DepartureWarningResponse,
  StationResponse,
} from "../api/types";

interface DepartureResultsProps {
  readonly response: DepartureResponse;
}

const belgianTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Brussels",
});

export function DepartureResults({ response }: DepartureResultsProps) {
  if (response.stations.length === 0) {
    return (
      <ResultsMessage
        title="No matching stations"
        message={`We couldn't find a station containing “${response.query}”.`}
      />
    );
  }

  const departureCount = response.stations.reduce(
    (total, station) => total + station.departures.length,
    0,
  );

  if (departureCount === 0) {
    return (
      <ResultsMessage
        title="No departures soon"
        message="We found matching stations, but none have departures scheduled in the next 15 minutes."
      />
    );
  }

  return (
    <section className="departure-results" aria-label="Departure results">
      {response.partial ? <PartialResultsWarning warnings={response.warnings} /> : null}
      <div className="station-list">
        {response.stations.map((station) => (
          <StationDepartures key={station.id} station={station} />
        ))}
      </div>
    </section>
  );
}

function StationDepartures({ station }: { readonly station: StationResponse }) {
  return (
    <section className="station-results" aria-labelledby={`station-${station.id}`}>
      <h3 id={`station-${station.id}`}>
        {station.name} <span>({station.departures.length})</span>
      </h3>
      {station.departures.length === 0 ? (
        <p className="station-results__empty">No departures in this window.</p>
      ) : (
        <div className="departure-table-wrap">
          <table className="departure-table">
            <thead>
              <tr>
                <th scope="col">Scheduled</th>
                <th scope="col">Destination</th>
                <th scope="col">Train</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {station.departures.map((departure) => (
                <DepartureRow key={departure.id} departure={departure} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DepartureRow({
  departure,
}: {
  readonly departure: DepartureItemResponse;
}) {
  const status = statusFor(departure);

  return (
    <tr>
      <td data-label="Scheduled">
        <time dateTime={departure.scheduledDeparture}>
          {formatBelgianTime(departure.scheduledDeparture)}
        </time>
      </td>
      <td data-label="Destination">{departure.destination}</td>
      <td data-label="Train">{departure.trainNumber}</td>
      <td data-label="Status">
        <span className={`departure-status departure-status--${status.tone}`}>
          {status.label}
        </span>
      </td>
    </tr>
  );
}

function PartialResultsWarning({
  warnings,
}: {
  readonly warnings: readonly DepartureWarningResponse[];
}) {
  const stationNames = warnings.map((warning) => warning.stationName).join(", ");

  return (
    <div className="results-warning" role="status">
      <strong>Some stations couldn’t be loaded.</strong>
      <span>
        Showing available departures. Missing: {stationNames}.
      </span>
    </div>
  );
}

function ResultsMessage({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}) {
  return (
    <section className="results-message" aria-live="polite">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

function formatBelgianTime(timestamp: string): string {
  return belgianTimeFormatter.format(new Date(timestamp));
}

function statusFor(departure: DepartureItemResponse): {
  readonly label: string;
  readonly tone: "cancelled" | "delayed" | "on-time";
} {
  if (departure.cancelled) {
    return { label: "Cancelled", tone: "cancelled" };
  }
  if (departure.delayMinutes > 0) {
    return { label: `+${departure.delayMinutes} min`, tone: "delayed" };
  }
  return { label: "On time", tone: "on-time" };
}
