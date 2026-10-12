import { createToken } from '../di';
import type { OwnIdLogger } from './OwnIdLogger';
import type { OwnIdLogRouter } from './OwnIdLogRouter';
import type { ServerLogger } from './ServerLogger';

export enum OwnIDLogLevel {
  Verbose = 'verbose',
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  Off = 'off',
}

Object.freeze(OwnIDLogLevel);

/** Structured log entry emitted by the OwnID SDK. */
export type OwnIDLogEntry = Readonly<{
  /** Entry severity; {@link OwnIDLogLevel.Off} disables logging and is never emitted. */
  level: Exclude<OwnIDLogLevel, OwnIDLogLevel.Off>;
  /** Configured label, or `OwnID-SDK` by default. */
  label: string;
  /** SDK component that emitted the entry. */
  source: string;
  /** Human-readable description of the event. */
  message: string;
  /** Original error or value associated with the event, when available. */
  cause?: unknown;
}>;

/**
 * Receives enabled log entries as they occur.
 *
 * Handler failures do not interrupt SDK operations. Thrown errors and rejected promises are reported to `console.error`.
 */
export type OwnIDLogHandler = (entry: OwnIDLogEntry) => void;

/** SDK-wide logging options applied by `OwnID.configureLogging`. */
export type OwnIDLoggingOptions = Readonly<{
  /** Minimum emitted severity. Defaults to {@link OwnIDLogLevel.Off}, which emits nothing. */
  level?: OwnIDLogLevel;
  /** Non-empty label included in every entry. Defaults to `OwnID-SDK`. */
  label?: string;
  /** Receives enabled entries. When omitted, enabled entries are written to the console. */
  onLog?: OwnIDLogHandler;
}>;

export const OwnIdLoggerDiToken = createToken<OwnIdLogger>('ownid.logging.local');
export const OwnIdLogRouterDiToken = createToken<OwnIdLogRouter>('ownid.logging.router');
export const ServerLoggerDiToken = createToken<ServerLogger>('ownid.logging.server');
