import { type OwnIDLogEntry, type OwnIDLoggingOptions, type OwnIDLogHandler, OwnIDLogLevel } from './index';

interface LoggingConfiguration {
  readonly level: OwnIDLogLevel;
  readonly label: string;
  readonly onLog?: OwnIDLogHandler;
}

/** Writes enabled SDK logs to the configured handler or console. */
export class OwnIdLogger {
  private static readonly DEFAULT_LABEL = 'OwnID-SDK';
  private static readonly DEFAULT_CONFIGURATION: LoggingConfiguration = Object.freeze({
    level: OwnIDLogLevel.Off,
    label: OwnIdLogger.DEFAULT_LABEL,
  });
  private static readonly levelPriorities: Readonly<Record<OwnIDLogLevel, number>> = Object.freeze({
    [OwnIDLogLevel.Verbose]: 2,
    [OwnIDLogLevel.Debug]: 3,
    [OwnIDLogLevel.Info]: 4,
    [OwnIDLogLevel.Warn]: 5,
    [OwnIDLogLevel.Error]: 6,
    [OwnIDLogLevel.Off]: Number.POSITIVE_INFINITY,
  });

  private configuration: LoggingConfiguration = OwnIdLogger.DEFAULT_CONFIGURATION;

  private static isLogLevel(value: unknown): value is OwnIDLogLevel {
    return (
      value === OwnIDLogLevel.Verbose ||
      value === OwnIDLogLevel.Debug ||
      value === OwnIDLogLevel.Info ||
      value === OwnIDLogLevel.Warn ||
      value === OwnIDLogLevel.Error ||
      value === OwnIDLogLevel.Off
    );
  }

  private static isThenable(value: unknown): boolean {
    const canHaveProperties = (typeof value === 'object' && value !== null) || typeof value === 'function';
    return canHaveProperties && typeof (value as { readonly then?: unknown }).then === 'function';
  }

  private static reportSinkFailure(label: string, failure: unknown): void {
    try {
      console.error(`[${label}] Logging callback failed.`, failure);
    } catch {
      // Logging is best-effort and must not affect SDK behavior.
    }
  }

  private static invokeHandler(handler: (entry: OwnIDLogEntry) => unknown, entry: OwnIDLogEntry, label: string): void {
    try {
      const result: unknown = handler(entry);
      if (OwnIdLogger.isThenable(result)) {
        void Promise.resolve(result).catch((failure: unknown) => {
          OwnIdLogger.reportSinkFailure(label, failure);
        });
      }
    } catch (failure) {
      OwnIdLogger.reportSinkFailure(label, failure);
    }
  }

  private static logToConsole(entry: OwnIDLogEntry): void {
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

  configure(options: OwnIDLoggingOptions = {}): void {
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
      throw new TypeError('OwnID logging options must be an object.');
    }

    const configuredLevel = options.level;
    const level = configuredLevel === undefined ? OwnIDLogLevel.Off : configuredLevel;
    if (!OwnIdLogger.isLogLevel(level)) {
      throw new TypeError('OwnID logging level is invalid.');
    }

    const configuredLabel = options.label;
    const label = configuredLabel === undefined ? OwnIdLogger.DEFAULT_LABEL : configuredLabel;
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

  isEnabled(level: OwnIDLogLevel): boolean {
    const runtimeLevel: unknown = level;
    return (
      OwnIdLogger.isLogLevel(runtimeLevel) &&
      runtimeLevel !== OwnIDLogLevel.Off &&
      this.configuration.level !== OwnIDLogLevel.Off &&
      OwnIdLogger.levelPriorities[level] >= OwnIdLogger.levelPriorities[this.configuration.level]
    );
  }

  emit(level: OwnIDLogEntry['level'], source: string, message: string, cause?: unknown): void {
    if (!this.isEnabled(level)) return;
    const configuration = this.configuration;

    const entry: OwnIDLogEntry = Object.freeze({
      level,
      label: configuration.label,
      source,
      message,
      ...(cause === undefined ? {} : { cause }),
    });

    if (configuration.onLog === undefined) {
      OwnIdLogger.logToConsole(entry);
      return;
    }

    OwnIdLogger.invokeHandler(configuration.onLog, entry, configuration.label);
  }
}
