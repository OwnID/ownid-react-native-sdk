import type { OwnIDLogEntry } from '../index';
import type { OwnIdLogger } from '../OwnIdLogger';
import type { OwnIdLogRouter } from '../OwnIdLogRouter';
import type { ServerLogger } from '../ServerLogger';

export class OwnIdLogRouterImpl implements OwnIdLogRouter {
  constructor(
    private readonly localLoggerProvider: () => OwnIdLogger | undefined,
    private readonly serverLoggerProvider: () => ServerLogger | undefined
  ) {}

  log(level: OwnIDLogEntry['level'], source: string, message: string, cause?: unknown): void {
    try {
      this.localLoggerProvider()?.emit(level, source, message, cause);
    } catch {
      // Local logging failures must not prevent server delivery.
    }
    try {
      this.serverLoggerProvider()?.log(level, source, message, cause);
    } catch {
      // Logging failures must not interrupt the caller.
    }
  }
}
