# Backend observability

The backend writes one JSON object per log line. Production composition uses the built-in JSON console logger; tests and alternate runtimes can inject any implementation of the small `Logger` interface.

## Events

- `request_completed`: method, path without query parameters, status, duration, and request ID.
- `liveboard_failed`: station ID, safe upstream classification, warning code, and request ID.
- `departure_search_partial`: successful station count, failed station IDs, and request ID.
- `departure_search_failed`: failed station IDs and request ID when every liveboard fails.
- `request_upstream_failure`: request-level 502/504 classification and request ID.
- `unexpected_request_error`: internal error name, message, stack, and request ID. These details are logged server-side only.
- `station_catalogue_refresh_started` and `station_catalogue_refresh_completed`: process-scoped cache lifecycle events.
- `station_catalogue_stale_fallback` and `station_catalogue_unavailable`: safe cache refresh failure metadata.

Station catalogue events do not carry a request ID because a single shared refresh can serve multiple concurrent requests. All request-scoped events do.

## Data-safety policy

Logs must not contain raw iRail response bodies, individual departure payloads, environment variables, credentials, or stack traces in client responses. Upstream failures are logged using only their endpoint, error category, HTTP status when available, and affected station IDs.

Request logs intentionally record the URL path without its query string. Search-service summaries contain the normalized station query for diagnosis but never contain departure results.
