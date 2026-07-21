export type IRailErrorKind =
  | "timeout"
  | "network"
  | "http"
  | "invalid-response";

interface IRailErrorOptions {
  readonly kind: IRailErrorKind;
  readonly endpoint: "stations" | "liveboard";
  readonly status?: number;
  readonly cause?: unknown;
}

export class IRailError extends Error {
  readonly kind: IRailErrorKind;
  readonly endpoint: "stations" | "liveboard";
  readonly status: number | undefined;

  constructor(message: string, options: IRailErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "IRailError";
    this.kind = options.kind;
    this.endpoint = options.endpoint;
    this.status = options.status;
  }
}
