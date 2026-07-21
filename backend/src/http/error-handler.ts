import type { ErrorRequestHandler } from "express";

import { AllLiveboardsFailedError } from "../departures/search-departures.js";
import { IRailError } from "../irail/irail-errors.js";
import type { ApiErrorCode, ErrorResponse } from "./api-types.js";
import { getRequestId } from "./request-id.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  const requestId = getRequestId(response.locals);

  if (error instanceof AllLiveboardsFailedError) {
    sendUpstreamError(
      response,
      requestId,
      error.onlyTimeouts,
    );
    return;
  }

  if (error instanceof IRailError) {
    sendUpstreamError(
      response,
      requestId,
      error.kind === "timeout",
    );
    return;
  }

  const body: ErrorResponse = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId,
    },
  };
  response.status(500).json(body);
};

function sendUpstreamError(
  response: Parameters<ErrorRequestHandler>[2],
  requestId: string,
  timedOut: boolean,
): void {
  const status = timedOut ? 504 : 502;
  const code: ApiErrorCode = timedOut
    ? "UPSTREAM_TIMEOUT"
    : "UPSTREAM_UNAVAILABLE";
  const body: ErrorResponse = {
    error: {
      code,
      message: timedOut
        ? "The train data provider timed out."
        : "The train data provider is unavailable.",
      requestId,
    },
  };
  response.status(status).json(body);
}
