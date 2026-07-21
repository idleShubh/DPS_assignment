// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DeparturesApiError,
  type DeparturesClient,
} from "./api/departures";
import type { DepartureResponse } from "./api/types";
import { App } from "./App";

afterEach(cleanup);

const successfulResponse: DepartureResponse = {
  requestId: "request-success",
  query: "Bru",
  partial: false,
  window: {
    from: "2026-07-21T10:00:00.000Z",
    to: "2026-07-21T10:15:00.000Z",
  },
  stations: [
    {
      id: "station-1",
      name: "Brussels-Central",
      departures: [
        {
          id: "departure-1",
          trainNumber: "IC 2312",
          destination: "Leuven",
          scheduledDeparture: "2026-07-21T10:01:00.000Z",
          delayMinutes: 4,
          cancelled: false,
        },
      ],
    },
  ],
  warnings: [],
};

describe("App", () => {
  it("renders a useful empty state and lets examples start a search", () => {
    const client = createClient();
    vi.mocked(client.getDepartures).mockReturnValue(new Promise(() => undefined));
    render(<App client={client} />);

    expect(
      screen.getByRole("heading", { name: "Your departures will appear here" }),
    ).toBeTruthy();
    expect(
      screen.getByText((_, element) =>
        element?.classList.contains("departure-empty__note") ?? false,
      ).textContent,
    ).toContain("Multiple matching stations");

    fireEvent.click(screen.getByRole("button", { name: "Search for Mech" }));

    expect(client.getDepartures).toHaveBeenCalledWith(
      "Mech",
      expect.any(AbortSignal),
    );
    expect(screen.getByText("Finding departures for “Mech”…")).toBeTruthy();
  });

  it("submits the query and renders returned departures", async () => {
    const client = createClient();
    vi.mocked(client.getDepartures).mockResolvedValue(successfulResponse);
    render(<App client={client} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Station name" }), {
      target: { value: "Bru" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find departures" }));

    expect(client.getDepartures).toHaveBeenCalledWith("Bru", expect.any(AbortSignal));
    expect(
      await screen.findByRole("heading", { name: "Brussels-Central (1)" }),
    ).toBeTruthy();
    expect(screen.getByText("IC 2312")).toBeTruthy();
  });

  it("disables submission and announces loading", () => {
    const client = createClient();
    vi.mocked(client.getDepartures).mockReturnValue(new Promise(() => undefined));
    render(<App client={client} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Station name" }), {
      target: { value: "Aac" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find departures" }));

    expect(screen.getByRole("button", { name: "Find departures" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Finding departures for “Aac”…")).toBeTruthy();
  });

  it("renders a typed API error and its request reference", async () => {
    const client = createClient();
    vi.mocked(client.getDepartures).mockRejectedValue(
      new DeparturesApiError("The rail service did not respond in time.", {
        kind: "upstream",
        status: 504,
        code: "UPSTREAM_TIMEOUT",
        requestId: "request-timeout",
      }),
    );
    render(<App client={client} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Station name" }), {
      target: { value: "Bru" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find departures" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The rail service did not respond in time.");
    expect(alert.textContent).toContain("Reference: request-timeout");
  });

  it("replaces an earlier result when a new search completes", async () => {
    const client = createClient();
    vi.mocked(client.getDepartures)
      .mockResolvedValueOnce(successfulResponse)
      .mockResolvedValueOnce({
        ...successfulResponse,
        query: "Aac",
        stations: [{ ...successfulResponse.stations[0]!, id: "station-2", name: "Aachen Hbf" }],
      });
    render(<App client={client} />);
    const input = screen.getByRole("searchbox", { name: "Station name" });

    fireEvent.change(input, { target: { value: "Bru" } });
    fireEvent.submit(input.closest("form")!);
    await screen.findByRole("heading", { name: "Brussels-Central (1)" });

    fireEvent.change(input, { target: { value: "Aac" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByRole("heading", { name: "Aachen Hbf (1)" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Brussels-Central (1)" })).toBeNull();
  });
});

function createClient(): DeparturesClient {
  return { getDepartures: vi.fn() };
}
