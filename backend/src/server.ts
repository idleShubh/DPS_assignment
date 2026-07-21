import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { SearchDepartures } from "./departures/search-departures.js";
import { HttpIRailClient } from "./irail/irail-client.js";
import { JsonConsoleLogger } from "./logging/logger.js";
import { CachedStationCatalogue } from "./stations/station-catalogue.js";

const config = loadConfig();
const logger = new JsonConsoleLogger();
const irailClient = new HttpIRailClient(config.irail);
const stationCatalogue = new CachedStationCatalogue(
  irailClient,
  config.stationCacheTtlMs,
  undefined,
  logger,
);
const departureSearch = new SearchDepartures({
  stationCatalogue,
  irailClient,
  windowMinutes: config.departureWindowMinutes,
  concurrency: config.liveboardConcurrency,
  logger,
});
const app = createApp({ departureSearch, logger });

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
