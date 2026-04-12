type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, data?: unknown) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...(data !== undefined && { data }),
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
};
