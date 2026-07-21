# Lagovia Train Tracker

Lagovia searches every Belgian railway station whose name contains a submitted substring and shows departures scheduled in one consistent 15-minute window. Results are grouped by station and include scheduled time, train number, destination, delay and cancellation status.

## Requirements

- Node.js 20 or newer
- npm

The application uses the public [iRail API](https://docs.irail.be/) and does not require API credentials. Set a useful contact address in `IRAIL_USER_AGENT` before deploying or making sustained requests.

## Run locally

```sh
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. The backend listens on `http://localhost:3000`; Vite proxies `/api` requests to it during development.

To run the processes separately:

```sh
npm run dev:backend
npm run dev:frontend
```

`VITE_API_BASE_URL` is available for environments where the frontend and API use different origins. Vite reads frontend environment variables from the `frontend` workspace, so place a frontend-specific override in `frontend/.env.local` when needed.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

The tests cover normalization, caching, substring matching, the time window, concurrency and partial failures, the HTTP contract, frontend response validation, stale-request cancellation, rendering and the integrated search workflow.

## API

```http
GET /api/departures?q=Bru
```

Queries are trimmed and must contain at least three Unicode characters. The full response and error schema is documented in [docs/api-contract.md](docs/api-contract.md).

Example success:

```json
{
  "requestId": "b96e02c8-7570-45b8-a24d-d7bfa67bba50",
  "query": "Bru",
  "partial": false,
  "window": {
    "from": "2026-07-21T10:00:00.000Z",
    "to": "2026-07-21T10:15:00.000Z"
  },
  "stations": [],
  "warnings": []
}
```

## Architecture

The backend is an Express application split into explicit boundaries:

- `irail`: timeout-aware upstream adapter and response types
- `stations`: cached catalogue, normalization and accent-insensitive substring matching
- `departures`: normalization, time filtering and concurrent search orchestration
- `http`: stable API mapping, request IDs, logging and public error handling
- `domain`: application-owned station and departure models

The React frontend has a similarly narrow flow:

- `api`: runtime validation of the Lagovia API contract
- `hooks`: request lifecycle, cancellation and stale-response protection
- `components`: independently tested search and result presentation
- `App`: composition of idle, loading, success, partial and error states

Third-party iRail data never crosses directly into the public API or UI. Both boundaries normalize and validate data before using it.

## Key decisions and trade-offs

### One reference instant

The backend captures the clock once after validating the query. All liveboards use the same inclusive window from that instant through exactly 15 minutes later. Delays do not move a train into or out of the window; filtering uses scheduled time.

### Partial failures

Successful station results are preserved when some liveboards fail. The API returns `200`, `partial: true` and station-specific warnings. It fails the whole request only when the catalogue fails or no liveboard succeeds. This keeps useful data without pretending failed stations had no departures.

### Repeated trains

A train appearing at multiple matching stations is shown once under each station because those are distinct departure events. Exact duplicates inside one station are removed using the upstream departure identity.

### Caching and concurrency

The station catalogue is cached in memory for six hours by default, including reuse of an in-flight refresh. Liveboards use bounded concurrency rather than an unbounded `Promise.all`, reducing pressure on iRail at the cost of slightly longer searches with many matches.

### Frontend validation

The browser validates short queries for immediate feedback, but the backend remains authoritative. Successful JSON is runtime-checked rather than trusted through TypeScript alone. New searches abort older requests, and late responses cannot overwrite newer results.

### Presentation time zone

The API returns UTC instants. The frontend explicitly formats scheduled departures in `Europe/Brussels`, avoiding dependence on the viewer's machine time zone.

## Error handling and observability

Public errors use stable codes and never expose upstream bodies or stack traces. Every request receives a request ID, returned in errors and emitted in structured logs. Partial station failures are logged and returned as safe warning codes. See [docs/observability.md](docs/observability.md).

## Known limitations

- Station and liveboard caches are process-local; multiple instances do not share cache state.
- Searches are substring-based, not fuzzy. Misspellings such as `Antverpen` are outside the core scope.
- No pagination is applied because the 15-minute window naturally bounds result size.
- Upstream data freshness and accuracy remain dependent on iRail.
- The current visual design prioritizes clarity and accessibility; a more distinctive brand redesign is intentionally deferred.
- There is no browser-level end-to-end test against live iRail. Deterministic integration tests use controlled dependencies to avoid flaky external-network assertions.

## AI usage

AI-assisted work is documented in [AI_USAGE.md](AI_USAGE.md).
