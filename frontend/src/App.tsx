import type { DeparturesClient } from "./api/departures";
import { departuresClient } from "./api/departures";
import { DepartureResults } from "./components/DepartureResults";
import { SearchForm } from "./components/SearchForm";
import { useDepartureSearch } from "./hooks/useDepartureSearch";
import "./styles.css";

interface AppProps {
  readonly client?: DeparturesClient;
}

export function App({ client = departuresClient }: AppProps) {
  const { state, search } = useDepartureSearch(client);

  return (
    <div className="app-shell">
      <section className="search-panel" aria-labelledby="page-title">
        <a className="brand" href="/" aria-label="Lagovia home">
          <RailMark />
          <span className="brand__copy">
            <strong>Lagovia</strong>
            <small>Train tracker</small>
          </span>
        </a>
        <div className="search-panel__content">
          <h1 id="page-title">How late is your train?</h1>
          <p>
            Search every matching station for departures scheduled in the next
            15 minutes.
          </p>
          <SearchForm
            onSearch={search}
            isSubmitting={state.status === "loading"}
          />
        </div>
      </section>
      <main className="results-panel" aria-labelledby="results-title">
        <h2 className="results-panel__title" id="results-title">
          Departures
        </h2>
        <SearchOutcome state={state} onSearch={search} />
      </main>
    </div>
  );
}

function SearchOutcome({
  state,
  onSearch,
}: {
  readonly state: ReturnType<typeof useDepartureSearch>["state"];
  readonly onSearch: (query: string) => void | Promise<void>;
}) {
  if (state.status === "idle") {
    return <DepartureEmptyState onSearch={onSearch} />;
  }
  if (state.status === "loading") {
    return (
      <section className="search-loading" aria-live="polite" aria-busy="true">
        <span className="search-loading__indicator" aria-hidden="true" />
        <p>Finding departures for “{state.query}”…</p>
      </section>
    );
  }
  if (state.status === "error") {
    return (
      <section className="search-error" role="alert">
        <h2>We couldn’t load departures</h2>
        <p>{state.error.message}</p>
        {state.error.requestId ? (
          <small>Reference: {state.error.requestId}</small>
        ) : null}
      </section>
    );
  }
  return <DepartureResults response={state.data} />;
}

const exampleStations = ["Bru", "Aac", "Mech"] as const;

function DepartureEmptyState({
  onSearch,
}: {
  readonly onSearch: (query: string) => void | Promise<void>;
}) {
  return (
    <section className="departure-empty" aria-labelledby="empty-state-title">
      <img
        className="departure-empty__illustration"
        src="/assets/departures-empty-state.png"
        alt=""
      />
      <div className="departure-empty__intro">
        <h3 id="empty-state-title">Your departures will appear here</h3>
        <p>
          Search a station to see trains leaving in the next 15 minutes.
        </p>
      </div>
      <div className="departure-empty__examples" aria-label="Example searches">
        {exampleStations.map((station) => (
          <button
            key={station}
            type="button"
            onClick={() => void onSearch(station)}
            aria-label={`Search for ${station}`}
          >
            {station}
          </button>
        ))}
      </div>
      <div className="departure-preview" aria-hidden="true">
        <div className="departure-preview__head">
          <span>Time</span>
          <span>Destination</span>
          <span>Delay</span>
          <span>Platform</span>
        </div>
        {[0, 1].map((row) => (
          <div className="departure-preview__row" key={row}>
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
      <p className="departure-empty__note">
        Live data <span aria-hidden="true">·</span> Multiple matching stations
      </p>
    </section>
  );
}

function RailMark() {
  return (
    <svg
      className="brand__mark"
      viewBox="0 0 64 36"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 8h31l12 14h17" />
      <path d="M2 18h24l12 14h24" />
      <path d="M2 28h17" />
    </svg>
  );
}
