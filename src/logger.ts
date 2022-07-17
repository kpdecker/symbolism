export enum LogLevel {
  debug,
  verbose,
  info,
  warn,
  error,
}

let loggerLevel = LogLevel.warn;

export function setLogLevel(level: LogLevel) {
  const originalLevel = loggerLevel;
  loggerLevel = level;
  return originalLevel;
}

export function logWarn(...message: unknown[]) {
  if (loggerLevel <= LogLevel.warn) {
    console.warn(...message);
  }
}

export function logInfo(...message: unknown[]) {
  if (loggerLevel <= LogLevel.info) {
    console.info(...message);
  }
}

export function logVerbose(...message: unknown[]) {
  if (loggerLevel <= LogLevel.verbose) {
    console.info(...message);
  }
}

export function logDebug(...message: unknown[]) {
  if (loggerLevel <= LogLevel.debug) {
    console.debug(...message);
  }
}
