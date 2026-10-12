import packageMetadata from '@ownid/react-native-core/package.json';
import { Platform } from 'react-native';

import type { RuntimeConfiguration } from '../../configuration/runtime';
import { OwnIDLogLevel } from '../index';
import type { OwnIDLogEntry } from '../index';
import type { ServerLogger } from '../ServerLogger';

export class ServerLoggerImpl implements ServerLogger {
  // Diagnostics must not accumulate work or keep authentication waiting for delivery.
  private static readonly MAX_ACTIVE_REQUESTS = 4;
  private static readonly DEADLINE_MS = 10_000;
  private static readonly MAX_SOURCE_LENGTH = 256;
  private static readonly MAX_MESSAGE_LENGTH = 4096;
  private static readonly MAX_EXCEPTION_LENGTH = 16_384;

  private readonly appHost: string;
  private readonly activeRequests = new Set<() => void>();
  private stopped = false;
  private clientInfo?: Promise<Readonly<{ component: string; userAgent: string }> | undefined>;

  constructor(
    configuration: RuntimeConfiguration,
    private readonly instanceSignal: AbortSignal
  ) {
    const environment = configuration.env === 'prod' ? '' : `.${configuration.env}`;
    const region = configuration.region === 'us' ? '' : '-eu';
    this.appHost = `${configuration.appId}.server${environment}.ownid${region}.com`;
    if (instanceSignal.aborted) this.dispose();
    else instanceSignal.addEventListener('abort', this.onInstanceAbort);
  }

  log(level: OwnIDLogEntry['level'], source: string, message: string, cause?: unknown): void {
    if (
      this.stopped ||
      this.instanceSignal.aborted ||
      (level !== OwnIDLogLevel.Warn && level !== OwnIDLogLevel.Error) ||
      this.activeRequests.size >= ServerLoggerImpl.MAX_ACTIVE_REQUESTS
    ) {
      return;
    }

    const controller = new AbortController();
    let release: () => void = () => undefined;
    const cancelled = new Promise<void>((resolve) => (release = resolve));
    const cancel = () => {
      release();
      try {
        controller.abort();
      } catch {
        // Releasing the attempt does not depend on native fetch cancellation.
      }
    };
    this.activeRequests.add(cancel);
    const sourceLabel = source.slice(0, ServerLoggerImpl.MAX_SOURCE_LENGTH);
    const eventMessage = `${sourceLabel} => ${message}`.slice(0, ServerLoggerImpl.MAX_MESSAGE_LENGTH);
    const exception = this.readException(cause)?.slice(0, ServerLoggerImpl.MAX_EXCEPTION_LENGTH);
    const sourceTimestamp = String(Date.now());
    const deadline = setTimeout(cancel, ServerLoggerImpl.DEADLINE_MS);
    const attempt = Promise.resolve().then(async () => {
      if (this.stopped || controller.signal.aborted) return;
      const info = await this.getClientInfo();
      if (info === undefined || this.stopped || controller.signal.aborted) return;
      const body = JSON.stringify({
        component: info.component,
        level: level === OwnIDLogLevel.Warn ? 'Warning' : 'Error',
        codeInitiator: sourceLabel,
        message: eventMessage,
        ...(exception === undefined ? {} : { exception }),
        userAgent: info.userAgent,
        sourceTimestamp,
      });
      if (this.stopped || controller.signal.aborted) return;
      await globalThis.fetch(`https://${this.appHost}/events`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-OwnID-AppUrl': this.appHost,
          'User-Agent': info.userAgent,
        },
        body,
        signal: controller.signal,
      });
    });
    // A deadline also settles our wait if the underlying fetch ignores cancellation.
    void Promise.race([attempt, cancelled])
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(deadline);
        this.activeRequests.delete(cancel);
      });
  }

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.instanceSignal.removeEventListener('abort', this.onInstanceAbort);
    for (const cancel of this.activeRequests) cancel();
    this.activeRequests.clear();
  }

  private readonly onInstanceAbort = (): void => this.dispose();

  private getClientInfo(): Promise<Readonly<{ component: string; userAgent: string }> | undefined> {
    return (this.clientInfo ??= Promise.resolve().then(() => {
      const component = Platform.select({ android: 'AndroidSdk', ios: 'IosSdk' });
      if (component === undefined) return undefined;
      const system =
        Platform.OS === 'android'
          ? `(Linux; Android ${Platform.constants.Release}; ${Platform.constants.Model.replace(/[()]/g, '')})`
          : `(iOS ${Platform.Version})`;
      return { component, userAgent: `OwnIDReactNativeCore/${packageMetadata.version} ${system}` };
    }));
  }

  private readException(cause: unknown): string | undefined {
    try {
      if (typeof cause === 'string') return cause.length === 0 ? undefined : cause;
      if (!(cause instanceof Error)) {
        if (typeof cause !== 'object' || cause === null) return undefined;
        const details: Record<string, string | number | boolean> = {};
        for (const field of ['message', 'name', 'stack', 'code', 'description', 'domain', 'statusCode', 'url', 'targetUrl', 'didCrash']) {
          const value: unknown = Object.getOwnPropertyDescriptor(cause, field)?.value;
          if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
            details[field] = value;
          }
        }
        return Object.keys(details).length === 0 ? undefined : JSON.stringify(details);
      }
      try {
        const stack: unknown = cause.stack;
        if (typeof stack === 'string' && stack.length > 0) return stack;
      } catch {
        // Keep the error message if its stack cannot be read.
      }
      const message: unknown = cause.message;
      return typeof message === 'string' ? message : undefined;
    } catch {
      return undefined;
    }
  }
}
