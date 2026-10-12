import type { OwnIDLogEntry } from './index';

/** Internal, best-effort delivery of SDK warnings and errors to OwnID. */
export interface ServerLogger {
  log(level: OwnIDLogEntry['level'], source: string, message: string, cause?: unknown): void;
  dispose(): void;
}
