// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { DepartureResponse } from "../api/types";
import { DepartureResults } from "./DepartureResults";

afterEach(cleanup);

const response: DepartureResponse = {
  requestId: "request-1",
  query: "Bru",
  partial: false,
  window: {
    from: "2026-07-21T10:00:00.000Z",
    to: "2026-07-21T10:15:00.000Z",
  },
  stations: [
    {
      id: "station-brussels",
      name: "Brussels-Central",
      departures: [
        {
          id: "departure-on-time",
          trainNumber: "IC 2312",
          destination: "Leuven",
          scheduledDeparture: "2026-07-21T10:01:00.000Z",
          delayMinutes: 0,
          cancelled: false,
        },
        {
          id: "departure-delayed",
          trainNumber: "S 5158",
          destination: "Malines",
          scheduledDeparture: "2026-07-21T10:04:00.000Z",
          delayMinutes: 7,
          cancelled: false,
        },
        {
          id: "departure-cancelled",
          trainNumber: "IC 531",
          destination: "Brugge",
          scheduledDeparture: "2026-07-21T10:11:00.000Z",
          delayMinutes: 3,
          cancelled: true,
        },
      ],
    },
  ],
  warnings: [],
};

describe("DepartureResults", () => {
  it("groups departures under their station and exposes table headings", () => {
    render(<DepartureResults response={response} />);

    const station = screen.getByRole("region", {
      name: "Brussels-Central (3)",
    });
    expect(within(station).getByRole("table")).toBeTruthy();
    for (const heading of ["Scheduled", "Destination", "Train", "Status"]) {
      expect(within(station).getByRole("columnheader", { name: heading })).toBeTruthy();
    }
  });

  it("renders Belgian-local times and every departure field", () => {
    render(<DepartureResults response={response} />);

    expect(screen.getByText("12:01").getAttribute("datetime")).toBe(
      "2026-07-21T10:01:00.000Z",
    );
    expect(screen.getByText("Leuven")).toBeTruthy();
    expect(screen.getByText("IC 2312")).toBeTruthy();
  });

  it("distinguishes on-time, delayed, and cancelled departures", () => {
    render(<DepartureResults response={response} />);

    expect(screen.getByText("On time")).toBeTruthy();
    expect(screen.getByText("+7 min")).toBeTruthy();
    expect(screen.getByText("Cancelled")).toBeTruthy();
    expect(screen.queryByText("+3 min")).toBeNull();
  });

  it("renders the same train once in each station group", () => {
    render(
      <DepartureResults
        response={{
          ...response,
          stations: [
            response.stations[0]!,
            {
              id: "station-north",
              name: "Brussels-North",
              departures: [response.stations[0]!.departures[0]!],
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("IC 2312")).toHaveLength(2);
  });

  it("lists unavailable stations when results are partial", () => {
    render(
      <DepartureResults
        response={{
          ...response,
          partial: true,
          warnings: [
            {
              code: "LIVEBOARD_TIMEOUT",
              stationId: "station-midi",
              stationName: "Brussels-Midi",
            },
            {
              code: "LIVEBOARD_UNAVAILABLE",
              stationId: "station-north",
              stationName: "Brussels-North",
            },
          ],
        }}
      />,
    );

    const warning = screen.getByRole("status");
    expect(warning.textContent).toContain("Some stations couldn’t be loaded.");
    expect(warning.textContent).toContain("Brussels-Midi, Brussels-North");
  });

  it("explains when no station matches", () => {
    render(
      <DepartureResults response={{ ...response, stations: [], query: "Nope" }} />,
    );

    expect(screen.getByRole("heading", { name: "No matching stations" })).toBeTruthy();
    expect(screen.getByText(/containing “Nope”/)).toBeTruthy();
  });

  it("distinguishes matched stations with no imminent departures", () => {
    render(
      <DepartureResults
        response={{
          ...response,
          stations: [{ ...response.stations[0]!, departures: [] }],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "No departures soon" })).toBeTruthy();
    expect(screen.getByText(/matching stations/)).toBeTruthy();
  });

  it("keeps an empty station visible when another station has departures", () => {
    render(
      <DepartureResults
        response={{
          ...response,
          stations: [
            response.stations[0]!,
            { id: "station-empty", name: "Brussels-West", departures: [] },
          ],
        }}
      />,
    );

    const station = screen.getByRole("region", { name: "Brussels-West (0)" });
    expect(within(station).getByText("No departures in this window.")).toBeTruthy();
  });
});
