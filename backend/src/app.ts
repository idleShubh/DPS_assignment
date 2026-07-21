import express from "express";

import type { DepartureSearchService } from "./departures/search-departures.js";
import { errorHandler } from "./http/error-handler.js";
import { requestIdMiddleware } from "./http/request-id.js";
import { createRequestLoggingMiddleware } from "./http/request-logging.js";
import { createDeparturesRouter } from "./http/routes/departures.js";
import { noopLogger, type Logger } from "./logging/logger.js";

interface AppDependencies {
  readonly departureSearch: DepartureSearchService;
  readonly logger?: Logger;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const logger = dependencies.logger ?? noopLogger;

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(createRequestLoggingMiddleware(logger));
  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.use("/api/departures", createDeparturesRouter(dependencies.departureSearch));
  app.use(errorHandler(logger));

  return app;
}
