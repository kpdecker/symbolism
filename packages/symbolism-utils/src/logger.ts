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

function processArgs(message: unknown[]) {
  return message.map((arg) => {
    if (typeof arg === "function") {
      return arg();
    }
    return arg;
  });
}

export function setLogLevel(level: LogLevel) {
  const originalLevel = loggerLevel;
  loggerLevel = level;
  return originalLevel;
}

export function logWarn(...message: unknown[]) {
  if (loggerLevel <= LogLevel.warn) {
    console.warn(...processArgs(message));
  }
}

export function logInfo(...message: unknown[]) {
  if (loggerLevel <= LogLevel.info) {
    console.info(...processArgs(message));
  }
}

export function logInteractive(...message: unknown[]) {
  if (process.stdout.isTTY) {
    logInfo(...processArgs(message));
  }
}

export function logVerbose(...message: unknown[]) {
  if (loggerLevel <= LogLevel.verbose) {
    console.info(...processArgs(message));
  }
}

export function logDebug(...message: unknown[]) {
  if (loggerLevel <= LogLevel.debug) {
    console.debug(...processArgs(message));
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
