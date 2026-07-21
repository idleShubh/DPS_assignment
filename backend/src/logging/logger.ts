export type LogContext = Readonly<Record<string, unknown>>;

export interface Logger {
  info(context: LogContext, message: string): void;
  warn(context: LogContext, message: string): void;
  error(context: LogContext, message: string): void;
}

export const noopLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export class JsonConsoleLogger implements Logger {
  info(context: LogContext, message: string): void {
    this.write("info", context, message, process.stdout);
  }

  warn(context: LogContext, message: string): void {
    this.write("warn", context, message, process.stderr);
  }

  error(context: LogContext, message: string): void {
    this.write("error", context, message, process.stderr);
  }

  private write(
    level: "info" | "warn" | "error",
    context: LogContext,
    message: string,
    destination: NodeJS.WriteStream,
  ): void {
    destination.write(
      `${JSON.stringify({
        ...context,
        timestamp: new Date().toISOString(),
        level,
        message,
      })}\n`,
    );
  }
}
