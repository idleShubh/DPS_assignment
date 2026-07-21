import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { SearchDepartures } from "./departures/search-departures.js";
import { HttpIRailClient } from "./irail/irail-client.js";
import { CachedStationCatalogue } from "./stations/station-catalogue.js";

const config = loadConfig();
const irailClient = new HttpIRailClient(config.irail);
const stationCatalogue = new CachedStationCatalogue(
  irailClient,
  config.stationCacheTtlMs,
);
const departureSearch = new SearchDepartures({
  stationCatalogue,
  irailClient,
  windowMinutes: config.departureWindowMinutes,
  concurrency: config.liveboardConcurrency,
});
const app = createApp({ departureSearch });

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
