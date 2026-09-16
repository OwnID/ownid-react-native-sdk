import { createToken } from '../di';

import { OwnIDLogLevel } from './index';
import type { OwnIDLogEntry, OwnIDLogHandler, OwnIDLoggingOptions } from './index';

interface LoggingConfiguration {
  readonly level: OwnIDLogLevel;
  readonly label: string;
  readonly onLog?: OwnIDLogHandler;
}

const DEFAULT_LABEL = 'OwnID-SDK';
const DEFAULT_CONFIGURATION: LoggingConfiguration = Object.freeze({
  level: OwnIDLogLevel.Off,
  label: DEFAULT_LABEL,
});

const levelPriorities: Readonly<Record<OwnIDLogLevel, number>> = Object.freeze({
  [OwnIDLogLevel.Verbose]: 2,
  [OwnIDLogLevel.Debug]: 3,
  [OwnIDLogLevel.Info]: 4,
  [OwnIDLogLevel.Warn]: 5,
  [OwnIDLogLevel.Error]: 6,
  [OwnIDLogLevel.Off]: Number.POSITIVE_INFINITY,
});

function isLogLevel(value: unknown): value is OwnIDLogLevel {
  return (
    value === OwnIDLogLevel.Verbose ||
    value === OwnIDLogLevel.Debug ||
    value === OwnIDLogLevel.Info ||
    value === OwnIDLogLevel.Warn ||
    value === OwnIDLogLevel.Error ||
    value === OwnIDLogLevel.Off
  );
}

function isThenable(value: unknown): boolean {
  const canHaveProperties = (typeof value === 'object' && value !== null) || typeof value === 'function';
  return canHaveProperties && typeof (value as { readonly then?: unknown }).then === 'function';
}

function reportSinkFailure(label: string, failure: unknown): void {
  try {
    console.error(`[${label}] Logging callback failed.`, failure);
  } catch {
    // Logging is best-effort and must not affect SDK behavior.
  }
}

function invokeHandler(handler: OwnIDLogHandler, entry: OwnIDLogEntry, label: string): void {
  try {
    const result: unknown = Reflect.apply(handler, undefined, [entry]);
    if (isThenable(result)) {
      void Promise.resolve(result).catch((failure: unknown) => {
        reportSinkFailure(label, failure);
      });
    }
  } catch (failure) {
    reportSinkFailure(label, failure);
  }
}

function logToConsole(entry: OwnIDLogEntry): void {
  const formatted = `[${entry.label}] ${entry.source} |> ${entry.message}`;
  const args: [string] | [string, unknown] = entry.cause === undefined ? [formatted] : [formatted, entry.cause];

  try {
    switch (entry.level) {
      case OwnIDLogLevel.Verbose:
      case OwnIDLogLevel.Debug:
        console.debug(...args);
        return;
      case OwnIDLogLevel.Info:
        console.info(...args);
        return;
      case OwnIDLogLevel.Warn:
        console.warn(...args);
        return;
      case OwnIDLogLevel.Error:
        console.error(...args);
        return;
    }
  } catch {
    // Logging is best-effort and must not affect SDK behavior.
  }
}

/** @internal Process-wide logging state shared by SDK dependency scopes. */
export class LoggingService {
  private configuration: LoggingConfiguration = DEFAULT_CONFIGURATION;

  configure(options: OwnIDLoggingOptions = {}): void {
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
      throw new TypeError('OwnID logging options must be an object.');
    }

    const level = options.level === undefined ? OwnIDLogLevel.Off : options.level;
    if (!isLogLevel(level)) {
      throw new TypeError('OwnID logging level is invalid.');
    }

    const label = options.label === undefined ? DEFAULT_LABEL : options.label;
    if (typeof label !== 'string' || label.length === 0) {
      throw new TypeError('OwnID logging label must be a non-empty string.');
    }

    const onLog = options.onLog;
    if (onLog !== undefined && typeof onLog !== 'function') {
      throw new TypeError('OwnID logging onLog must be a function.');
    }

    this.configuration = Object.freeze({
      level,
      label,
      ...(level !== OwnIDLogLevel.Off && onLog !== undefined ? { onLog } : {}),
    });
  }

  emit(level: OwnIDLogEntry['level'], source: string, message: string, cause?: unknown): void {
    const configuration = this.configuration;
    if (configuration.level === OwnIDLogLevel.Off || levelPriorities[level] < levelPriorities[configuration.level]) {
      return;
    }

    const entry: OwnIDLogEntry = Object.freeze({
      level,
      label: configuration.label,
      source,
      message,
      ...(cause === undefined ? {} : { cause }),
    });

    if (configuration.onLog === undefined) {
      logToConsole(entry);
      return;
    }

    invokeHandler(configuration.onLog, entry, configuration.label);
  }
}

/** @internal Dependency-injection token for the process-wide logging service. */
export const LoggingServiceToken = createToken<LoggingService>('ownid.logging.local');
