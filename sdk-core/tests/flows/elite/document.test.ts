import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { describe, test } from 'node:test';

import { createEliteDocument } from '../../../src/flows/elite/document';
import { AuthMethod } from '../../../src/models/authentication';
import { ErrorCode } from '../../../src/models/error';

type Listener = (event: { data?: unknown }) => void;
type QueueResolver = { r: (value: unknown) => void; j: (error: unknown) => void; _isResolvers: true };
type OwnIDCall = [QueueResolver, string, unknown?];
type InitConfig = {
  onError: (message: string, details?: unknown) => void;
  events: {
    onFinish: (...args: unknown[]) => Promise<unknown>;
    onError: (...args: unknown[]) => Promise<unknown>;
    onClose: (...args: unknown[]) => Promise<unknown>;
  };
  providers: { session: { create: (...args: unknown[]) => Promise<unknown> } };
};
type QueuedOwnID = ((method: string, config?: unknown) => Promise<unknown>) & { q?: OwnIDCall[]; whenReady?: Promise<unknown> };

const configuration = { appId: 'app123', env: 'uat', region: 'eu' } as const;

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function createHarness(options: { focused?: boolean; language?: string; loginId?: string } = {}) {
  const listeners = new Map<string, Listener[]>();
  const documentListeners = new Map<string, Listener[]>();
  const messages: Array<Record<string, unknown>> = [];
  const order: string[] = [];
  let focused = options.focused ?? true;
  let scriptElement: Record<string, unknown> | undefined;
  let startResult: Promise<unknown> = new Promise(() => undefined);
  let startError: unknown;
  let bodyChildElementCount = 2;
  let loaderRemoved = false;
  let bodyObserver: (() => void) | undefined;

  const loadingElement = {
    remove() {
      if (loaderRemoved) return;
      loaderRemoved = true;
      bodyChildElementCount -= 1;
    },
  };
  const body = {
    get childElementCount() {
      return bodyChildElementCount;
    },
  };
  class TestMutationObserver {
    constructor(private readonly callback: () => void) {}

    observe(target: unknown, options: unknown) {
      assert.equal(target, body);
      assert.equal((options as { childList?: unknown }).childList, true);
      bodyObserver = this.callback;
    }

    disconnect() {
      if (bodyObserver === this.callback) bodyObserver = undefined;
    }
  }

  const add = (target: Map<string, Listener[]>, name: string, listener: Listener) => {
    target.set(name, [...(target.get(name) ?? []), listener]);
  };
  const remove = (target: Map<string, Listener[]>, name: string, listener: Listener) => {
    target.set(
      name,
      (target.get(name) ?? []).filter((candidate) => candidate !== listener)
    );
  };
  const emit = (target: Map<string, Listener[]>, name: string, event: { data?: unknown } = {}) => {
    for (const listener of [...(target.get(name) ?? [])]) listener(event);
  };

  const document = {
    body,
    head: {
      appendChild(element: Record<string, unknown>) {
        scriptElement = element;
      },
    },
    createElement(name: string) {
      assert.equal(name, 'script');
      return {};
    },
    getElementById(id: string) {
      assert.equal(id, 'ownid-loading');
      return loadingElement;
    },
    hasFocus: () => focused,
    addEventListener: (name: string, listener: Listener) => add(documentListeners, name, listener),
    removeEventListener: (name: string, listener: Listener) => remove(documentListeners, name, listener),
  };
  const window = {
    document,
    navigator: { languages: ['fr-CA', 'en'], language: 'fr-CA' },
    crypto: {
      getRandomValues(bytes: Uint8Array) {
        for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;
        return bytes;
      },
    },
    ReactNativeWebView: {
      postMessage(data: string) {
        const frame = JSON.parse(data) as Record<string, unknown>;
        messages.push(frame);
        order.push(String(frame.kind));
      },
    },
    addEventListener: (name: string, listener: Listener) => add(listeners, name, listener),
    removeEventListener: (name: string, listener: Listener) => remove(listeners, name, listener),
  } as Record<string, unknown> & { ownid?: QueuedOwnID };

  const source = createEliteDocument({
    configuration,
    origin: 'https://login.example.com',
    ...(options.language === undefined ? {} : { language: options.language }),
    ...(options.loginId === undefined ? {} : { loginId: options.loginId }),
  });
  const script = /<script>([\s\S]*)<\/script>/.exec(source.html)?.[1];
  assert.ok(script);
  const context = createContext({
    window,
    document,
    AbortController,
    MutationObserver: TestMutationObserver,
    Uint8Array,
  });
  runInContext(script, context);

  const queue = window.ownid?.q;
  assert.ok(queue);
  assert.equal(queue.length, 1);
  const initCall = queue[0];
  assert.ok(initCall);
  assert.equal(initCall[1], 'init');
  const initConfig = initCall[2] as InitConfig;
  window.testInitConfig = initConfig;

  const whenReady = window.ownid?.whenReady;
  window.ownid = Object.assign(
    (method: string, config?: unknown) => {
      assert.equal(method, 'start');
      order.push('start-call');
      window.startConfig = config;
      if (startError !== undefined) throw startError;
      return startResult;
    },
    { whenReady }
  );

  const invoke = (path: string, args: unknown[]): Promise<unknown> => {
    window.testInput = JSON.stringify(args);
    return runInContext(`window.testInitConfig.${path}.apply(undefined, JSON.parse(window.testInput))`, context) as Promise<unknown>;
  };

  return {
    source,
    window,
    initConfig,
    messages,
    order,
    initPromise: whenReady,
    get scriptElement() {
      return scriptElement;
    },
    resolveInit(value: unknown = {}) {
      initCall[0].r(value);
      return flush();
    },
    rejectInit(error: unknown = new Error('init')) {
      initCall[0].j(error);
      return flush();
    },
    setStartResult(value: Promise<unknown>) {
      startResult = value;
    },
    setStartError(error: unknown) {
      startError = error;
    },
    setFocused(value: boolean) {
      focused = value;
    },
    get loaderRemoved() {
      return loaderRemoved;
    },
    get loaderObserverActive() {
      return bodyObserver !== undefined;
    },
    changeBodyChildCount(change: number) {
      bodyChildElementCount += change;
      bodyObserver?.();
    },
    emitWindow(name: string, event: { data?: unknown } = {}) {
      emit(listeners, name, event);
    },
    send(frame: Record<string, unknown>, target: 'window' | 'document' = 'window') {
      emit(target === 'window' ? listeners : documentListeners, 'message', { data: JSON.stringify(frame) });
    },
    callFinish(params: Record<string, unknown>, ...extra: unknown[]) {
      return invoke('events.onFinish', [params, ...extra]);
    },
    callError(message: string, details: Record<string, unknown>, ...extra: unknown[]) {
      return invoke('events.onError', [message, details, ...extra]);
    },
    callClose(...args: unknown[]) {
      return invoke('events.onClose', args);
    },
    callSession(payload: Record<string, unknown>, addUndefined = false, ...extra: unknown[]) {
      window.testInput = JSON.stringify([payload, ...extra]);
      window.testAddUndefined = addUndefined;
      return runInContext(
        '(function(args) { if (window.testAddUndefined) args[0].optional = undefined; return window.testInitConfig.providers.session.create.apply(undefined, args); })(JSON.parse(window.testInput))',
        context
      ) as Promise<unknown>;
    },
    callSessionExpression(expression: string) {
      return runInContext(`window.testInitConfig.providers.session.create(${expression})`, context) as Promise<unknown>;
    },
  };
}

function hostFrame(pageFrame: Record<string, unknown>, frame: Record<string, unknown>): Record<string, unknown> {
  return {
    channel: pageFrame.channel,
    version: pageFrame.version,
    documentToken: pageFrame.documentToken,
    ...frame,
  };
}

async function startHarness(harness: ReturnType<typeof createHarness>, initResult: unknown = {}): Promise<Record<string, unknown>> {
  await harness.resolveInit(initResult);
  const ready = harness.messages[0];
  assert.ok(ready);
  harness.send(hostFrame(ready, { kind: 'start-permission', future: true }));
  return ready;
}

describe('Elite hosted document', () => {
  test('builds immutable sources with the deployment CDN and only the required frame restrictions', () => {
    const cases = [
      [{ appId: 'abc', env: 'prod', region: 'us' }, 'https://cdn.ownid.com/sdk/abc'],
      [{ appId: 'abc', env: 'uat', region: 'us' }, 'https://cdn.uat.ownid.com/sdk/abc'],
      [{ appId: 'abc', env: 'dev', region: 'eu' }, 'https://cdn.dev.ownid-eu.com/sdk/abc'],
    ] as const;

    for (const [runtimeConfiguration, cdnUrl] of cases) {
      const source = createEliteDocument({ configuration: runtimeConfiguration, origin: 'https://login.example.com' });
      assert.equal(source.baseUrl, 'https://login.example.com');
      assert.ok(Object.isFrozen(source));
      assert.match(source.html, new RegExp(cdnUrl.replaceAll('.', '\\.')));
    }

    const html = createEliteDocument({ configuration, origin: 'https://login.example.com' }).html;
    const contentSecurityPolicy = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
    assert.ok(contentSecurityPolicy);
    const directives = Object.fromEntries(
      contentSecurityPolicy.split(';').map((directive) => {
        const [name, ...values] = directive.trim().split(/\s+/);
        assert.ok(name);
        return [name, values];
      })
    );
    assert.deepEqual(directives, {
      'frame-src': ['https:'],
      'object-src': ["'none'"],
      'base-uri': ["'none'"],
    });
    assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script>'));
    assert.match(html, /id="ownid-loading" aria-hidden="true"/);
    assert.match(html, /width:40px;height:40px/);
    assert.ok(html.indexOf('id="ownid-loading"') < html.indexOf('<script>'));
    assert.doesNotMatch(html, /default-src|script-src|style-src|img-src/);
    assert.doesNotMatch(html, /__ownidNativeBridge|OWNID_NATIVE_WEBVIEW|registrations|passkeys\.peek|providers\.social/);
  });

  test('safely embeds input without allowing an extra script element', () => {
    const source = createEliteDocument({
      configuration,
      origin: 'https://login.example.com',
      language: '</script><script>attack()</script>\u2028\u2029',
      loginId: '</script><img src=x>',
    });

    assert.equal(source.html.match(/<script>/g)?.length, 1);
    assert.doesNotMatch(source.html, /<script>attack/);
    assert.doesNotMatch(source.html, /<img src=x>/);
    assert.match(source.html, /\\u003c\/script>/);
    assert.match(source.html, /\\u2028\\u2029/);
  });

  test('queues one init Promise, awaits it, then requires permission and focus before start', async () => {
    const harness = createHarness({ focused: false, language: 'de-DE', loginId: 'user@example.com' });
    assert.equal(typeof harness.initPromise?.then, 'function');
    assert.equal(harness.messages.length, 0);
    assert.equal(typeof harness.initConfig.events.onFinish, 'function');
    assert.equal((harness.initConfig as unknown as { language: string }).language, 'de-DE');

    await harness.resolveInit({ future: true });
    assert.deepEqual(
      harness.messages.map(({ kind }) => kind),
      ['ready']
    );
    const ready = harness.messages[0];
    assert.ok(ready);
    harness.send(hostFrame(ready, { kind: 'start-permission' }), 'document');
    assert.deepEqual(harness.order, ['ready']);

    harness.setFocused(true);
    harness.emitWindow('focus');
    await flush();
    assert.deepEqual(Array.from(harness.order), ['ready', 'start-issued', 'start-call']);
    harness.emitWindow('focus');
    assert.deepEqual(Array.from(harness.order), ['ready', 'start-issued', 'start-call']);
    const startConfig = harness.window.startConfig as { loginId: string; abortSignal: AbortSignal; animation: boolean };
    assert.equal(startConfig.loginId, 'user@example.com');
    assert.equal(startConfig.abortSignal.aborted, false);
    assert.equal(startConfig.animation, false);
    assert.equal(harness.loaderRemoved, false);
    assert.equal(harness.loaderObserverActive, true);

    harness.changeBodyChildCount(-1);
    assert.equal(harness.loaderRemoved, false);
    harness.changeBodyChildCount(1);
    assert.equal(harness.loaderRemoved, false);
    harness.changeBodyChildCount(1);
    assert.equal(harness.loaderRemoved, true);
    assert.equal(harness.loaderObserverActive, false);
    harness.changeBodyChildCount(1);
    assert.equal(harness.loaderRemoved, true);

    const aborted = createHarness({ focused: false });
    await aborted.resolveInit();
    const abortedReady = aborted.messages[0];
    assert.ok(abortedReady);
    aborted.send(hostFrame(abortedReady, { kind: 'abort' }));
    aborted.send(hostFrame(abortedReady, { kind: 'start-permission' }));
    aborted.setFocused(true);
    aborted.emitWindow('focus');
    await flush();
    assert.deepEqual(
      aborted.messages.map(({ kind }) => kind),
      ['ready']
    );
    assert.equal(aborted.window.startConfig, undefined);
  });

  test('uses the browser first language when no root override is supplied', () => {
    const harness = createHarness();
    assert.equal((harness.initConfig as unknown as { language: string }).language, 'fr-CA');
  });

  test('accepts additive start results and reports script, initialization, and start errors', async () => {
    const scriptFailure = createHarness();
    (scriptFailure.scriptElement?.onerror as (() => void) | undefined)?.();
    assert.equal(scriptFailure.loaderRemoved, true);
    assert.equal(scriptFailure.loaderObserverActive, false);
    assert.deepEqual(
      scriptFailure.messages.map(({ kind, phase }) => [kind, phase]),
      [['failure', 'script-load']]
    );

    const initFailure = createHarness();
    await initFailure.resolveInit({ error: 'Bad configuration', future: true });
    assert.deepEqual(
      initFailure.messages.map(({ kind, phase }) => [kind, phase]),
      [['failure', 'initialization']]
    );

    const invalidInit = createHarness();
    await invalidInit.resolveInit([]);
    assert.deepEqual(
      invalidInit.messages.map(({ kind, phase }) => [kind, phase]),
      [['failure', 'initialization']]
    );

    const rejectedInit = createHarness();
    await rejectedInit.rejectInit();
    assert.deepEqual(
      rejectedInit.messages.map(({ kind, phase }) => [kind, phase]),
      [['failure', 'initialization']]
    );

    const singleRead = createHarness();
    let errorReads = 0;
    const additiveInitResult = Object.defineProperty({ future: true }, 'error', {
      enumerable: true,
      get() {
        errorReads += 1;
        return undefined;
      },
    });
    await singleRead.resolveInit(additiveInitResult);
    assert.equal(errorReads, 1);
    assert.equal(singleRead.messages[0]?.kind, 'ready');

    const startFailure = createHarness();
    startFailure.setStartResult(Promise.resolve({ error: 42 }));
    await startHarness(startFailure);
    await flush();
    assert.equal(startFailure.loaderRemoved, true);
    assert.equal(startFailure.loaderObserverActive, false);
    assert.deepEqual(
      startFailure.messages.map(({ kind, phase }) => [kind, phase]),
      [
        ['ready', undefined],
        ['start-issued', undefined],
        ['failure', 'start'],
      ]
    );

    const completed = createHarness();
    completed.setStartResult(Promise.resolve({ future: true }));
    await startHarness(completed);
    await flush();
    assert.equal(completed.loaderRemoved, true);
    assert.equal(completed.loaderObserverActive, false);
    assert.deepEqual(
      completed.messages.map(({ kind }) => kind),
      ['ready', 'start-issued', 'start-settled']
    );
  });

  test('forwards finish arguments before normal start settlement can clean up the page', async () => {
    const harness = createHarness();
    let resolveStart: (result: unknown) => void = () => undefined;
    harness.setStartResult(new Promise((resolve) => (resolveStart = resolve)));
    await startHarness(harness);

    const finish = harness.callFinish(
      {
        loginId: 'user@example.com',
        authType: AuthMethod.PASSKEY,
        source: 'mobile',
        context: 'not-public',
        future: true,
      },
      'future-argument'
    );
    const finishRequest = harness.messages.at(-1);
    assert.ok(finishRequest);
    assert.deepEqual(finishRequest.params, [
      {
        loginId: 'user@example.com',
        authType: AuthMethod.PASSKEY,
        source: 'mobile',
        context: 'not-public',
        future: true,
      },
      'future-argument',
    ]);

    const finishRejection = assert.rejects(finish, /document stopped/);
    resolveStart({});
    await flush();
    assert.deepEqual(
      harness.messages.map(({ kind }) => kind),
      ['ready', 'start-issued', 'request', 'start-settled']
    );
    await finishRejection;
    assert.equal((harness.window.startConfig as { abortSignal: AbortSignal }).abortSignal.aborted, true);
  });

  test('keeps the page active when a finish response arrives before normal start settlement', async () => {
    const harness = createHarness();
    let resolveStart: (result: unknown) => void = () => undefined;
    harness.setStartResult(new Promise((resolve) => (resolveStart = resolve)));
    const ready = await startHarness(harness);

    const finish = harness.callFinish({ loginId: 'user@example.com', authType: AuthMethod.PASSKEY, source: 'mobile' });
    const finishRequest = harness.messages.at(-1);
    assert.ok(finishRequest);

    harness.send(hostFrame(finishRequest, { kind: 'response', id: finishRequest.id, future: true }), 'document');
    await finish;
    assert.deepEqual(
      harness.messages.map(({ kind }) => kind),
      ['ready', 'start-issued', 'request']
    );
    assert.equal((harness.window.startConfig as { abortSignal: AbortSignal }).abortSignal.aborted, false);

    resolveStart({});
    await flush();
    assert.deepEqual(
      harness.messages.map(({ kind }) => kind),
      ['ready', 'start-issued', 'request', 'start-settled']
    );
    assert.equal((harness.window.startConfig as { abortSignal: AbortSignal }).abortSignal.aborted, true);
    harness.send(hostFrame(ready, { kind: 'start-permission' }));
  });

  test('forwards close arguments and preserves a delivered host rejection without ending the page', async () => {
    const harness = createHarness();
    const ready = await startHarness(harness);

    const close = harness.callClose('future-argument');
    const closeRequest = harness.messages.at(-1);
    assert.ok(closeRequest);
    assert.deepEqual(closeRequest.params, ['future-argument']);
    harness.send(hostFrame(closeRequest, { kind: 'response', id: closeRequest.id, error: { message: 'handler failed' } }));

    await assert.rejects(close, /handler failed/);
    assert.deepEqual(
      harness.messages.map(({ kind }) => kind),
      ['ready', 'start-issued', 'request']
    );
    assert.equal((harness.window.startConfig as { abortSignal: AbortSignal }).abortSignal.aborted, false);
    harness.send(hostFrame(ready, { kind: 'abort' }));
  });

  test('posts a close request before a normal start failure tears down pending work', async () => {
    const harness = createHarness();
    let rejectStart: (error: unknown) => void = () => undefined;
    harness.setStartResult(new Promise((_, reject) => (rejectStart = reject)));
    await startHarness(harness);

    const close = harness.callClose();
    const closeRejection = assert.rejects(close, /document stopped/);
    rejectStart(new Error('start failed after close'));
    await flush();
    assert.deepEqual(
      harness.messages.map(({ kind, phase }) => [kind, phase]),
      [
        ['ready', undefined],
        ['start-issued', undefined],
        ['request', undefined],
        ['failure', 'start'],
      ]
    );
    await closeRejection;
  });

  test('bridges live event acknowledgements and opaque session results over both delivery targets', async () => {
    const harness = createHarness();
    const ready = await startHarness(harness);

    const error = harness.callError('Try again', { code: ErrorCode.NETWORK, source: 'Web' }, 'future-argument');
    const errorRequest = harness.messages.at(-1);
    assert.ok(errorRequest);
    assert.deepEqual(errorRequest.params, ['Try again', { code: ErrorCode.NETWORK, source: 'Web' }, 'future-argument']);
    const acknowledgement = { future: true };
    harness.send(hostFrame(errorRequest, { kind: 'response', id: errorRequest.id, result: acknowledgement }), 'document');
    assert.equal(JSON.stringify(await error), JSON.stringify(acknowledgement));

    const malformed = harness.callError('Try again', { code: ErrorCode.NETWORK, source: 'Web' });
    const malformedRequest = harness.messages.at(-1);
    assert.ok(malformedRequest);
    harness.send(
      hostFrame(malformedRequest, {
        kind: 'response',
        id: malformedRequest.id,
        result: { future: true },
        error: { message: 'handler failed' },
      })
    );
    await assert.rejects(malformed, /Invalid OwnID Elite response/);

    const session = harness.callSession(
      {
        metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY },
        nullable: null,
      },
      true,
      'future-argument'
    );
    const sessionRequest = harness.messages.at(-1);
    assert.ok(sessionRequest);
    assert.equal(Object.prototype.hasOwnProperty.call((sessionRequest.params as Array<Record<string, unknown>>)[0], 'optional'), false);
    assert.equal((sessionRequest.params as unknown[])[1], 'future-argument');
    const result = { status: 'logged-in', result: { persisted: true }, future: true };
    harness.send(hostFrame(sessionRequest, { kind: 'response', id: sessionRequest.id, result, future: true }));
    assert.equal(JSON.stringify(await session), JSON.stringify(result));

    harness.send(hostFrame(ready, { kind: 'abort' }));
  });

  test('uses ordinary JSON serialization while rejecting explicit lossy values and teardown pending work', async () => {
    const harness = createHarness();
    await startHarness(harness);

    const supported = harness.callSessionExpression(
      "({ metadata: { loginId: 'user@example.com', authType: 'passkey' }, date: new Date('2026-01-02T03:04:05.000Z'), negativeZero: -0, values: Object.assign([1], { extra: true }), optional: undefined })"
    );
    const supportedRequest = harness.messages.at(-1);
    assert.ok(supportedRequest);
    assert.deepEqual((supportedRequest.params as Array<Record<string, unknown>>)[0], {
      metadata: { loginId: 'user@example.com', authType: 'passkey' },
      date: '2026-01-02T03:04:05.000Z',
      negativeZero: 0,
      values: [1],
    });
    harness.send(hostFrame(supportedRequest, { kind: 'response', id: supportedRequest.id, result: { status: 'success' } }));
    await supported;

    await assert.rejects(
      harness.callSessionExpression("({ metadata: { loginId: 'user@example.com', authType: 'passkey' }, unsupported: function() {} })"),
      /JSON-compatible/
    );
    await assert.rejects(
      harness.callSessionExpression("({ metadata: { loginId: 'user@example.com', authType: 'passkey' }, values: Array(2) })"),
      /JSON-compatible/
    );

    const pending = harness.callClose();
    harness.emitWindow('pagehide');
    await assert.rejects(pending, /document stopped/);
    assert.deepEqual(harness.messages.at(-1), {
      channel: harness.messages[0]?.channel,
      version: harness.messages[0]?.version,
      documentToken: harness.messages[0]?.documentToken,
      kind: 'failure',
      phase: 'start',
      message: 'OwnID Elite document was unloaded.',
    });
    const frameCount = harness.messages.length;
    harness.emitWindow('pagehide');
    assert.equal(harness.messages.length, frameCount);
  });
});
