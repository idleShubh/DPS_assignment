const DEFAULTS = {
  port: 3000,
  irailBaseUrl: "https://api.irail.be",
  irailTimeoutMs: 5_000,
  stationCacheTtlMs: 6 * 60 * 60 * 1_000,
  liveboardConcurrency: 5,
  departureWindowMinutes: 15,
  irailUserAgent: "LagoviaTrainTracker/0.1 (local development)",
} as const;

export interface AppConfig {
  readonly port: number;
  readonly irail: {
    readonly baseUrl: string;
    readonly timeoutMs: number;
    readonly userAgent: string;
  };
  readonly stationCacheTtlMs: number;
  readonly liveboardConcurrency: number;
  readonly departureWindowMinutes: number;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function loadConfig(
  environment: Readonly<NodeJS.ProcessEnv> = process.env,
): AppConfig {
  const config: AppConfig = {
    port: readInteger(environment, "PORT", DEFAULTS.port, { min: 1, max: 65_535 }),
    irail: {
      baseUrl: readHttpUrl(
        environment,
        "IRAIL_BASE_URL",
        DEFAULTS.irailBaseUrl,
      ),
      timeoutMs: readInteger(
        environment,
        "IRAIL_TIMEOUT_MS",
        DEFAULTS.irailTimeoutMs,
        { min: 100, max: 60_000 },
      ),
      userAgent: readNonBlankString(
        environment,
        "IRAIL_USER_AGENT",
        DEFAULTS.irailUserAgent,
      ),
    },
    stationCacheTtlMs: readInteger(
      environment,
      "STATION_CACHE_TTL_MS",
      DEFAULTS.stationCacheTtlMs,
      { min: 60_000, max: 7 * 24 * 60 * 60 * 1_000 },
    ),
    liveboardConcurrency: readInteger(
      environment,
      "LIVEBOARD_CONCURRENCY",
      DEFAULTS.liveboardConcurrency,
      { min: 1, max: 20 },
    ),
    departureWindowMinutes: readInteger(
      environment,
      "DEPARTURE_WINDOW_MINUTES",
      DEFAULTS.departureWindowMinutes,
      { min: 1, max: 120 },
    ),
  };

  Object.freeze(config.irail);
  return Object.freeze(config);
}

interface IntegerBounds {
  readonly min: number;
  readonly max: number;
}

function readInteger(
  environment: Readonly<NodeJS.ProcessEnv>,
  name: string,
  defaultValue: number,
  bounds: IntegerBounds,
): number {
  const rawValue = environment[name];

  if (rawValue === undefined) {
    return defaultValue;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value)) {
    throw new ConfigurationError(`${name} must be a whole number.`);
  }

  if (value < bounds.min || value > bounds.max) {
    throw new ConfigurationError(
      `${name} must be between ${bounds.min} and ${bounds.max}.`,
    );
  }

  return value;
}

function readHttpUrl(
  environment: Readonly<NodeJS.ProcessEnv>,
  name: string,
  defaultValue: string,
): string {
  const rawValue = environment[name] ?? defaultValue;

  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new ConfigurationError(`${name} must be a valid URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigurationError(`${name} must use http or https.`);
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new ConfigurationError(
      `${name} must not contain credentials, a query, or a fragment.`,
    );
  }

  return url.toString().replace(/\/$/, "");
}

function readNonBlankString(
  environment: Readonly<NodeJS.ProcessEnv>,
  name: string,
  defaultValue: string,
): string {
  const value = environment[name] ?? defaultValue;
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new ConfigurationError(`${name} must not be blank.`);
  }

  return trimmedValue;
}
