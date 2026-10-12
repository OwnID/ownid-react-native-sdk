import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { RuntimeConfigurationToken, RuntimeLanguageProviderToken } from '../../../src/configuration/runtime';
import { ContextToken } from '../../../src/context';
import { Container } from '../../../src/di';
import type { LoginPayload, OwnIDEliteErrorDetails, OwnIDEliteEvents, OwnIDEliteFinishParams } from '../../../src';
import { createEliteNamespace } from '../../../src/flows/elite/namespace';
import {
  createEliteRun,
  MissingEliteSessionProviderError,
  prepareEliteEvents,
  prepareEliteLaunch,
  type EliteLaunchSnapshot,
  type EliteRunClock,
  type EliteRunPort,
} from '../../../src/flows/elite/run';
import { ELITE_PROTOCOL_CHANNEL, ELITE_PROTOCOL_VERSION } from '../../../src/flows/elite/protocol';
// noinspection ES6PreferShortImport -- Keep Node tests independent of the React Native entry point.
import { OwnIDLogLevel } from '../../../src/logging';
import { OwnIdLogger } from '../../../src/logging/OwnIdLogger';
import { OwnIdLogRouterImpl } from '../../../src/logging/impl/OwnIdLogRouterImpl';
import type { OwnIdLogRouter } from '../../../src/logging/OwnIdLogRouter';
import { OwnIdLoggerDiToken, OwnIdLogRouterDiToken } from '../../../src/logging';
// noinspection ES6PreferShortImport -- Keep Node tests independent of the React Native entry point.
import { AuthMethod } from '../../../src/models/authentication';
// noinspection ES6PreferShortImport -- Keep Node tests independent of the React Native entry point.
import { ErrorCode } from '../../../src/models/error';
import { createNamespaceBinding } from '../../../src/namespace/scoping';
import { prepareProviders, SessionCreateProviderToken } from '../../../src/providers/internal';

const token = '00112233445566778899aabbccddeeff';
const otherToken = 'ffeeddccbbaa99887766554433221100';
const base = { channel: ELITE_PROTOCOL_CHANNEL, version: ELITE_PROTOCOL_VERSION, documentMode: 'https', documentToken: token } as const;

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function createClock() {
  const callbacks = new Map<number, { callback: () => void; due: number }>();
  let nextId = 0;
  let time = 0;
  const canceled: Array<() => void> = [];
  const clock: EliteRunClock = {
    now: () => time,
    setTimeout(callback, delay) {
      const id = ++nextId;
      callbacks.set(id, { callback, due: time + delay });
      return id;
    },
    clearTimeout(handle) {
      const timer = callbacks.get(handle as number);
      if (timer !== undefined) canceled.push(timer.callback);
      callbacks.delete(handle as number);
    },
  };
  function advance(duration: number): void {
    const target = time + duration;
    while (true) {
      const next = [...callbacks.entries()].filter(([, timer]) => timer.due <= target).sort((a, b) => a[1].due - b[1].due)[0];
      if (next === undefined) break;
      const [id, timer] = next;
      time = Math.max(time, timer.due);
      callbacks.delete(id);
      timer.callback();
    }
    time = target;
  }

  return {
    clock,
    expire: () => advance(90_000),
    advance,
    elapseWithoutDelivery(duration: number) {
      time += duration;
    },
    fireCanceled() {
      for (const callback of canceled.splice(0)) callback();
    },
    get pending() {
      return callbacks.size;
    },
  };
}

function localRouter(logger = new OwnIdLogger()): OwnIdLogRouter {
  return new OwnIdLogRouterImpl(
    () => logger,
    () => undefined
  );
}

function registerLogging(scope: Container): void {
  const localLogger = new OwnIdLogger();
  scope.registerValue(OwnIdLoggerDiToken, localLogger);
  scope.registerValue(OwnIdLogRouterDiToken, localRouter(localLogger));
}

function createHarness(overrides: Partial<EliteLaunchSnapshot> = {}) {
  const abortController = new AbortController();
  const messages: Array<Record<string, unknown>> = [];
  const calls: string[] = [];
  let current = true;
  let failNextPost = false;
  let failNextFocus = false;
  let onFocus: (() => void) | undefined;
  const snapshot: EliteLaunchSnapshot = {
    source: Object.freeze({
      html: '<html lang="en"></html>',
      url: 'https://login.example.com/',
      baseUrl: 'https://login.example.com/',
      installEliteScript: 'void 0;',
    }),
    binding: createNamespaceBinding(Container.createRoot('test'), abortController.signal, () => current),
    events: Object.freeze({}),
    sessionCreate: async () => ({ status: 'logged-in' }),
    logging: localRouter(),
    ...overrides,
  };
  const port: EliteRunPort = {
    postMessage(message) {
      if (failNextPost) {
        failNextPost = false;
        throw new Error('post failed');
      }
      messages.push(JSON.parse(message) as Record<string, unknown>);
    },
    requestFocus() {
      calls.push('focus');
      onFocus?.();
      if (failNextFocus) {
        failNextFocus = false;
        throw new Error('focus failed');
      }
    },
    stopLoading() {
      calls.push('stop');
    },
    loadFallback() {
      calls.push('fallback');
    },
    ready() {},
    settle() {
      calls.push('settle');
    },
  };
  const timer = createClock();
  const run = createEliteRun(snapshot, port, timer.clock);
  run.attach();
  run.mounted('https');

  return {
    run,
    messages,
    calls,
    timer,
    abort: () => abortController.abort(),
    makeStale: () => {
      current = false;
    },
    duringFocus(callback: () => void) {
      onFocus = callback;
    },
    failNextFocus: () => {
      failNextFocus = true;
    },
    failNextPost: () => {
      failNextPost = true;
    },
    receive(frame: Record<string, unknown>) {
      run.receive(JSON.stringify(frame));
    },
    start() {
      run.loaded('https');
      run.receive(JSON.stringify({ ...base, kind: 'document-ready' }));
      run.receive(JSON.stringify({ ...base, kind: 'ready' }));
      run.receive(JSON.stringify({ ...base, kind: 'start-issued' }));
    },
  };
}

describe('Elite launch preparation', () => {
  test('rejects missing options or origin before reading providers or resolving launch dependencies', () => {
    const scope = Container.createRoot('root');
    const namespace = createEliteNamespace(createNamespaceBinding(scope, new AbortController().signal, () => true));
    let providerReads = 0;
    const providers = {
      get session() {
        providerReads += 1;
        return { create: async () => ({ status: 'logged-in' as const }) };
      },
    };
    const invalidOptions: readonly unknown[] = [undefined, {}, { origin: undefined }];
    for (const options of invalidOptions) {
      assert.throws(
        () =>
          prepareEliteLaunch(
            namespace,
            options as Parameters<typeof prepareEliteLaunch>[1],
            EMPTY_EVENTS,
            providers,
            '/.well-known/assetlinks.json'
          ),
        TypeError
      );
    }
    assert.equal(providerReads, 0);
  });

  test('snapshots Context, language, callbacks, and the effective provider without mutating the namespace', async () => {
    const scope = Container.createRoot('root');
    const abortController = new AbortController();
    const inherited = async (payload: LoginPayload) => {
      void payload;
      return { status: 'logged-in' as const, result: 'inherited' };
    };
    const override = async (payload: LoginPayload) => {
      void payload;
      return { status: 'logged-in' as const, result: 'override' };
    };
    scope.registerValue(RuntimeConfigurationToken, Object.freeze({ appId: 'App123', env: 'uat', region: 'eu' }));
    scope.registerValue(RuntimeLanguageProviderToken, Object.freeze({ snapshot: () => Object.freeze(['uk-UA', 'en-US']) }));
    scope.registerValue(ContextToken, Object.freeze({ loginId: 'user@example.com' }));
    registerLogging(scope);
    scope.registerValue(SessionCreateProviderToken, prepareProviders({ session: { create: inherited } }).sessionCreate!);
    const binding = createNamespaceBinding(scope, abortController.signal, () => true);
    const namespace = createEliteNamespace(binding);
    const onClose = async () => undefined;
    const events = prepareEliteEvents({ onClose });

    const launch = prepareEliteLaunch(
      namespace,
      { origin: 'HTTPS://LOGIN.EXAMPLE.COM:0443/Account/Elite?b=2&a=1&a=3' },
      events,
      {
        session: { create: override },
      },
      '/.well-known/assetlinks.json'
    );

    assert.equal(Object.isFrozen(launch), true);
    assert.equal(launch.events.onClose, onClose);
    assert.equal(launch.sessionCreate, override);
    assert.deepEqual(await launch.sessionCreate({ metadata: { loginId: 'a', authType: AuthMethod.PASSKEY } }), {
      status: 'logged-in',
      result: 'override',
    });
    assert.equal(launch.source.url, 'https://login.example.com/Account/Elite?b=2&a=1&a=3');
    assert.match(launch.source.installEliteScript, /"language":"uk-UA"/);
    assert.match(launch.source.installEliteScript, /"loginId":"user@example.com"/);
    assert.equal(scope.resolve(SessionCreateProviderToken).create, inherited);
  });

  test('validates callback getters once and rejects a missing effective session provider', () => {
    let reads = 0;
    const callback = async () => undefined;
    const events = Object.defineProperty({}, 'onError', {
      enumerable: true,
      get() {
        reads += 1;
        return callback;
      },
    }) as OwnIDEliteEvents;
    const prepared = prepareEliteEvents(events);
    assert.equal(reads, 1);
    assert.equal(prepared.onError, callback);
    assert.equal(Object.isFrozen(prepared), true);

    const scope = Container.createRoot('root');
    scope.registerValue(RuntimeConfigurationToken, Object.freeze({ appId: 'App123', env: 'prod', region: 'us' }));
    scope.registerValue(RuntimeLanguageProviderToken, Object.freeze({ snapshot: () => null }));
    registerLogging(scope);
    const namespace = createEliteNamespace(createNamespaceBinding(scope, new AbortController().signal, () => true));
    assert.throws(
      () => prepareEliteLaunch(namespace, { origin: 'https://login.example.com/' }, prepared, undefined, '/.well-known/assetlinks.json'),
      MissingEliteSessionProviderError
    );
  });

  test('rejects a namespace invalidated by a provider getter before resolving dependencies', () => {
    const scope = Container.createRoot('root');
    const abortController = new AbortController();
    scope.registerValue(RuntimeConfigurationToken, Object.freeze({ appId: 'App123', env: 'prod', region: 'us' }));
    scope.registerValue(RuntimeLanguageProviderToken, Object.freeze({ snapshot: () => null }));
    registerLogging(scope);
    const namespace = createEliteNamespace(createNamespaceBinding(scope, abortController.signal, () => !abortController.signal.aborted));
    const providers = {
      get session() {
        abortController.abort();
        return { create: async () => ({ status: 'logged-in' as const }) };
      },
    };

    assert.throws(
      () =>
        prepareEliteLaunch(namespace, { origin: 'https://login.example.com/' }, EMPTY_EVENTS, providers, '/.well-known/assetlinks.json'),
      /no longer active/
    );
  });
});

const EMPTY_EVENTS: OwnIDEliteEvents = Object.freeze({});

describe('Elite run controller', () => {
  test('separates HTTPS acquisition from SDK startup and gives fallback one startup budget', () => {
    const errors: OwnIDEliteErrorDetails[] = [];
    const h = createHarness({ events: { onError: async (_message, details) => void errors.push(details) } });
    h.timer.advance(29_999);
    h.receive({ ...base, kind: 'document-ready' });
    h.timer.advance(29_999);
    assert.deepEqual(h.calls, []);
    h.timer.advance(1);
    assert.deepEqual(h.calls, ['fallback']);
    assert.equal(errors.length, 0);
    h.timer.advance(29_999);
    assert.equal(errors.length, 0);
    h.timer.advance(1);
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.code, ErrorCode.TIMEOUT);
    assert.deepEqual(h.calls, ['fallback', 'stop', 'settle']);
  });

  test('an acquisition timeout switches immediately and does not reset inline startup on document readiness', () => {
    const errors: OwnIDEliteErrorDetails[] = [];
    const h = createHarness({ events: { onError: async (_message, details) => void errors.push(details) } });
    h.timer.advance(30_000);
    assert.deepEqual(h.calls, ['fallback']);
    h.timer.advance(20_000);
    h.receive({ ...base, documentMode: 'inline', documentToken: otherToken, kind: 'document-ready' });
    h.timer.advance(9_999);
    assert.equal(errors.length, 0);
    h.timer.advance(1);
    assert.equal(errors.length, 1);
  });

  test('cleared timer callbacks and obsolete frames cannot affect the replacement deadline', () => {
    const h = createHarness();
    h.timer.advance(1_000);
    h.run.startupFailure('network failed', ErrorCode.NETWORK, 'test.load');
    h.timer.fireCanceled();
    h.receive({ ...base, kind: 'document-ready' });
    h.receive({ ...base, kind: 'ready' });
    h.run.loaded('https');
    assert.deepEqual(h.messages, []);
    assert.equal(h.timer.pending, 1);
    h.timer.advance(29_999);
    assert.deepEqual(h.calls, ['fallback']);
    h.timer.advance(1);
    assert.deepEqual(h.calls, ['fallback', 'stop', 'settle']);
  });

  test('detach and repeated mounts preserve the overall cap when fallback is delayed', () => {
    const h = createHarness();
    h.timer.advance(20_000);
    h.receive({ ...base, kind: 'document-ready' });
    h.run.detach();
    h.timer.advance(60_000);
    h.run.attach();
    assert.deepEqual(h.calls, ['fallback']);
    h.run.mounted('inline');
    h.timer.advance(9_999);
    assert.deepEqual(h.calls, ['fallback']);
    h.timer.advance(1);
    assert.deepEqual(h.calls, ['fallback', 'stop', 'settle']);
  });

  for (const callback of ['loaded', 'document-ready'] as const) {
    test(`enforces acquisition expiry through ${callback} when timer delivery is delayed`, () => {
      const errors: OwnIDEliteErrorDetails[] = [];
      const h = createHarness({ events: { onError: async (_message, details) => void errors.push(details) } });
      h.timer.elapseWithoutDelivery(30_000);
      if (callback === 'loaded') h.run.loaded('https');
      else h.receive({ ...base, kind: 'document-ready' });
      assert.deepEqual(h.calls, ['fallback']);
      assert.deepEqual(h.messages, []);
      assert.equal(errors.length, 0);
      h.timer.fireCanceled();
      h.timer.advance(29_999);
      assert.deepEqual(h.calls, ['fallback']);
      h.timer.advance(1);
      assert.deepEqual(h.calls, ['fallback', 'stop', 'settle']);
      assert.equal(errors.length, 1);
      assert.equal(errors[0]?.code, ErrorCode.TIMEOUT);
    });
  }

  test('ordinary initialization failures recover internally once and final failure keeps its own details', () => {
    for (const phase of ['script-load', 'initialization'] as const) {
      const errors: Array<[string, OwnIDEliteErrorDetails]> = [];
      const h = createHarness({ events: { onError: async (message, details) => void errors.push([message, details]) } });
      h.receive({ ...base, kind: 'failure', phase, message: 'primary failed' });
      assert.equal(errors.length, 0);
      assert.deepEqual(h.calls, ['fallback']);
      h.receive({
        ...base,
        documentMode: 'inline',
        documentToken: otherToken,
        kind: 'failure',
        phase: 'initialization',
        message: 'inline failed',
        details: { code: ErrorCode.FORBIDDEN, source: 'Web.init', additionalDetails: 'final detail' },
      });
      assert.deepEqual(errors, [
        ['inline failed', { code: ErrorCode.FORBIDDEN, source: 'Web.init', additionalDetails: 'final detail', terminal: true }],
      ]);
      h.timer.expire();
      assert.equal(errors.length, 1);
    }
  });

  test('permission transmission prevents recovery while its start acknowledgment is delayed', () => {
    const errors: OwnIDEliteErrorDetails[] = [];
    const h = createHarness({ events: { onError: async (_message, details) => void errors.push(details) } });
    h.run.loaded('https');
    h.receive({ ...base, kind: 'document-ready' });
    h.receive({ ...base, kind: 'ready' });
    h.run.startupFailure('late native failure', ErrorCode.NETWORK, 'test.load');
    h.receive({ ...base, kind: 'start-issued' });
    assert.deepEqual(h.calls, ['focus', 'stop', 'settle']);
    assert.equal(errors.length, 1);
    assert.equal(h.messages.filter((frame) => frame.kind === 'start-permission').length, 1);
  });

  test('cancellation stays silent and prevents pending acquisition callbacks from recovering', () => {
    const errors: OwnIDEliteErrorDetails[] = [];
    const h = createHarness({ events: { onError: async (_message, details) => void errors.push(details) } });
    h.abort();
    h.timer.fireCanceled();
    h.run.startupFailure('late failure', ErrorCode.NETWORK, 'test.load');
    h.receive({ ...base, kind: 'document-ready' });
    assert.deepEqual(h.calls, ['stop', 'settle']);
    assert.deepEqual(errors, []);
  });

  for (const order of ['load before ready', 'ready before load'] as const) {
    test(`waits for ${order}, focuses once, and ends the deadline at start-issued`, () => {
      const harness = createHarness();
      const loaded = () => harness.run.loaded('https');
      const ready = () => {
        harness.receive({ ...base, kind: 'document-ready' });
        harness.receive({ ...base, kind: 'ready' });
      };
      const [first, second] = order === 'load before ready' ? [loaded, ready] : [ready, loaded];
      first();
      assert.deepEqual(harness.messages, []);
      assert.deepEqual(harness.calls, []);
      second();
      assert.deepEqual(harness.calls, ['focus']);
      assert.deepEqual(harness.messages, [{ ...base, kind: 'start-permission' }]);
      harness.run.loaded('https');
      assert.deepEqual(harness.calls, ['focus']);
      assert.equal(harness.messages.length, 1);
      assert.equal(harness.timer.pending, 1);
      harness.receive({ ...base, kind: 'start-issued' });
      assert.equal(harness.timer.pending, 0);
    });
  }

  test('expires startup once after making the run inert and never times work after start-issued', () => {
    const errors: Array<[string, OwnIDEliteErrorDetails]> = [];
    const harness = createHarness({
      events: Object.freeze({
        onError: async (message: string, details: OwnIDEliteErrorDetails) => {
          assert.ok(harness.calls.includes('settle'));
          errors.push([message, details]);
        },
      }),
    });

    harness.timer.expire();
    harness.timer.expire();
    assert.equal(errors.length, 1);
    assert.deepEqual(errors[0]?.[1], { code: ErrorCode.TIMEOUT, source: 'OwnIDEliteView.startup', terminal: true });
    harness.receive({ ...base, kind: 'document-ready' });
    harness.receive({ ...base, kind: 'ready' });
    assert.deepEqual(harness.calls, ['fallback', 'stop', 'settle']);

    const started = createHarness();
    started.start();
    started.timer.expire();
    assert.deepEqual(started.calls, ['focus']);
  });

  test('recovers an HTTPS focus failure before permission and reports a repeated inline failure once', () => {
    const errors: OwnIDEliteErrorDetails[] = [];
    const h = createHarness({ events: { onError: async (_message, details) => void errors.push(details) } });
    h.failNextFocus();
    h.run.loaded('https');
    h.receive({ ...base, kind: 'document-ready' });
    h.receive({ ...base, kind: 'ready' });
    assert.deepEqual(h.calls, ['focus', 'fallback']);
    assert.equal(errors.length, 0);
    assert.equal(h.messages.filter((frame) => frame.kind === 'start-permission').length, 0);

    h.failNextFocus();
    h.run.loaded('inline');
    h.receive({ ...base, documentMode: 'inline', documentToken: otherToken, kind: 'document-ready' });
    h.receive({ ...base, documentMode: 'inline', documentToken: otherToken, kind: 'ready' });
    assert.deepEqual(h.calls, ['focus', 'fallback', 'focus', 'stop', 'settle']);
    assert.deepEqual(errors, [{ code: ErrorCode.UNKNOWN, source: 'OwnIDEliteView.bridge', terminal: true }]);
    h.timer.expire();
    assert.equal(errors.length, 1);
    assert.equal(h.messages.filter((frame) => frame.kind === 'start-permission').length, 0);
  });

  for (const throwsAfterReplacement of [false, true]) {
    test(`preserves fallback when focus replaces its document${throwsAfterReplacement ? ' and then throws' : ''}`, () => {
      const errors: OwnIDEliteErrorDetails[] = [];
      const h = createHarness({ events: { onError: async (_message, details) => void errors.push(details) } });
      h.duringFocus(() => {
        h.run.startupFailure('native loading failed during focus', ErrorCode.NETWORK, 'test.load');
        if (throwsAfterReplacement) throw new Error('obsolete focus failed');
      });
      h.run.loaded('https');
      h.receive({ ...base, kind: 'document-ready' });
      h.receive({ ...base, kind: 'ready' });
      assert.deepEqual(h.calls, ['focus', 'fallback']);
      assert.deepEqual(h.messages, []);
      assert.deepEqual(errors, []);
      assert.equal(h.timer.pending, 1);

      h.duringFocus(() => undefined);
      const inlineBase = { ...base, documentMode: 'inline', documentToken: otherToken };
      h.run.loaded('inline');
      h.receive({ ...inlineBase, kind: 'document-ready' });
      h.receive({ ...inlineBase, kind: 'ready' });
      assert.deepEqual(h.messages, [{ ...inlineBase, kind: 'start-permission' }]);
      h.receive({ ...inlineBase, kind: 'start-issued' });
      h.timer.expire();
      assert.deepEqual(h.calls, ['focus', 'fallback', 'focus']);
      assert.deepEqual(errors, []);
    });
  }

  for (const invalidation of ['abort', 'stale binding'] as const) {
    test(`does not grant permission when focus causes ${invalidation}`, () => {
      const errors: OwnIDEliteErrorDetails[] = [];
      const h = createHarness({ events: { onError: async (_message, details) => void errors.push(details) } });
      h.duringFocus(invalidation === 'abort' ? h.abort : h.makeStale);
      h.run.loaded('https');
      h.receive({ ...base, kind: 'document-ready' });
      h.receive({ ...base, kind: 'ready' });
      assert.deepEqual(h.calls, ['focus', 'stop', 'settle']);
      assert.deepEqual(h.messages, [{ ...base, kind: 'abort' }]);
      assert.deepEqual(errors, []);
      assert.equal(h.timer.pending, 0);
      h.timer.fireCanceled();
      h.receive({ ...base, kind: 'start-issued' });
      assert.deepEqual(h.calls, ['focus', 'stop', 'settle']);
    });
  }

  test('stops the run when start permission cannot reach the hosted document', () => {
    const errors: Array<readonly [string, OwnIDEliteErrorDetails]> = [];
    const harness = createHarness({
      events: Object.freeze({
        onError: async (message: string, details: OwnIDEliteErrorDetails) => void errors.push([message, details]),
      }),
    });

    harness.run.loaded('https');
    harness.failNextPost();
    harness.receive({ ...base, kind: 'document-ready' });
    harness.receive({ ...base, kind: 'ready' });

    assert.deepEqual(harness.messages, [{ ...base, kind: 'abort' }]);
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
    assert.equal(harness.timer.pending, 0);
    assert.deepEqual(errors, [
      ['OwnID Elite could not start its hosted document.', { code: ErrorCode.UNKNOWN, source: 'OwnIDEliteView.bridge', terminal: true }],
    ]);
  });

  test('delivers repeatable live Web errors with terminal false and acknowledges fulfillment or rejection', async () => {
    const details: unknown[] = [];
    let reject = false;
    const harness = createHarness({
      events: Object.freeze({
        onError: async (_message: string, value: OwnIDEliteErrorDetails) => {
          details.push(value);
          if (reject) throw new Error('app rejected');
        },
      }),
    });
    harness.start();

    harness.receive({
      ...base,
      kind: 'request',
      id: 1,
      method: 'events.onError',
      params: ['Retry', { code: ErrorCode.NETWORK, source: 'Login', additionalDetails: { retryable: true } }],
    });
    await flush();
    assert.deepEqual(details[0], {
      code: ErrorCode.NETWORK,
      source: 'Login',
      additionalDetails: { retryable: true },
      terminal: false,
    });
    assert.deepEqual(harness.messages.at(-1), { ...base, kind: 'response', id: 1 });

    reject = true;
    harness.receive({
      ...base,
      kind: 'request',
      id: 2,
      method: 'events.onError',
      params: ['Again', { code: ErrorCode.UNKNOWN, source: 'Login' }],
    });
    await flush();
    assert.deepEqual(harness.messages.at(-1), {
      ...base,
      kind: 'response',
      id: 2,
      error: { message: 'OwnID Elite application callback failed.' },
    });
    assert.equal(details.length, 2);
    assert.equal(harness.calls.includes('settle'), false);
  });

  test('returns serializable provider results and drops duplicate and foreign-token requests', async () => {
    const payloads: unknown[] = [];
    const harness = createHarness({
      sessionCreate: async (payload) => {
        payloads.push(payload);
        return { status: 'logged-in', result: { persisted: true } };
      },
    });
    harness.start();
    const request = {
      ...base,
      kind: 'request',
      id: 7,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY }, isNewUser: true }],
    };
    harness.receive(request);
    harness.receive(request);
    harness.receive({ ...request, documentToken: otherToken, id: 8 });
    await flush();

    assert.equal(payloads.length, 1);
    assert.deepEqual(harness.messages.at(-1), {
      ...base,
      kind: 'response',
      id: 7,
      result: { status: 'logged-in', result: { persisted: true } },
    });
  });

  for (const failure of ['throw', 'reject'] as const) {
    test(`acknowledges a provider ${failure} without ending the run and accepts a retry`, async () => {
      let attempts = 0;
      const errors: OwnIDEliteErrorDetails[] = [];
      const h = createHarness({
        events: { onError: async (_message, details) => void errors.push(details) },
        sessionCreate: () => {
          attempts++;
          if (attempts === 1) {
            if (failure === 'throw') throw new Error('provider failed');
            return Promise.reject(new Error('provider failed'));
          }
          return Promise.resolve({ status: 'logged-in' });
        },
      });
      h.start();
      const request = {
        ...base,
        kind: 'request',
        method: 'providers.session.create',
        params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
      };
      h.receive({ ...request, id: 1 });
      await flush();
      assert.deepEqual(h.messages.at(-1), {
        ...base,
        kind: 'response',
        id: 1,
        error: { message: 'OwnID Elite application callback failed.' },
      });
      assert.deepEqual(h.calls, ['focus']);
      assert.deepEqual(errors, []);
      h.receive({ ...request, id: 2 });
      await flush();
      assert.deepEqual(h.messages.at(-1), { ...base, kind: 'response', id: 2, result: { status: 'logged-in' } });
      assert.equal(attempts, 2);
      assert.deepEqual(h.calls, ['focus']);
      assert.deepEqual(errors, []);
    });
  }

  test('returns a structured session failure result without treating it as an application exception', async () => {
    const result = { status: 'fail' as const, reason: 'session rejected' };
    const errors: OwnIDEliteErrorDetails[] = [];
    const h = createHarness({
      sessionCreate: async () => result,
      events: { onError: async (_message, details) => void errors.push(details) },
    });
    h.start();
    h.receive({
      ...base,
      kind: 'request',
      id: 1,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    await flush();
    assert.deepEqual(h.messages.at(-1), { ...base, kind: 'response', id: 1, result });
    assert.deepEqual(h.calls, ['focus']);
    assert.deepEqual(errors, []);
  });

  test('rejects a nonserializable provider result without ending the run', async () => {
    const harness = createHarness({
      sessionCreate: async () => ({ status: 'logged-in', result: () => undefined }),
    });
    harness.start();
    harness.receive({
      ...base,
      kind: 'request',
      id: 8,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    await flush();

    assert.deepEqual(harness.messages.at(-1), {
      ...base,
      kind: 'response',
      id: 8,
      error: { message: 'OwnID Elite session provider failed.' },
    });
    assert.equal(harness.calls.includes('settle'), false);
  });

  test('does not reply after invalid-result logging invalidates the instance', async () => {
    let invalidate = (): void => undefined;
    const logging = new OwnIdLogger();
    logging.configure({ level: OwnIDLogLevel.Error, onLog: () => invalidate() });
    const harness = createHarness({
      logging: localRouter(logging),
      sessionCreate: async () => ({ status: 'logged-in', result: () => undefined }),
    });
    invalidate = harness.makeStale;
    harness.start();
    harness.receive({
      ...base,
      kind: 'request',
      id: 81,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    await flush();

    assert.equal(
      harness.messages.some((frame) => frame.id === 81),
      false
    );
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('does not reply when provider-result serialization invalidates the instance', async () => {
    let invalidate = (): void => undefined;
    const result = Object.defineProperty({}, 'value', {
      enumerable: true,
      get() {
        invalidate();
        return 'stale';
      },
    });
    const harness = createHarness({ sessionCreate: async () => ({ status: 'logged-in', result }) });
    invalidate = harness.makeStale;
    harness.start();
    harness.receive({
      ...base,
      kind: 'request',
      id: 82,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    await flush();

    assert.equal(
      harness.messages.some((frame) => frame.id === 82),
      false
    );
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('treats a provider response delivery failure as terminal instead of retrying it as invalid data', async () => {
    const errors: OwnIDEliteErrorDetails[] = [];
    const harness = createHarness({
      sessionCreate: async () => ({ status: 'logged-in' }),
      events: Object.freeze({
        onError: async (_message: string, details: OwnIDEliteErrorDetails) => void errors.push(details),
      }),
    });
    harness.start();
    harness.failNextPost();
    harness.receive({
      ...base,
      kind: 'request',
      id: 9,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    await flush();

    assert.equal(
      harness.messages.some((frame) => frame.id === 9),
      false
    );
    assert.deepEqual(harness.messages.at(-1), { ...base, kind: 'abort' });
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.code, ErrorCode.UNKNOWN);
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('makes finish terminal before invoking the app, waits for it, and suppresses the reply after disposal', async () => {
    let resolveFinish: (() => void) | undefined;
    const finish = new Promise<void>((resolve) => {
      resolveFinish = resolve;
    });
    const harness = createHarness({
      events: Object.freeze({
        onFinish: () => {
          assert.equal(harness.timer.pending, 0);
          return finish;
        },
      }),
    });
    harness.start();
    harness.receive({
      ...base,
      kind: 'request',
      id: 3,
      method: 'events.onFinish',
      params: [{ loginId: 'user@example.com', authType: AuthMethod.PASSKEY, source: 'mobile' }],
    });
    harness.receive({
      ...base,
      kind: 'request',
      id: 4,
      method: 'events.onError',
      params: ['stale', { code: ErrorCode.UNKNOWN, source: 'Web' }],
    });
    assert.equal(
      harness.messages.some((frame) => frame.id === 3),
      false
    );
    harness.run.dispose();
    resolveFinish?.();
    await flush();
    assert.equal(
      harness.messages.some((frame) => frame.id === 3),
      false
    );
    assert.equal(harness.calls.filter((call) => call === 'settle').length, 1);
  });

  test('copies finish parameters without browser context while preserving additive JSON fields', async () => {
    let received: Record<string, unknown> | undefined;
    const harness = createHarness({
      events: Object.freeze({
        onFinish: async (params: OwnIDEliteFinishParams) => {
          received = params as unknown as Record<string, unknown>;
        },
      }),
    });
    const params = {
      loginId: 'user@example.com',
      authType: AuthMethod.PASSKEY,
      source: 'mobile',
      authToken: 'token',
      context: { location: 'browser-only' },
      transactionId: 'transaction',
      extension: { nested: true },
    };
    harness.start();
    harness.receive({ ...base, kind: 'request', id: 30, method: 'events.onFinish', params: [params] });
    await flush();

    assert.deepEqual(received, {
      loginId: 'user@example.com',
      authType: AuthMethod.PASSKEY,
      source: 'mobile',
      authToken: 'token',
      transactionId: 'transaction',
      extension: { nested: true },
    });
    assert.deepEqual(params.context, { location: 'browser-only' });
  });

  test('skips a terminal reply when detached during the application callback and settles on reattach', async () => {
    let resolveClose: (() => void) | undefined;
    const close = new Promise<void>((resolve) => {
      resolveClose = resolve;
    });
    const harness = createHarness({ events: Object.freeze({ onClose: () => close }) });
    harness.start();
    harness.receive({ ...base, kind: 'request', id: 31, method: 'events.onClose', params: [] });
    harness.run.detach();
    resolveClose?.();
    await flush();

    assert.equal(
      harness.messages.some((frame) => frame.id === 31),
      false
    );
    assert.deepEqual(harness.calls, ['focus']);
    harness.run.attach();
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('best-effort acknowledges an attached close and then removes the native child', async () => {
    const harness = createHarness();
    harness.start();
    harness.receive({ ...base, kind: 'request', id: 4, method: 'events.onClose', params: [] });
    await flush();

    assert.deepEqual(harness.messages.at(-1), { ...base, kind: 'response', id: 4 });
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('best-effort reports a rejected attached terminal callback and still settles', async () => {
    const harness = createHarness({
      events: Object.freeze({
        onClose: async () => {
          throw new Error('app rejected');
        },
      }),
    });
    harness.start();
    harness.receive({ ...base, kind: 'request', id: 40, method: 'events.onClose', params: [] });
    await flush();

    assert.deepEqual(harness.messages.at(-1), {
      ...base,
      kind: 'response',
      id: 40,
      error: { message: 'OwnID Elite application callback failed.' },
    });
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('still settles when the best-effort terminal callback response cannot be delivered', async () => {
    let reportAnotherFailure = (): void => undefined;
    const logging = new OwnIdLogger();
    logging.configure({ level: OwnIDLogLevel.Error, onLog: () => reportAnotherFailure() });
    const harness = createHarness({ logging: localRouter(logging) });
    reportAnotherFailure = () => harness.run.fail('Nested failure.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process', new Error('nested'));
    harness.start();
    harness.failNextPost();
    harness.receive({ ...base, kind: 'request', id: 41, method: 'events.onClose', params: [] });
    await flush();

    assert.equal(
      harness.messages.some((frame) => frame.id === 41),
      false
    );
    assert.deepEqual(harness.messages.at(-1), { ...base, kind: 'start-permission' });
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('settles a completed start silently and reports page/protocol failures only once', () => {
    const failures: Array<[string, OwnIDEliteErrorDetails]> = [];
    const harness = createHarness({
      events: Object.freeze({
        onError: async (message: string, details: OwnIDEliteErrorDetails) => void failures.push([message, details]),
      }),
    });
    harness.start();
    harness.receive({ ...base, kind: 'start-settled', status: 'completed' });
    assert.equal(failures.length, 0);
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);

    const failed = createHarness({
      events: Object.freeze({
        onError: async (message: string, details: OwnIDEliteErrorDetails) => void failures.push([message, details]),
      }),
    });
    failed.receive({
      ...base,
      kind: 'failure',
      phase: 'initialization',
      message: 'Rejected',
      details: { code: ErrorCode.FORBIDDEN, source: 'Web.init', additionalDetails: 'denied' },
    });
    assert.equal(failures.length, 0);
    failed.receive({
      ...base,
      documentMode: 'inline',
      kind: 'failure',
      phase: 'initialization',
      message: 'Rejected',
      details: { code: ErrorCode.FORBIDDEN, source: 'Web.init', additionalDetails: 'denied' },
    });
    failed.run.receive('{');
    assert.equal(failures.length, 1);
    assert.deepEqual(failures[0]?.[1], {
      code: ErrorCode.FORBIDDEN,
      source: 'Web.init',
      additionalDetails: 'denied',
      terminal: true,
    });

    const protocolFailures: Array<[string, OwnIDEliteErrorDetails]> = [];
    const malformed = createHarness({
      events: Object.freeze({
        onError: async (message: string, details: OwnIDEliteErrorDetails) => void protocolFailures.push([message, details]),
      }),
    });
    malformed.run.receive('{');
    malformed.run.receive('{');
    assert.equal(protocolFailures.length, 1);
    assert.equal(protocolFailures[0]?.[1].code, ErrorCode.UNKNOWN);
    assert.equal(protocolFailures[0]?.[1].terminal, true);
  });

  test('suppresses a terminal error callback when failure logging invalidates its instance', () => {
    let invalidate = (): void => undefined;
    const logging = new OwnIdLogger();
    logging.configure({ level: OwnIDLogLevel.Error, onLog: () => invalidate() });
    let errorCalls = 0;
    const harness = createHarness({
      logging: localRouter(logging),
      events: Object.freeze({
        onError: async () => {
          errorCalls += 1;
        },
      }),
    });
    invalidate = harness.makeStale;

    harness.run.fail('Renderer stopped.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process', new Error('process gone'));

    assert.equal(errorCalls, 0);
    assert.deepEqual(harness.calls, ['stop', 'settle']);
  });

  test('instance invalidation is silent and suppresses pending application replies', async () => {
    let resolveProvider: ((value: { status: 'logged-in' }) => void) | undefined;
    const provider = new Promise<{ status: 'logged-in' }>((resolve) => {
      resolveProvider = resolve;
    });
    const errors: unknown[] = [];
    const harness = createHarness({
      sessionCreate: () => provider,
      events: Object.freeze({
        onError: async (message: string, details: OwnIDEliteErrorDetails) => void errors.push([message, details]),
      }),
    });
    harness.start();
    harness.receive({
      ...base,
      kind: 'request',
      id: 9,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    harness.abort();
    resolveProvider?.({ status: 'logged-in' });
    await flush();

    assert.equal(errors.length, 0);
    assert.equal(
      harness.messages.some((frame) => frame.id === 9),
      false
    );
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('detach preserves the document and elapsed deadline while deferring requests and replies until attach', async () => {
    const payloads: unknown[] = [];
    const harness = createHarness({
      sessionCreate: async (payload) => {
        payloads.push(payload);
        return { status: 'logged-in' };
      },
    });
    harness.start();
    harness.run.detach();
    harness.receive({
      ...base,
      kind: 'request',
      id: 11,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    await flush();
    assert.equal(payloads.length, 0);
    assert.deepEqual(harness.calls, ['focus']);

    harness.run.attach();
    await flush();
    assert.equal(payloads.length, 1);
    assert.deepEqual(harness.messages.at(-1), { ...base, kind: 'response', id: 11, result: { status: 'logged-in' } });

    const expired = createHarness();
    expired.run.detach();
    expired.timer.advance(90_000);
    expired.run.attach();
    assert.deepEqual(expired.calls, ['stop', 'settle']);
  });

  test('reattach expires startup at the original deadline after time passes attached and detached', () => {
    const errors: OwnIDEliteErrorDetails[] = [];
    const harness = createHarness({
      events: Object.freeze({
        onError: async (_message: string, details: OwnIDEliteErrorDetails) => void errors.push(details),
      }),
    });
    harness.run.loaded('https');
    harness.receive({ ...base, kind: 'document-ready' });
    harness.receive({ ...base, kind: 'ready' });
    harness.timer.advance(1_000);
    harness.run.detach();
    assert.equal(harness.timer.pending, 0);
    harness.timer.advance(3_000);
    harness.run.attach();
    assert.equal(harness.timer.pending, 1);
    assert.deepEqual(harness.calls, ['focus']);
    assert.deepEqual(harness.messages, [{ ...base, kind: 'start-permission' }]);

    harness.timer.advance(25_999);
    assert.deepEqual(errors, []);
    assert.deepEqual(harness.calls, ['focus']);
    harness.timer.advance(1);
    assert.deepEqual(errors, [{ code: ErrorCode.TIMEOUT, source: 'OwnIDEliteView.startup', terminal: true }]);
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
    assert.equal(harness.timer.pending, 0);
    harness.timer.advance(30_000);
    assert.equal(errors.length, 1);
  });

  test('does not accept a detached start-issued frame after the absolute startup deadline', () => {
    const errors: OwnIDEliteErrorDetails[] = [];
    const harness = createHarness({
      events: Object.freeze({
        onError: async (_message: string, details: OwnIDEliteErrorDetails) => void errors.push(details),
      }),
    });
    harness.run.loaded('https');
    harness.receive({ ...base, kind: 'document-ready' });
    harness.receive({ ...base, kind: 'ready' });
    harness.run.detach();
    harness.timer.advance(30_000);
    harness.receive({ ...base, kind: 'start-issued' });
    assert.equal(errors.length, 0);

    harness.run.attach();
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.code, ErrorCode.TIMEOUT);
    assert.equal(harness.timer.pending, 0);
  });

  test('reserves a detached finish before any later queued provider request', async () => {
    let finishCalls = 0;
    let providerCalls = 0;
    const harness = createHarness({
      events: Object.freeze({
        onFinish: async () => {
          finishCalls += 1;
        },
      }),
      sessionCreate: async () => {
        providerCalls += 1;
        return { status: 'logged-in' };
      },
    });
    harness.start();
    harness.run.detach();
    harness.receive({
      ...base,
      kind: 'request',
      id: 14,
      method: 'events.onFinish',
      params: [{ loginId: 'user@example.com', authType: AuthMethod.PASSKEY, source: 'mobile' }],
    });
    harness.receive({
      ...base,
      kind: 'request',
      id: 15,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    harness.receive({ ...base, kind: 'start-settled', status: 'completed' });
    harness.run.attach();
    await flush();

    assert.equal(finishCalls, 1);
    assert.equal(providerCalls, 0);
    assert.equal(
      harness.messages.some((frame) => frame.id === 15),
      false
    );
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('preserves a detached close when the Web start settles before reattach', async () => {
    let closeCalls = 0;
    const harness = createHarness({
      events: Object.freeze({
        onClose: async () => {
          closeCalls += 1;
        },
      }),
    });
    harness.start();
    harness.run.detach();
    harness.receive({ ...base, kind: 'request', id: 16, method: 'events.onClose', params: [] });
    harness.receive({ ...base, kind: 'start-settled', status: 'completed' });
    harness.run.attach();
    await flush();

    assert.equal(closeCalls, 1);
    assert.equal(
      harness.messages.some((frame) => frame.id === 16),
      false
    );
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('tears down immediately if the document fails while an invoked terminal callback is pending', async () => {
    let resolveClose: (() => void) | undefined;
    const close = new Promise<void>((resolve) => {
      resolveClose = resolve;
    });
    const pending = createHarness({ events: Object.freeze({ onClose: () => close }) });
    pending.start();
    pending.receive({ ...base, kind: 'request', id: 17, method: 'events.onClose', params: [] });
    pending.run.fail('Renderer stopped.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process');
    resolveClose?.();
    await flush();
    assert.equal(
      pending.messages.some((frame) => frame.id === 17),
      false
    );
    assert.deepEqual(pending.calls, ['focus', 'stop', 'settle']);
  });

  test('retains a detached close callback when the native document fails before reattach', async () => {
    let closeCalls = 0;
    const harness = createHarness({
      events: Object.freeze({
        onClose: async () => {
          closeCalls += 1;
        },
      }),
    });
    harness.start();
    harness.run.detach();
    harness.receive({ ...base, kind: 'request', id: 19, method: 'events.onClose', params: [] });
    harness.run.fail('Renderer stopped.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process');
    harness.run.attach();
    await flush();

    assert.equal(closeCalls, 1);
    assert.equal(
      harness.messages.some((frame) => frame.id === 19),
      false
    );
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('retains a detached close callback when the page fails before reattach', async () => {
    let closeCalls = 0;
    let providerCalls = 0;
    let resolveProvider: ((value: { status: 'logged-in' }) => void) | undefined;
    const provider = new Promise<{ status: 'logged-in' }>((resolve) => {
      resolveProvider = resolve;
    });
    const harness = createHarness({
      events: Object.freeze({
        onClose: async () => {
          closeCalls += 1;
        },
      }),
      sessionCreate: () => {
        providerCalls += 1;
        return provider;
      },
    });
    harness.start();
    harness.receive({
      ...base,
      kind: 'request',
      id: 190,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    harness.run.detach();
    harness.receive({
      ...base,
      kind: 'request',
      id: 189,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'queued@example.com', authType: AuthMethod.PASSKEY } }],
    });
    resolveProvider?.({ status: 'logged-in' });
    await flush();
    harness.receive({ ...base, kind: 'request', id: 191, method: 'events.onClose', params: [] });
    harness.receive({ ...base, kind: 'failure', phase: 'start', message: 'Page stopped.' });
    harness.run.attach();
    await flush();

    assert.equal(closeCalls, 1);
    assert.equal(providerCalls, 1);
    assert.equal(
      harness.messages.some((frame) => frame.id === 189 || frame.id === 190 || frame.id === 191),
      false
    );
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('settles immediately when the page fails during an invoked terminal callback', async () => {
    let resolveClose: (() => void) | undefined;
    const close = new Promise<void>((resolve) => {
      resolveClose = resolve;
    });
    const harness = createHarness({ events: Object.freeze({ onClose: () => close }) });
    harness.start();
    harness.receive({ ...base, kind: 'request', id: 192, method: 'events.onClose', params: [] });
    harness.receive({ ...base, kind: 'failure', phase: 'start', message: 'Page stopped.' });

    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
    resolveClose?.();
    await flush();
    assert.equal(
      harness.messages.some((frame) => frame.id === 192),
      false
    );
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('drops an earlier queued reply as soon as a detached close is received', async () => {
    let closeCalls = 0;
    let resolveProvider: ((value: { status: 'logged-in' }) => void) | undefined;
    const provider = new Promise<{ status: 'logged-in' }>((resolve) => {
      resolveProvider = resolve;
    });
    const harness = createHarness({
      events: Object.freeze({
        onClose: async () => {
          closeCalls += 1;
        },
      }),
      sessionCreate: () => provider,
    });
    harness.start();
    harness.receive({
      ...base,
      kind: 'request',
      id: 20,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    harness.run.detach();
    resolveProvider?.({ status: 'logged-in' });
    await flush();
    harness.receive({ ...base, kind: 'request', id: 21, method: 'events.onClose', params: [] });
    harness.run.attach();
    await flush();

    assert.equal(closeCalls, 1);
    assert.equal(
      harness.messages.some((frame) => frame.id === 20 || frame.id === 21),
      false
    );
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  test('detach queues an in-flight provider reply for reattach', async () => {
    let resolveProvider: ((value: { status: 'logged-in' }) => void) | undefined;
    const provider = new Promise<{ status: 'logged-in' }>((resolve) => {
      resolveProvider = resolve;
    });
    const harness = createHarness({ sessionCreate: () => provider });
    harness.start();
    harness.receive({
      ...base,
      kind: 'request',
      id: 12,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    harness.run.detach();
    resolveProvider?.({ status: 'logged-in' });
    await flush();
    assert.equal(
      harness.messages.some((frame) => frame.id === 12),
      false
    );

    harness.run.attach();
    assert.deepEqual(harness.messages.at(-1), { ...base, kind: 'response', id: 12, result: { status: 'logged-in' } });
  });

  test('reattach suppresses queued work when the instance became stale while detached', async () => {
    let resolveProvider: ((value: { status: 'logged-in' }) => void) | undefined;
    const provider = new Promise<{ status: 'logged-in' }>((resolve) => {
      resolveProvider = resolve;
    });
    const harness = createHarness({ sessionCreate: () => provider });
    harness.start();
    harness.receive({
      ...base,
      kind: 'request',
      id: 13,
      method: 'providers.session.create',
      params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } }],
    });
    harness.run.detach();
    resolveProvider?.({ status: 'logged-in' });
    await flush();
    harness.makeStale();
    harness.run.attach();
    assert.equal(
      harness.messages.some((frame) => frame.id === 13),
      false
    );
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });
});

describe('Elite internal diagnostics', () => {
  function captureLogs() {
    const logs: Array<{ level: OwnIDLogLevel; source: string; message: string; cause?: unknown }> = [];
    const logging: OwnIdLogRouter = {
      log(level, source, message, cause) {
        logs.push({ level, source, message, ...(cause === undefined ? {} : { cause }) });
      },
    };
    return { logs, logging };
  }

  test('records a terminal failure without a cause or application error callback exactly once', () => {
    const { logs, logging } = captureLogs();
    const harness = createHarness({ logging });
    harness.run.fail('Renderer stopped.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process');
    harness.run.fail('Renderer stopped again.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process');
    harness.run.receive('{');
    assert.deepEqual(logs, [{ level: OwnIDLogLevel.Error, source: 'OwnIDEliteView.process', message: 'Renderer stopped.' }]);
    assert.deepEqual(harness.calls, ['stop', 'settle']);
  });

  test('preserves recovery reason, source, and original local causes', () => {
    const { logs, logging } = captureLogs();
    const harness = createHarness({ logging });
    const cause = new Error('document load failed');
    harness.run.startupFailure('Hosted document could not load.', ErrorCode.NETWORK, 'OwnIDEliteView.load', cause);
    const nativeCause = { url: 'https://secret.example/token' };
    harness.run.startupFailure('Inline document could not load.', ErrorCode.NETWORK, 'OwnIDEliteView.load', nativeCause);
    assert.deepEqual(logs, [
      {
        level: OwnIDLogLevel.Warn,
        source: 'OwnIDEliteView.load',
        message: 'OwnID Elite HTTPS startup failed; loading inline content. Hosted document could not load.',
        cause,
      },
      { level: OwnIDLogLevel.Error, source: 'OwnIDEliteView.load', message: 'Inline document could not load.', cause: nativeCause },
    ]);
  });

  test('logs cause-free timeout recovery and terminal timeout without an error callback', () => {
    const { logs, logging } = captureLogs();
    const harness = createHarness({ logging });
    harness.timer.expire();
    assert.deepEqual(
      logs.map(({ level, source }) => ({ level, source })),
      [
        { level: OwnIDLogLevel.Warn, source: 'OwnIDEliteView.startup' },
        { level: OwnIDLogLevel.Error, source: 'OwnIDEliteView.startup' },
      ]
    );
  });

  test('records page loss during a pending terminal callback once and does not report an application error', async () => {
    const { logs, logging } = captureLogs();
    let finish: (() => void) | undefined;
    let errorCalls = 0;
    const harness = createHarness({
      logging,
      events: {
        onClose: () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
        onError: async () => {
          errorCalls += 1;
        },
      },
    });
    harness.start();
    harness.receive({ ...base, kind: 'request', id: 410, method: 'events.onClose', params: [] });
    harness.receive({ ...base, kind: 'failure', phase: 'start', message: 'Document unloaded.' });
    harness.receive({ ...base, kind: 'failure', phase: 'start', message: 'Document unloaded again.' });
    finish?.();
    await flush();
    assert.deepEqual(logs, [{ level: OwnIDLogLevel.Error, source: 'OwnIDEliteView.start', message: 'Document unloaded.' }]);
    assert.equal(errorCalls, 0);
    assert.deepEqual(harness.calls, ['focus', 'stop', 'settle']);
  });

  for (const source of ['Web.session', undefined]) {
    for (const withErrorCallback of [false, true]) {
      test(`page failure keeps ${source ?? 'phase source'} and public callback presence ${withErrorCallback}`, () => {
        const { logs, logging } = captureLogs();
        const errors: Array<[string, OwnIDEliteErrorDetails]> = [];
        const harness = createHarness({
          logging,
          events: withErrorCallback ? { onError: async (message, details) => void errors.push([message, details]) } : {},
        });
        harness.start();
        harness.receive({
          ...base,
          kind: 'failure',
          phase: 'start',
          message: 'Session unavailable.',
          ...(source === undefined ? {} : { details: { code: ErrorCode.FORBIDDEN, source, additionalDetails: 'retry later' } }),
        });
        harness.receive({ ...base, kind: 'failure', phase: 'start', message: 'Repeated failure.' });
        harness.run.fail('Late native failure.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process');
        harness.run.receive('{');
        const expectedSource = source ?? 'OwnIDEliteView.start';
        assert.deepEqual(logs, [
          {
            level: OwnIDLogLevel.Error,
            source: expectedSource,
            message: 'Session unavailable.',
            ...(source === undefined ? {} : { cause: { code: ErrorCode.FORBIDDEN } }),
          },
        ]);
        assert.deepEqual(
          errors,
          withErrorCallback
            ? [
                [
                  'Session unavailable.',
                  {
                    code: source === undefined ? ErrorCode.UNKNOWN : ErrorCode.FORBIDDEN,
                    source: expectedSource,
                    ...(source === undefined ? {} : { additionalDetails: 'retry later' }),
                    terminal: true,
                  },
                ],
              ]
            : []
        );
        assert.equal(harness.calls.filter((call) => call === 'settle').length, 1);
      });
    }
  }

  test('aborted runs ignore late failure callbacks and canceled timers without diagnostics or public errors', () => {
    const { logs, logging } = captureLogs();
    let errorCalls = 0;
    const harness = createHarness({ logging, events: { onError: async () => void errorCalls++ } });
    harness.abort();
    harness.run.startupFailure('Late load failure.', ErrorCode.NETWORK, 'OwnIDEliteView.load');
    harness.run.fail('Late process failure.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process');
    harness.receive({ ...base, kind: 'failure', phase: 'init', message: 'Late page failure.' });
    harness.timer.fireCanceled();
    assert.deepEqual(logs, []);
    assert.equal(errorCalls, 0);
    assert.deepEqual(harness.calls, ['stop', 'settle']);
  });
});
