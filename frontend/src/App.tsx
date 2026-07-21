import { SearchForm } from "./components/SearchForm";
import "./styles.css";

export function App() {
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
          <SearchForm onSearch={() => undefined} />
        </section>
      </main>
    </div>
  );
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
