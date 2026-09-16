import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, mock, test } from 'node:test';

import { OwnIDLogLevel } from '../../src/logging';
import type { OwnIDLogEntry, OwnIDLogHandler } from '../../src/logging';
import { LoggingService } from '../../src/logging/internal';

const requireFromTest = createRequire(import.meta.url);
const requireFromReactNative = createRequire(requireFromTest.resolve('react-native/package.json'));

const severities: readonly OwnIDLogEntry['level'][] = [
  OwnIDLogLevel.Verbose,
  OwnIDLogLevel.Debug,
  OwnIDLogLevel.Info,
  OwnIDLogLevel.Warn,
  OwnIDLogLevel.Error,
];

const thresholds: readonly OwnIDLogLevel[] = [...severities, OwnIDLogLevel.Off];

const priorities: Readonly<Record<OwnIDLogLevel, number>> = {
  [OwnIDLogLevel.Verbose]: 2,
  [OwnIDLogLevel.Debug]: 3,
  [OwnIDLogLevel.Info]: 4,
  [OwnIDLogLevel.Warn]: 5,
  [OwnIDLogLevel.Error]: 6,
  [OwnIDLogLevel.Off]: Number.POSITIVE_INFINITY,
};

describe('LoggingService configuration and thresholds', () => {
  test('each threshold emits its severity and every more severe entry', () => {
    for (const threshold of thresholds) {
      const entries: OwnIDLogEntry[] = [];
      const logger = new LoggingService();
      logger.configure({ level: threshold, onLog: (entry) => entries.push(entry) });

      for (const severity of severities) {
        logger.emit(severity, 'ThresholdTest', severity);
      }

      const expected = severities.filter((severity) => threshold !== OwnIDLogLevel.Off && priorities[severity] >= priorities[threshold]);
      assert.deepEqual(
        entries.map((entry) => entry.level),
        expected,
        threshold
      );
    }
  });

  test('omission resets to off, restores the default label, and releases the handler', () => {
    const entries: OwnIDLogEntry[] = [];
    const logger = new LoggingService();
    const debug = mock.method(console, 'debug', () => undefined);

    try {
      logger.configure({ level: OwnIDLogLevel.Debug, label: 'Custom', onLog: (entry) => entries.push(entry) });
      logger.emit(OwnIDLogLevel.Debug, 'BeforeReset', 'visible');
      logger.configure();
      logger.emit(OwnIDLogLevel.Error, 'AfterReset', 'hidden');

      assert.equal(entries.length, 1);
      assert.equal(entries[0]?.label, 'Custom');
      assert.equal(debug.mock.callCount(), 0);

      logger.configure({ level: OwnIDLogLevel.Debug });
      logger.emit(OwnIDLogLevel.Debug, 'AfterEnable', 'visible');
      assert.deepEqual(debug.mock.calls[0]?.arguments, ['[OwnID-SDK] AfterEnable |> visible']);
    } finally {
      mock.restoreAll();
    }
  });

  test('invalid options preserve the previous complete configuration', () => {
    const entries: OwnIDLogEntry[] = [];
    const logger = new LoggingService();
    logger.configure({ level: OwnIDLogLevel.Info, label: 'Stable', onLog: (entry) => entries.push(entry) });

    const invalidOptions: readonly unknown[] = [
      null,
      [],
      { level: 'trace' },
      { level: 'assert' },
      { level: OwnIDLogLevel.Debug, label: '' },
      { level: OwnIDLogLevel.Debug, label: 1 },
      { level: OwnIDLogLevel.Debug, onLog: true },
    ];

    for (const invalid of invalidOptions) {
      assert.throws(
        () => logger.configure(invalid as never),
        (error: unknown) => error instanceof TypeError && error.message.startsWith('OwnID logging')
      );
    }

    const getterFailure = new Error('getter failed');
    const throwingOptions = Object.defineProperty({}, 'level', {
      get: () => {
        throw getterFailure;
      },
    });
    assert.throws(() => logger.configure(throwingOptions), getterFailure);

    logger.emit(OwnIDLogLevel.Info, 'AfterFailures', 'visible');
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.label, 'Stable');
  });
});

describe('LoggingService records and sinks', () => {
  test('a custom handler receives an exact frozen record and the original cause', () => {
    const cause = { mutable: true };
    let captured: OwnIDLogEntry | undefined;
    const logger = new LoggingService();
    logger.configure({
      level: OwnIDLogLevel.Warn,
      label: 'OwnID-Test',
      onLog: (entry) => {
        captured = entry;
      },
    });

    logger.emit(OwnIDLogLevel.Error, 'OwnID.initialize', 'Initialization failed.', cause);

    assert.ok(captured !== undefined);
    assert.equal(Object.isFrozen(captured), true);
    assert.deepEqual(Object.keys(captured), ['level', 'label', 'source', 'message', 'cause']);
    assert.equal(captured.level, OwnIDLogLevel.Error);
    assert.equal(captured.label, 'OwnID-Test');
    assert.equal(captured.source, 'OwnID.initialize');
    assert.equal(captured.message, 'Initialization failed.');
    assert.equal(captured.cause, cause);
    assert.equal(Object.isFrozen(cause), false);
  });

  test('an absent cause is omitted rather than stored as an undefined field', () => {
    let captured: OwnIDLogEntry | undefined;
    const logger = new LoggingService();
    logger.configure({ level: OwnIDLogLevel.Info, onLog: (entry) => (captured = entry) });

    logger.emit(OwnIDLogLevel.Info, 'Source', 'Message');

    assert.ok(captured !== undefined);
    assert.deepEqual(Object.keys(captured), ['level', 'label', 'source', 'message']);
    assert.equal(Object.hasOwn(captured, 'cause'), false);
  });

  test('the default sink maps severities to direct console calls', () => {
    const cause = new Error('failure');
    const debug = mock.method(console, 'debug', () => undefined);
    const info = mock.method(console, 'info', () => undefined);
    const warn = mock.method(console, 'warn', () => undefined);
    const error = mock.method(console, 'error', () => undefined);
    const logger = new LoggingService();

    try {
      logger.configure({ level: OwnIDLogLevel.Verbose, label: 'Label %s' });
      for (const severity of severities) {
        logger.emit(severity, 'Source %s', `Message ${severity}`, severity === OwnIDLogLevel.Error ? cause : undefined);
      }

      assert.equal(debug.mock.callCount(), 2);
      assert.equal(info.mock.callCount(), 1);
      assert.equal(warn.mock.callCount(), 1);
      assert.equal(error.mock.callCount(), 1);
      assert.deepEqual(debug.mock.calls[0]?.arguments, ['[Label %s] Source %s |> Message verbose']);
      assert.deepEqual(error.mock.calls[0]?.arguments, ['[Label %s] Source %s |> Message error', cause]);
    } finally {
      mock.restoreAll();
    }
  });

  test('the React Native console polyfill receives no SDK formatting placeholder', () => {
    const consoleModulePath = requireFromReactNative.resolve('@react-native/js-polyfills/console.js');
    const consoleDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'console');
    const developmentDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
    const nativeLoggingHookDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'nativeLoggingHook');
    const nativeLogs: { readonly message: string; readonly level: number }[] = [];

    Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false, writable: true });
    Object.defineProperty(globalThis, 'nativeLoggingHook', {
      configurable: true,
      value: (message: string, level: number) => nativeLogs.push({ message, level }),
      writable: true,
    });
    delete requireFromReactNative.cache[consoleModulePath];

    try {
      requireFromReactNative(consoleModulePath);
      const logger = new LoggingService();
      const cause = new Error('failure');
      logger.configure({ level: OwnIDLogLevel.Verbose, label: 'Label %s' });

      logger.emit(OwnIDLogLevel.Verbose, 'Source %s', 'Message %s');
      logger.emit(OwnIDLogLevel.Error, 'Source %s', 'Failure %s', cause);

      assert.deepEqual(nativeLogs[0], { message: '[Label %s] Source %s |> Message %s', level: 0 });
      assert.deepEqual(nativeLogs[1], { message: "'[Label %s] Source %s |> Failure %s', [Error: failure]", level: 3 });
      assert.equal(
        nativeLogs.some(({ message }) => message.startsWith("'%s', ")),
        false
      );
    } finally {
      if (consoleDescriptor === undefined) {
        delete (globalThis as { console?: Console }).console;
      } else {
        Object.defineProperty(globalThis, 'console', consoleDescriptor);
      }
      if (developmentDescriptor === undefined) {
        delete (globalThis as { __DEV__?: boolean }).__DEV__;
      } else {
        Object.defineProperty(globalThis, '__DEV__', developmentDescriptor);
      }
      if (nativeLoggingHookDescriptor === undefined) {
        delete (globalThis as { nativeLoggingHook?: (message: string, level: number) => void }).nativeLoggingHook;
      } else {
        Object.defineProperty(globalThis, 'nativeLoggingHook', nativeLoggingHookDescriptor);
      }
      delete requireFromReactNative.cache[consoleModulePath];
    }
  });

  test('a custom handler replaces the console sink', () => {
    const entries: OwnIDLogEntry[] = [];
    const debug = mock.method(console, 'debug', () => undefined);
    const logger = new LoggingService();

    try {
      logger.configure({ level: OwnIDLogLevel.Debug, onLog: (entry) => entries.push(entry) });
      logger.emit(OwnIDLogLevel.Debug, 'Source', 'Message');

      assert.equal(entries.length, 1);
      assert.equal(debug.mock.callCount(), 0);
    } finally {
      mock.restoreAll();
    }
  });

  test('handler reconfiguration and nested logging use the new complete snapshot', () => {
    const firstEntries: OwnIDLogEntry[] = [];
    const secondEntries: OwnIDLogEntry[] = [];
    const logger = new LoggingService();

    logger.configure({
      level: OwnIDLogLevel.Info,
      label: 'First',
      onLog: (entry) => {
        firstEntries.push(entry);
        logger.configure({
          level: OwnIDLogLevel.Debug,
          label: 'Second',
          onLog: (nested) => secondEntries.push(nested),
        });
        logger.emit(OwnIDLogLevel.Debug, 'Nested', 'nested');
      },
    });

    logger.emit(OwnIDLogLevel.Info, 'Outer', 'outer');

    assert.deepEqual(
      firstEntries.map(({ label, source }) => ({ label, source })),
      [{ label: 'First', source: 'Outer' }]
    );
    assert.deepEqual(
      secondEntries.map(({ label, source }) => ({ label, source })),
      [{ label: 'Second', source: 'Nested' }]
    );
  });

  test('synchronous handler failures are reported directly and do not escape', () => {
    const sinkFailure = new Error('sink failed');
    const error = mock.method(console, 'error', () => undefined);
    const logger = new LoggingService();
    logger.configure({
      level: OwnIDLogLevel.Error,
      label: 'OwnID-Test',
      onLog: () => {
        throw sinkFailure;
      },
    });

    try {
      assert.doesNotThrow(() => logger.emit(OwnIDLogLevel.Error, 'Source', 'Message'));
      assert.deepEqual(error.mock.calls[0]?.arguments, ['[OwnID-Test] Logging callback failed.', sinkFailure]);
    } finally {
      mock.restoreAll();
    }
  });

  test('rejected thenables returned by a void handler are observed without awaiting', async () => {
    const sinkFailure = new Error('async sink failed');
    const error = mock.method(console, 'error', () => undefined);
    const logger = new LoggingService();
    const handler: OwnIDLogHandler = async () => {
      throw sinkFailure;
    };
    logger.configure({ level: OwnIDLogLevel.Error, onLog: handler });

    try {
      assert.doesNotThrow(() => logger.emit(OwnIDLogLevel.Error, 'Source', 'Message'));
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(error.mock.calls[0]?.arguments, ['[OwnID-SDK] Logging callback failed.', sinkFailure]);
    } finally {
      mock.restoreAll();
    }
  });

  test('a throwing then getter is treated as a handler failure', () => {
    const thenFailure = new Error('then getter failed');
    const error = mock.method(console, 'error', () => undefined);
    const logger = new LoggingService();
    const handler = (() =>
      Object.defineProperty({}, 'then', {
        get: () => {
          throw thenFailure;
        },
      })) as unknown as OwnIDLogHandler;
    logger.configure({ level: OwnIDLogLevel.Error, onLog: handler });

    try {
      assert.doesNotThrow(() => logger.emit(OwnIDLogLevel.Error, 'Source', 'Message'));
      assert.deepEqual(error.mock.calls[0]?.arguments, ['[OwnID-SDK] Logging callback failed.', thenFailure]);
    } finally {
      mock.restoreAll();
    }
  });

  test('default console sink failures are swallowed', () => {
    const debug = mock.method(console, 'debug', () => {
      throw new Error('console failed');
    });
    const logger = new LoggingService();
    logger.configure({ level: OwnIDLogLevel.Debug });

    try {
      assert.doesNotThrow(() => logger.emit(OwnIDLogLevel.Debug, 'Source', 'Message'));
      assert.equal(debug.mock.callCount(), 1);
    } finally {
      mock.restoreAll();
    }
  });

  test('a failure in the direct console fallback is swallowed', () => {
    const error = mock.method(console, 'error', () => {
      throw new Error('console failed');
    });
    const logger = new LoggingService();
    logger.configure({
      level: OwnIDLogLevel.Error,
      onLog: () => {
        throw new Error('sink failed');
      },
    });

    try {
      assert.doesNotThrow(() => logger.emit(OwnIDLogLevel.Error, 'Source', 'Message'));
      assert.equal(error.mock.callCount(), 1);
    } finally {
      mock.restoreAll();
    }
  });
});
