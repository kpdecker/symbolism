import { createWriteStream } from "fs";
import fs from "fs";

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

let fileLogStream: fs.WriteStream | undefined;
function getFileLogStream() {
  if (!fileLogStream) {
    fileLogStream = createWriteStream("./symbolism.log");
  }
  return fileLogStream;
}

export function logFile(...message: unknown[]) {
  const stream = getFileLogStream();
  stream.write(message.join(" ") + "\n");
}

export function testDebugLogLevel() {
  setLogLevel(LogLevel.debug);
}
