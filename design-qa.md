# Design QA

- Source visual truth: `docs/design/departures-empty-state-concept.png`
- Implementation screenshot: `/tmp/lagovia-empty-native.png`
- Comparison image: `/tmp/lagovia-comparison-final.png`
- Viewport: requested 1640 × 960; in-app browser capture surface was capped at 1280 × 720 with the same 16:9 ratio
- State: initial/idle departure state
- Capture method: Codex in-app browser screenshot

## Full-view comparison evidence

The source and implementation were normalized to the same 16:9 ratio and inspected together. The 40/60 split, rounded app shell, cobalt/coral palette, oversized headings, centered empty-state hierarchy, example controls, preview table, and reassurance copy match the selected concept. No P0, P1, or P2 differences remain.

## Focused comparison evidence

A separate crop was unnecessary because all important text, controls, illustration details, and table anatomy remained readable in the full-width comparison.

## Fidelity ledger

| Surface | Source evidence | Render evidence | Result |
| --- | --- | --- | --- |
| Typography | Heavy display headings with compact tracking; restrained body and label text | Same hierarchy, weight, wrapping, and control typography | Passed |
| Layout | 40/60 split with centered right-panel content and generous white space | Same container model and visual balance at desktop; clean stacked mobile reflow | Passed |
| Colors | White surface, cobalt panel, coral CTA, blue outlined examples, lime illustration details | Tokens and illustration preserve the selected palette without gradients | Passed |
| Image asset | Flat train, station sign, clock, cloud, and shrubs | Dedicated generated raster asset is sharp, correctly framed, and blends into white | Passed |
| Copy | Selected empty-state heading, instruction, examples, preview labels, and live-data note | Above-the-fold copy matches exactly | Passed |
| Interaction | Example chips imply direct station searches | Bru, Aac, and Mech are real buttons using the existing search pipeline | Passed |
| Responsive behavior | Desktop source only | Verified at 390 × 844 with no clipping or horizontal overflow | Passed |

## Interaction and browser checks

- Clicked `Mech`; the empty state transitioned to real grouped departure results.
- Verified the existing form and live API workflow remained intact.
- Checked browser warnings and errors after idle render and live search: none.
- Verified desktop and 390 × 844 mobile layouts.

## Comparison history

The first comparison found no actionable P0/P1/P2 issues. The implementation intentionally keeps the existing responsive app shell and production result schema rather than copying mock-only proportions into live result states.

## Follow-up polish

- P3: The in-app browser capped the native capture at 1280 × 720, so exact 1640 × 960 pixel-level comparison was not available; the matching aspect ratio and an additional 1440 × 1024 check were used.

final result: passed
