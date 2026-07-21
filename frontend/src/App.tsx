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
      <header className="app-header">
        <a className="brand" href="/" aria-label="Lagovia home">
          <RailMark />
          <span>Lagovia</span>
        </a>
      </header>
      <main className="main-content">
        <section className="search-intro" aria-labelledby="page-title">
          <h1 id="page-title">How late is your train?</h1>
          <p>
            Search every matching station for departures scheduled in the next
            15 minutes.
          </p>
          <SearchForm
            onSearch={search}
            isSubmitting={state.status === "loading"}
          />
        </section>
        <SearchOutcome state={state} />
      </main>
    </div>
  );
}

function SearchOutcome({
  state,
}: {
  readonly state: ReturnType<typeof useDepartureSearch>["state"];
}) {
  if (state.status === "idle") {
    return null;
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

function RailMark() {
  return (
    <svg
      className="brand__mark"
      viewBox="0 0 54 30"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 6h25l10 12h15" />
      <path d="M2 14h20l10 12h20" />
      <path d="M2 22h14" />
    </svg>
  );
}
