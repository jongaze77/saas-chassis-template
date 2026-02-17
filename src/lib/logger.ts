type LogLevel = "error" | "warn" | "info" | "debug";

interface LogContext {
  accountId?: string;
  traceId?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "debug":
      console.debug(output);
      break;
    default:
      console.log(output);
  }
}

export const logger = {
  error: (message: string, context?: LogContext) =>
    log("error", message, context),
  warn: (message: string, context?: LogContext) =>
    log("warn", message, context),
  info: (message: string, context?: LogContext) =>
    log("info", message, context),
  debug: (message: string, context?: LogContext) =>
    log("debug", message, context),
};
