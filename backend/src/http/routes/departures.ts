import { Router } from "express";

import type { DepartureSearchService } from "../../departures/search-departures.js";
import type { ErrorResponse } from "../api-types.js";
import { toDepartureResponse } from "../departure-response.js";
import { getRequestId } from "../request-id.js";

export function createDeparturesRouter(
  departureSearch: DepartureSearchService,
): Router {
  const router = Router();

  router.get("/", async (request, response, next) => {
    const requestId = getRequestId(response.locals);
    const query = request.query.q;

    if (typeof query !== "string" || !query.trim()) {
      const body: ErrorResponse = {
        error: {
          code: "QUERY_REQUIRED",
          message: "Provide a station query using q.",
          requestId,
        },
      };
      response.status(400).json(body);
      return;
    }

    const trimmedQuery = query.trim();
    if (Array.from(trimmedQuery).length < 3) {
      const body: ErrorResponse = {
        error: {
          code: "QUERY_TOO_SHORT",
          message: "Enter at least 3 characters.",
          requestId,
          details: { minimumLength: 3 },
        },
      };
      response.status(400).json(body);
      return;
    }

    try {
      const result = await departureSearch.search(trimmedQuery);
      response.json(toDepartureResponse(result, requestId));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
