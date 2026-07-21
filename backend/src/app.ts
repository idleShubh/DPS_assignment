import express from "express";

import type { DepartureSearchService } from "./departures/search-departures.js";
import { errorHandler } from "./http/error-handler.js";
import { requestIdMiddleware } from "./http/request-id.js";
import { createDeparturesRouter } from "./http/routes/departures.js";

interface AppDependencies {
  readonly departureSearch: DepartureSearchService;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.use("/api/departures", createDeparturesRouter(dependencies.departureSearch));
  app.use(errorHandler);

  return app;
}
