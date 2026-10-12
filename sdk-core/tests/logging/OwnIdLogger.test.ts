import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, mock, test } from 'node:test';

import { OwnIDLogLevel } from '../../src/logging';
import type { OwnIDLogEntry, OwnIDLogHandler } from '../../src/logging';
import { OwnIdLogger } from '../../src/logging/OwnIdLogger';

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

describe('OwnIdLogger configuration and thresholds', () => {
  test('each threshold emits its severity and every more severe entry', () => {
    for (const threshold of thresholds) {
      const entries: OwnIDLogEntry[] = [];
      const logger = new OwnIdLogger();
      logger.configure({ level: threshold, onLog: (entry) => entries.push(entry) });

      for (const severity of severities) {
        logger.emit(severity, 'ThresholdTest', severity);
      }

      const expected = severities.slice(thresholds.indexOf(threshold));
      for (const severity of severities) assert.equal(logger.isEnabled(severity), expected.includes(severity), `${threshold}: ${severity}`);
      assert.equal(logger.isEnabled(OwnIDLogLevel.Off), false);
      assert.deepEqual(
        entries.map((entry) => entry.level),
        expected,
        threshold
      );
    }
  });

  test('omission resets to off, restores the default label, and releases the handler', () => {
    const entries: OwnIDLogEntry[] = [];
    const logger = new OwnIdLogger();
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
    const logger = new OwnIdLogger();
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

describe('OwnIdLogger records and sinks', () => {
  test('a custom handler receives an exact frozen record and the original cause', () => {
    const cause = { mutable: true };
    let captured: OwnIDLogEntry | undefined;
    const logger = new OwnIdLogger();
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
    const logger = new OwnIdLogger();
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
    const logger = new OwnIdLogger();

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
      const logger = new OwnIdLogger();
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
    const logger = new OwnIdLogger();

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
    const logger = new OwnIdLogger();

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

  test('same-handler synchronous nested logging preserves both entries', () => {
    const sources: string[] = [];
    const logger = new OwnIdLogger();
    logger.configure({
      level: OwnIDLogLevel.Error,
      onLog: (entry) => {
        sources.push(entry.source);
        if (entry.source === 'Outer') logger.emit(OwnIDLogLevel.Error, 'Nested', 'nested');
      },
    });
    logger.emit(OwnIDLogLevel.Error, 'Outer', 'outer');
    assert.deepEqual(sources, ['Outer', 'Nested']);
  });

  test('synchronous handler failures are reported directly and do not escape', () => {
    const sinkFailure = new Error('sink failed');
    const error = mock.method(console, 'error', () => undefined);
    const logger = new OwnIdLogger();
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
    const logger = new OwnIdLogger();
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
    const logger = new OwnIdLogger();
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
    const logger = new OwnIdLogger();
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
    const logger = new OwnIdLogger();
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

describe('OwnIdLogger configuration snapshots and handler boundaries', () => {
  test('reads each configuration getter once and ignores later changes to the input', () => {
    const logger = new OwnIdLogger();
    const entries: OwnIDLogEntry[] = [];
    const replacementEntries: OwnIDLogEntry[] = [];
    const reads: string[] = [];
    let level = OwnIDLogLevel.Info;
    let label = 'Captured';
    let handler: OwnIDLogHandler = (entry) => entries.push(entry);
    const options = {
      get level() {
        reads.push('level');
        return level;
      },
      get label() {
        reads.push('label');
        return label;
      },
      get onLog() {
        reads.push('onLog');
        return handler;
      },
    };
    logger.configure(options);
    level = OwnIDLogLevel.Off;
    label = 'Changed';
    handler = (entry) => replacementEntries.push(entry);
    logger.emit(OwnIDLogLevel.Info, 'Snapshot', '');
    assert.deepEqual(reads, ['level', 'label', 'onLog']);
    assert.deepEqual(entries, [{ level: OwnIDLogLevel.Info, label: 'Captured', source: 'Snapshot', message: '' }]);
    assert.deepEqual(replacementEntries, []);
  });

  test('throwing label or handler getters preserve the previous complete configuration', () => {
    const logger = new OwnIdLogger();
    const entries: OwnIDLogEntry[] = [];
    logger.configure({ level: OwnIDLogLevel.Info, label: 'Stable', onLog: (entry) => entries.push(entry) });
    for (const field of ['label', 'onLog'] as const) {
      const failure = new Error(`${field} getter failed`);
      const options = Object.defineProperty({ level: OwnIDLogLevel.Error, label: 'Candidate' }, field, {
        get: () => {
          throw failure;
        },
      });
      assert.throws(
        () => logger.configure(options),
        (cause: unknown) => cause === failure
      );
      logger.emit(OwnIDLogLevel.Info, field, 'still enabled');
    }
    assert.deepEqual(
      entries.map(({ level, label, source }) => ({ level, label, source })),
      [
        { level: OwnIDLogLevel.Info, label: 'Stable', source: 'label' },
        { level: OwnIDLogLevel.Info, label: 'Stable', source: 'onLog' },
      ]
    );
  });

  test('default and invalid runtime levels are disabled and Off never emits', () => {
    const logger = new OwnIdLogger();
    assert.ok(severities.every((severity) => !logger.isEnabled(severity)));
    const entries: OwnIDLogEntry[] = [];
    logger.configure({ level: OwnIDLogLevel.Verbose, onLog: (entry) => entries.push(entry) });
    for (const invalid of [undefined, null, 5, {}, 'trace', OwnIDLogLevel.Off]) {
      assert.equal(logger.isEnabled(invalid as never), false);
      assert.doesNotThrow(() => logger.emit(invalid as never, 'Invalid', 'ignored'));
    }
    logger.emit(OwnIDLogLevel.Error, 'Valid', '', null);
    assert.deepEqual(entries, [{ level: OwnIDLogLevel.Error, label: 'OwnID-SDK', source: 'Valid', message: '', cause: null }]);
  });

  test('a delayed handler rejection retains the label at emission after reconfiguration', async (context) => {
    const failure = new Error('delayed handler failure');
    let reject: (cause: unknown) => void = () => undefined;
    const pending = new Promise<void>((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    const error = context.mock.method(console, 'error', () => undefined);
    const logger = new OwnIdLogger();
    logger.configure({ level: OwnIDLogLevel.Error, label: 'Original', onLog: () => pending });
    logger.emit(OwnIDLogLevel.Error, 'Source', 'Message');
    logger.configure({ level: OwnIDLogLevel.Off, label: 'Replacement' });
    reject(failure);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(error.mock.callCount(), 1);
    assert.deepEqual(error.mock.calls[0]?.arguments, ['[Original] Logging callback failed.', failure]);
  });

  test('synchronous and callable thenables are assimilated without waiting or leaking rejection', async (context) => {
    const error = context.mock.method(console, 'error', () => undefined);
    for (const callable of [false, true]) {
      for (const rejects of [false, true]) {
        let thenCalls = 0;
        const failure = new Error('thenable failed');
        const result = Object.assign(callable ? () => undefined : {}, {
          then(resolve: () => void, reject: (cause: unknown) => void) {
            thenCalls++;
            if (rejects) reject(failure);
            else resolve();
          },
        });
        const logger = new OwnIdLogger();
        logger.configure({ level: OwnIDLogLevel.Error, onLog: (() => result) as unknown as OwnIDLogHandler });
        const before = error.mock.callCount();
        assert.doesNotThrow(() => logger.emit(OwnIDLogLevel.Error, 'Source', 'Message'));
        assert.equal(thenCalls, 0);
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(thenCalls, 1);
        assert.equal(error.mock.callCount(), before + (rejects ? 1 : 0));
        if (rejects) assert.deepEqual(error.mock.calls.at(-1)?.arguments, ['[OwnID-SDK] Logging callback failed.', failure]);
      }
    }
  });
});
