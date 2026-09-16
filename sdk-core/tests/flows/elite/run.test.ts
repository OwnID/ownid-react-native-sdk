import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { RuntimeConfigurationToken, RuntimeLanguageProviderToken } from '../../../src/configuration/runtime';
import { ContextToken } from '../../../src/context';
import { Container } from '../../../src/di';
import type { OwnIDEliteErrorDetails, OwnIDEliteEvents, OwnIDEliteFinishParams } from '../../../src/flows/elite/events';
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
import { OwnIDLogLevel } from '../../../src/logging';
import { LoggingService, LoggingServiceToken } from '../../../src/logging/internal';
import { AuthMethod } from '../../../src/models/authentication';
import type { LoginPayload } from '../../../src/models/authentication';
import { ErrorCode } from '../../../src/models/error';
import { createNamespaceBinding } from '../../../src/namespace/scoping';
import { prepareProviders, SessionCreateProviderToken } from '../../../src/providers/internal';

const token = '00112233445566778899aabbccddeeff';
const otherToken = 'ffeeddccbbaa99887766554433221100';
const base = { channel: ELITE_PROTOCOL_CHANNEL, version: ELITE_PROTOCOL_VERSION, documentToken: token } as const;

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function createClock() {
  const callbacks = new Map<number, () => void>();
  let nextId = 0;
  let time = 0;
  const clock: EliteRunClock = {
    now: () => time,
    setTimeout(callback, delay) {
      assert.equal(delay, 15_000);
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    },
    clearTimeout(handle) {
      callbacks.delete(handle as number);
    },
  };
  return {
    clock,
    expire() {
      time += 15_000;
      for (const callback of [...callbacks.values()]) callback();
    },
    advance(duration: number) {
      time += duration;
    },
    get pending() {
      return callbacks.size;
    },
  };
}

function createHarness(overrides: Partial<EliteLaunchSnapshot> = {}) {
  const abortController = new AbortController();
  const messages: Array<Record<string, unknown>> = [];
  const calls: string[] = [];
  let current = true;
  let failNextPost = false;
  const snapshot: EliteLaunchSnapshot = {
    source: Object.freeze({ html: '<html></html>', baseUrl: 'https://webview.ownid.com' }),
    binding: createNamespaceBinding(Container.createRoot('test'), abortController.signal, () => current),
    events: Object.freeze({}),
    sessionCreate: async () => ({ status: 'logged-in' }),
    logging: new LoggingService(),
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
    },
    stopLoading() {
      calls.push('stop');
    },
    settle() {
      calls.push('settle');
    },
  };
  const timer = createClock();
  const run = createEliteRun(snapshot, port, timer.clock);
  run.attach();

  return {
    run,
    messages,
    calls,
    timer,
    abort: () => abortController.abort(),
    makeStale: () => {
      current = false;
    },
    failNextPost: () => {
      failNextPost = true;
    },
    receive(frame: Record<string, unknown>) {
      run.receive(JSON.stringify(frame));
    },
    start() {
      run.loaded();
      run.receive(JSON.stringify({ ...base, kind: 'ready' }));
      run.receive(JSON.stringify({ ...base, kind: 'start-issued' }));
    },
  };
}

describe('Elite launch preparation', () => {
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
    scope.registerValue(LoggingServiceToken, new LoggingService());
    scope.registerValue(SessionCreateProviderToken, prepareProviders({ session: { create: inherited } }).sessionCreate!);
    const binding = createNamespaceBinding(scope, abortController.signal, () => true);
    const namespace = createEliteNamespace(binding);
    const onClose = async () => undefined;
    const events = prepareEliteEvents({ onClose });

    const launch = prepareEliteLaunch(namespace, { origin: 'HTTPS://LOGIN.EXAMPLE.COM:0443/' }, events, {
      session: { create: override },
    });

    assert.equal(Object.isFrozen(launch), true);
    assert.equal(launch.events.onClose, onClose);
    assert.equal(launch.sessionCreate, override);
    assert.deepEqual(await launch.sessionCreate({ metadata: { loginId: 'a', authType: AuthMethod.PASSKEY } }), {
      status: 'logged-in',
      result: 'override',
    });
    assert.equal(launch.source.baseUrl, 'https://login.example.com');
    assert.match(launch.source.html, /"language":"uk-UA"/);
    assert.match(launch.source.html, /"loginId":"user@example.com"/);
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
    scope.registerValue(LoggingServiceToken, new LoggingService());
    const namespace = createEliteNamespace(createNamespaceBinding(scope, new AbortController().signal, () => true));
    assert.throws(() => prepareEliteLaunch(namespace, undefined, prepared, undefined), MissingEliteSessionProviderError);
  });

  test('rejects a namespace invalidated by a provider getter before resolving dependencies', () => {
    const scope = Container.createRoot('root');
    const abortController = new AbortController();
    scope.registerValue(RuntimeConfigurationToken, Object.freeze({ appId: 'App123', env: 'prod', region: 'us' }));
    scope.registerValue(RuntimeLanguageProviderToken, Object.freeze({ snapshot: () => null }));
    scope.registerValue(LoggingServiceToken, new LoggingService());
    const namespace = createEliteNamespace(createNamespaceBinding(scope, abortController.signal, () => !abortController.signal.aborted));
    const providers = {
      get session() {
        abortController.abort();
        return { create: async () => ({ status: 'logged-in' as const }) };
      },
    };

    assert.throws(() => prepareEliteLaunch(namespace, undefined, EMPTY_EVENTS, providers), /no longer active/);
  });
});

const EMPTY_EVENTS: OwnIDEliteEvents = Object.freeze({});

describe('Elite run controller', () => {
  test('waits for load and ready in either order, focuses once, and ends the deadline at start-issued', () => {
    const harness = createHarness();
    harness.receive({ ...base, kind: 'ready' });
    assert.deepEqual(harness.messages, []);
    harness.run.loaded();
    assert.deepEqual(harness.calls, ['focus']);
    assert.deepEqual(harness.messages, [{ ...base, kind: 'start-permission' }]);
    harness.run.loaded();
    assert.equal(harness.messages.length, 1);
    assert.equal(harness.timer.pending, 1);
    harness.receive({ ...base, kind: 'start-issued' });
    assert.equal(harness.timer.pending, 0);
  });

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
    harness.receive({ ...base, kind: 'ready' });
    assert.deepEqual(harness.calls, ['stop', 'settle']);

    const started = createHarness();
    started.start();
    started.timer.expire();
    assert.deepEqual(started.calls, ['focus']);
  });

  test('stops the run when start permission cannot reach the hosted document', () => {
    const errors: Array<readonly [string, OwnIDEliteErrorDetails]> = [];
    const harness = createHarness({
      events: Object.freeze({
        onError: async (message: string, details: OwnIDEliteErrorDetails) => void errors.push([message, details]),
      }),
    });

    harness.run.loaded();
    harness.failNextPost();
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
    const logging = new LoggingService();
    logging.configure({ level: OwnIDLogLevel.Error, onLog: () => invalidate() });
    const harness = createHarness({
      logging,
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
    const logging = new LoggingService();
    logging.configure({ level: OwnIDLogLevel.Error, onLog: () => reportAnotherFailure() });
    const harness = createHarness({ logging });
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
    const logging = new LoggingService();
    logging.configure({ level: OwnIDLogLevel.Error, onLog: () => invalidate() });
    let errorCalls = 0;
    const harness = createHarness({
      logging,
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
    expired.timer.advance(15_000);
    expired.run.attach();
    assert.deepEqual(expired.calls, ['stop', 'settle']);
  });

  test('does not accept a detached start-issued frame after the absolute startup deadline', () => {
    const errors: OwnIDEliteErrorDetails[] = [];
    const harness = createHarness({
      events: Object.freeze({
        onError: async (_message: string, details: OwnIDEliteErrorDetails) => void errors.push(details),
      }),
    });
    harness.run.loaded();
    harness.receive({ ...base, kind: 'ready' });
    harness.run.detach();
    harness.timer.advance(15_000);
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
