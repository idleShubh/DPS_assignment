import { describe, expect, it } from "vitest";

import { ConfigurationError, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("returns the documented defaults for an empty environment", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3000);
    expect(config.irail.baseUrl).toBe("https://api.irail.be");
    expect(config.irail.timeoutMs).toBe(5_000);
    expect(config.stationCacheTtlMs).toBe(21_600_000);
    expect(config.liveboardConcurrency).toBe(5);
    expect(config.departureWindowMinutes).toBe(15);
  });

  it("reads valid overrides without changing process.env", () => {
    const config = loadConfig({
      PORT: "3100",
      IRAIL_BASE_URL: "http://localhost:9000/",
      IRAIL_TIMEOUT_MS: "2500",
      IRAIL_USER_AGENT: "  LagoviaTest/1.0  ",
      STATION_CACHE_TTL_MS: "60000",
      LIVEBOARD_CONCURRENCY: "3",
      DEPARTURE_WINDOW_MINUTES: "20",
    });

    expect(config).toMatchObject({
      port: 3100,
      irail: {
        timeoutMs: 2500,
        userAgent: "LagoviaTest/1.0",
      },
      stationCacheTtlMs: 60_000,
      liveboardConcurrency: 3,
      departureWindowMinutes: 20,
    });
    expect(config.irail.baseUrl).toBe("http://localhost:9000");
  });

  it.each([
    ["PORT", "0"],
    ["PORT", "65536"],
    ["IRAIL_TIMEOUT_MS", "99"],
    ["STATION_CACHE_TTL_MS", "59999"],
    ["LIVEBOARD_CONCURRENCY", "0"],
    ["LIVEBOARD_CONCURRENCY", "21"],
    ["DEPARTURE_WINDOW_MINUTES", "0"],
    ["DEPARTURE_WINDOW_MINUTES", "121"],
    ["PORT", "3.5"],
    ["PORT", "not-a-number"],
  ])("rejects an invalid %s value of %s", (name, value) => {
    expect(() => loadConfig({ [name]: value })).toThrow(ConfigurationError);
  });

  it.each([
    "not a url",
    "ftp://api.irail.be",
    "https://user:password@api.irail.be",
    "https://api.irail.be?format=json",
    "https://api.irail.be#stations",
  ])(
    "rejects an invalid iRail base URL: %s",
    (baseUrl) => {
      expect(() => loadConfig({ IRAIL_BASE_URL: baseUrl })).toThrow(
        ConfigurationError,
      );
    },
  );

  it("rejects a blank user agent", () => {
    expect(() => loadConfig({ IRAIL_USER_AGENT: "   " })).toThrow(
      ConfigurationError,
    );
  });
});
