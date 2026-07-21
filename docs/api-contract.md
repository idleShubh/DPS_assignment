# Departures API contract

## Endpoint

`GET /api/departures?q={station-name-substring}`

The endpoint finds every station whose supported name contains `q`, then returns departures scheduled within one consistent 15-minute window.

## Query rules

- `q` is required.
- Leading and trailing whitespace is removed before validation and matching.
- The trimmed query must contain at least three Unicode characters.
- Substring matching is case- and accent-insensitive.
- Matching considers both the localized display name returned in English and iRail's standard station name.
- Punctuation such as hyphens remains significant; substring matching does not silently become fuzzy matching.
- The successful response echoes the trimmed query while preserving its submitted casing.

For example, `liege` matches `Liège-Guillemins`, and `brux` can match the standard or alternative name of a station displayed as `Brussels-Central`. Misspellings remain outside the core substring behavior and belong to the optional fuzzy-search bonus.

## Time-window semantics

The server captures the current instant exactly once at the beginning of a valid search. The window is inclusive at both ends:

`scheduledDeparture >= window.from && scheduledDeparture <= window.to`

`window.to` is exactly 15 minutes after `window.from`. Every matching station is filtered with these same instants, regardless of when its liveboard response arrives.

Filtering uses the original scheduled departure time. Delay does not move a train into or out of the window. A cancelled departure is included when its scheduled time falls inside the window.

All response timestamps are ISO 8601 instants in UTC, including the `Z` suffix. Presentation in Europe/Brussels time is a frontend responsibility.

## Successful response

Status: `200 OK`

```json
{
  "requestId": "b96e02c8-7570-45b8-a24d-d7bfa67bba50",
  "query": "Bru",
  "partial": false,
  "window": {
    "from": "2026-07-21T10:00:00.000Z",
    "to": "2026-07-21T10:15:00.000Z"
  },
  "stations": [
    {
      "id": "BE.NMBS.008891009",
      "name": "Brugge",
      "departures": [
        {
          "id": "http://irail.be/connections/8891009/20260721/IC3033",
          "trainNumber": "IC3033",
          "destination": "Antwerpen-Centraal",
          "scheduledDeparture": "2026-07-21T10:08:00.000Z",
          "delayMinutes": 4,
          "cancelled": false
        }
      ]
    }
  ],
  "warnings": []
}
```

### Response rules

- Stations are ordered alphabetically by display name, with station ID as the tie-breaker.
- Departures are ordered by scheduled time, with departure ID as the tie-breaker.
- A train appearing at multiple matching stations appears once in each applicable station group. These are distinct departure events.
- Exact duplicate records within the same station are removed using their stable departure identity.
- `delayMinutes` is a non-negative whole number. Upstream delay seconds are divided by 60 and floored, so 119 seconds is displayed as 1 minute.
- `cancelled` is always a JSON boolean.
- `partial` is `true` exactly when at least one matching station succeeded and at least one matching station failed.

## Empty results

Empty results are successful responses, not errors.

### No matching stations

`stations` and `warnings` are both empty. `partial` is `false`.

### Matching stations without imminent departures

Each successfully loaded matching station remains in `stations` with an empty `departures` array. This distinguishes “no station matched” from “stations matched but have no scheduled departures in the window.”

## Partial results

If some liveboards succeed and others fail, the API preserves the successful results and returns `200 OK` with `partial: true`.

```json
{
  "requestId": "b96e02c8-7570-45b8-a24d-d7bfa67bba50",
  "query": "Bru",
  "partial": true,
  "window": {
    "from": "2026-07-21T10:00:00.000Z",
    "to": "2026-07-21T10:15:00.000Z"
  },
  "stations": [
    {
      "id": "BE.NMBS.008891009",
      "name": "Brugge",
      "departures": []
    }
  ],
  "warnings": [
    {
      "code": "LIVEBOARD_TIMEOUT",
      "stationId": "BE.NMBS.008812005",
      "stationName": "Brussels-Central"
    }
  ]
}
```

Failed stations are omitted from `stations`; an empty departures list would incorrectly imply that their liveboard loaded successfully. Each failed station instead appears in `warnings` with one of these codes:

- `LIVEBOARD_TIMEOUT`: the upstream request exceeded its deadline.
- `LIVEBOARD_UNAVAILABLE`: the upstream service rejected or could not complete the request.
- `LIVEBOARD_INVALID_RESPONSE`: the response could not be safely interpreted.

A partial response always contains at least one successful station group. Otherwise the request is a total upstream failure and uses the error response.

## Error response

Errors use a stable JSON envelope:

```json
{
  "error": {
    "code": "QUERY_TOO_SHORT",
    "message": "Enter at least 3 characters.",
    "requestId": "b96e02c8-7570-45b8-a24d-d7bfa67bba50",
    "details": {
      "minimumLength": 3
    }
  }
}
```

| Situation | Status | Error code |
| --- | ---: | --- |
| Missing or blank `q` | `400` | `QUERY_REQUIRED` |
| Trimmed `q` shorter than three characters | `400` | `QUERY_TOO_SHORT` |
| Station catalogue or all liveboards time out | `504` | `UPSTREAM_TIMEOUT` |
| Station catalogue fails, or all liveboards fail with at least one non-timeout failure | `502` | `UPSTREAM_UNAVAILABLE` |
| Unexpected application defect | `500` | `INTERNAL_ERROR` |

If all liveboards fail and failures are mixed, `UPSTREAM_UNAVAILABLE` takes precedence over `UPSTREAM_TIMEOUT`. Public errors never include stack traces, raw upstream bodies, or internal implementation details.

## Stability boundary

This contract is owned by the Lagovia API. Third-party iRail response fields are normalized at the backend boundary and are not exposed directly. Changes to iRail must therefore be handled in the adapter without silently changing this public response shape.
