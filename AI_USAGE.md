# AI usage report

## Tools used

- OpenAI Codex was used as a collaborative engineering assistant for requirements analysis, architecture discussion, implementation planning, code generation, test generation, review and browser-based UI verification.
- OpenAI image generation was used to establish a visual direction for the initial search and departure-results interface.

No AI-generated answer was treated as authoritative for the iRail contract. Behaviour was checked against the challenge, the application-owned API contract and executable tests.

## Representative prompts and planning work

The working conversation included prompts covering:

- Identify the actual problem, hidden requirements, edge cases, likely interview criteria and failure scenarios without writing code.
- Challenge the backend, frontend, API, error-handling, caching and testing architecture.
- Define “scheduled within the next 15 minutes” precisely.
- Decide whether 10 successful liveboards and two timeouts should produce partial data or a total failure.
- Decide how to represent the same train at multiple matching stations.
- Capture the current time once so concurrent station filtering uses a consistent window.
- Break the project into independently buildable tasks with objectives, files, outputs and acceptance criteria.
- Implement and verify those tasks incrementally rather than generating the whole assignment in one pass.

Public conversation links are not included because no public share URL was created for the private working session.

## Accepted substantially as generated

- The layered boundary between iRail data, domain models and the public API.
- The single-instant time-window rule and inclusive endpoints.
- Partial-success semantics and station-specific warnings.
- Bounded liveboard concurrency and in-memory station caching.
- Typed frontend request state with cancellation and stale-result protection.
- The initial accessible search and grouped-results component structure.

All accepted code was reviewed through typechecking, focused tests and full-suite verification.

## Rewritten or adjusted

- Naming, response details and error precedence were tightened while writing the API contract.
- Tests were expanded around Unicode query length, accent-insensitive matching, boundary timestamps, mixed upstream failures, duplicate records and race conditions.
- UI markup and responsive styles were adjusted after desktop and mobile browser inspection.
- Development startup was changed to launch both workspaces together instead of relying on ambiguous workspace script behaviour.

## Rejected or deferred

- Failing an entire request when only some liveboards fail; this discards useful data.
- Deduplicating a train across different stations; each station occurrence is a distinct departure event.
- Filtering by delayed rather than scheduled time; this conflicts with the defined departure window.
- Unbounded fan-out to every matching liveboard.
- Exposing raw iRail responses or internal exception details to clients.
- Fuzzy search, distributed caching and pagination, because they add complexity beyond the core assignment.
- A more experimental visual redesign, deferred until the functional submission baseline is complete.
