import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (
  _request,
  response,
  next,
) => {
  const requestId = randomUUID();
  response.locals.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  next();
};

export function getRequestId(locals: Record<string, unknown>): string {
  const requestId = locals.requestId;
  return typeof requestId === "string" ? requestId : "unknown";
}
