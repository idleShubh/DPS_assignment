import type { RequestHandler } from "express";

import type { Logger } from "../logging/logger.js";
import { getRequestId } from "./request-id.js";

export function createRequestLoggingMiddleware(
  logger: Logger,
  now: () => number = Date.now,
): RequestHandler {
  return (request, response, next) => {
    const startedAt = now();
    const path = request.path;

    response.once("finish", () => {
      logger.info(
        {
          event: "request_completed",
          requestId: getRequestId(response.locals),
          method: request.method,
          path,
          statusCode: response.statusCode,
          durationMs: Math.max(0, now() - startedAt),
        },
        "Request completed",
      );
    });

    next();
  };
}
