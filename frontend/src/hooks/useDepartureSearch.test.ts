// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DeparturesApiError,
  type DeparturesClient,
} from "../api/departures";
import type { DepartureResponse } from "../api/types";
import { useDepartureSearch } from "./useDepartureSearch";

const baseResponse: DepartureResponse = {
  requestId: "request-1",
  query: "Bru",
  partial: false,
  window: {
    from: "2026-07-21T10:00:00.000Z",
    to: "2026-07-21T10:15:00.000Z",
  },
  stations: [
    {
      id: "BE.NMBS.1",
      name: "Bruges",
      departures: [
        {
          id: "connection-1",
          trainNumber: "IC1",
          destination: "Oostende",
          scheduledDeparture: "2026-07-21T10:05:00.000Z",
          delayMinutes: 0,
          cancelled: false,
        },
      ],
    },
  ],
  warnings: [],
};

describe("useDepartureSearch", () => {
  it("moves from idle through loading to complete success", async () => {
    const response = deferred<DepartureResponse>();
    const client = createClient();
    vi.mocked(client.getDepartures).mockReturnValue(response.promise);
    const { result } = renderHook(() => useDepartureSearch(client));

    expect(result.current.state).toEqual({ status: "idle" });
    let searchPromise!: Promise<void>;
    act(() => {
      searchPromise = result.current.search("Bru");
    });
    expect(result.current.state).toEqual({ status: "loading", query: "Bru" });

    await act(async () => {
      response.resolve(baseResponse);
      await searchPromise;
    });

    expect(result.current.state).toMatchObject({
      status: "success",
      query: "Bru",
      resultKind: "complete",
      data: baseResponse,
    });
  });

  it.each([
    ["partial", { ...baseResponse, partial: true }],
    ["no-stations", { ...baseResponse, stations: [] }],
    [
      "no-departures",
      {
        ...baseResponse,
        stations: [{ ...baseResponse.stations[0]!, departures: [] }],
      },
    ],
  ] as const)("classifies %s success", async (resultKind, response) => {
    const client = createClient();
    vi.mocked(client.getDepartures).mockResolvedValue(response);
    const { result } = renderHook(() => useDepartureSearch(client));

    await act(async () => {
      await result.current.search("Bru");
    });

    expect(result.current.state).toMatchObject({ status: "success", resultKind });
  });

  it("keeps a newer result when an older request resolves later", async () => {
    const first = deferred<DepartureResponse>();
    const second = deferred<DepartureResponse>();
    const client = createClient();
    vi.mocked(client.getDepartures)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useDepartureSearch(client));

    let firstSearch!: Promise<void>;
    let secondSearch!: Promise<void>;
    act(() => {
      firstSearch = result.current.search("Bru");
      secondSearch = result.current.search("Aac");
    });

    await act(async () => {
      second.resolve({ ...baseResponse, query: "Aac" });
      await secondSearch;
    });
    await act(async () => {
      first.resolve(baseResponse);
      await firstSearch;
    });

    expect(result.current.state).toMatchObject({
      status: "success",
      query: "Aac",
      data: { query: "Aac" },
    });
    const firstSignal = vi.mocked(client.getDepartures).mock.calls[0]?.[1];
    expect(firstSignal?.aborted).toBe(true);
  });

  it("shows typed API failures", async () => {
    const failure = new DeparturesApiError("Upstream unavailable", {
      kind: "upstream",
      status: 502,
      code: "UPSTREAM_UNAVAILABLE",
      requestId: "request-error",
    });
    const client = createClient();
    vi.mocked(client.getDepartures).mockRejectedValue(failure);
    const { result } = renderHook(() => useDepartureSearch(client));

    await act(async () => {
      await result.current.search("Bru");
    });

    expect(result.current.state).toEqual({
      status: "error",
      query: "Bru",
      error: failure,
    });
  });

  it("aborts the active request when reset", () => {
    const client = createClient();
    vi.mocked(client.getDepartures).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useDepartureSearch(client));

    act(() => {
      void result.current.search("Bru");
    });
    const signal = vi.mocked(client.getDepartures).mock.calls[0]?.[1];
    act(() => {
      result.current.reset();
    });

    expect(signal?.aborted).toBe(true);
    expect(result.current.state).toEqual({ status: "idle" });
  });
});

function createClient(): DeparturesClient {
  return { getDepartures: vi.fn() };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
