import type { ErrorRequestHandler } from "express";

import { AllLiveboardsFailedError } from "../departures/search-departures.js";
import { IRailError } from "../irail/irail-errors.js";
import type { Logger } from "../logging/logger.js";
import type { ApiErrorCode, ErrorResponse } from "./api-types.js";
import { getRequestId } from "./request-id.js";

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, _next) => {
    const requestId = getRequestId(response.locals);

    if (error instanceof AllLiveboardsFailedError) {
      logger.warn(
        {
          event: "request_upstream_failure",
          requestId,
          errorCode: error.onlyTimeouts
            ? "UPSTREAM_TIMEOUT"
            : "UPSTREAM_UNAVAILABLE",
          failedStationIds: error.warnings.map(({ station }) => station.id),
        },
        "All matching liveboards failed",
      );
      sendUpstreamError(response, requestId, error.onlyTimeouts);
      return;
    }

    if (error instanceof IRailError) {
      logger.warn(
        {
          event: "request_upstream_failure",
          requestId,
          endpoint: error.endpoint,
          upstreamKind: error.kind,
          upstreamStatus: error.status,
        },
        "Upstream request failed",
      );
      sendUpstreamError(response, requestId, error.kind === "timeout");
      return;
    }

    const errorDetails = describeUnexpectedError(error);
    logger.error(
      {
        event: "unexpected_request_error",
        requestId,
        ...errorDetails,
      },
      "Unexpected request error",
    );
    const body: ErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        requestId,
      },
    };
    response.status(500).json(body);
  };
}

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

function describeUnexpectedError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };
  }

  return { errorName: "UnknownThrownValue" };
}
