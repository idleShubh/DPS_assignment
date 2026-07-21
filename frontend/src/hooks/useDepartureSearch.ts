import { useCallback, useEffect, useRef, useState } from "react";

import {
  DeparturesApiError,
  type DeparturesClient,
} from "../api/departures";
import type { DepartureResponse } from "../api/types";

export type DepartureResultKind =
  | "complete"
  | "partial"
  | "no-stations"
  | "no-departures";

export type DepartureSearchState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly query: string }
  | {
      readonly status: "success";
      readonly query: string;
      readonly resultKind: DepartureResultKind;
      readonly data: DepartureResponse;
    }
  | {
      readonly status: "error";
      readonly query: string;
      readonly error: DeparturesApiError;
    };

interface ActiveRequest {
  readonly id: number;
  readonly controller: AbortController;
}

export function useDepartureSearch(client: DeparturesClient) {
  const [state, setState] = useState<DepartureSearchState>({ status: "idle" });
  const sequence = useRef(0);
  const activeRequest = useRef<ActiveRequest | null>(null);

  useEffect(
    () => () => {
      activeRequest.current?.controller.abort();
      activeRequest.current = null;
    },
    [client],
  );

  const search = useCallback(
    async (query: string): Promise<void> => {
      activeRequest.current?.controller.abort();

      const id = ++sequence.current;
      const controller = new AbortController();
      activeRequest.current = { id, controller };
      setState({ status: "loading", query });

      try {
        const data = await client.getDepartures(query, controller.signal);
        if (activeRequest.current?.id !== id || controller.signal.aborted) {
          return;
        }
        setState({
          status: "success",
          query,
          resultKind: resultKindFor(data),
          data,
        });
      } catch (error) {
        if (activeRequest.current?.id !== id || controller.signal.aborted) {
          return;
        }
        setState({
          status: "error",
          query,
          error: toApiError(error),
        });
      } finally {
        if (activeRequest.current?.id === id) {
          activeRequest.current = null;
        }
      }
    },
    [client],
  );

  const reset = useCallback(() => {
    activeRequest.current?.controller.abort();
    activeRequest.current = null;
    sequence.current += 1;
    setState({ status: "idle" });
  }, []);

  return { state, search, reset } as const;
}

function resultKindFor(response: DepartureResponse): DepartureResultKind {
  if (response.partial) {
    return "partial";
  }
  if (response.stations.length === 0) {
    return "no-stations";
  }
  if (response.stations.every((station) => station.departures.length === 0)) {
    return "no-departures";
  }
  return "complete";
}

function toApiError(error: unknown): DeparturesApiError {
  if (error instanceof DeparturesApiError) {
    return error;
  }

  return new DeparturesApiError("An unexpected client error occurred.", {
    kind: "internal",
    cause: error,
  });
}
