import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { describe, test } from 'node:test';

import { createEliteDocument } from '../../../src/flows/elite/document';
// noinspection ES6PreferShortImport -- Keep Node tests independent of the React Native entry point.
import { AuthMethod } from '../../../src/models/authentication';
// noinspection ES6PreferShortImport -- Keep Node tests independent of the React Native entry point.
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

function createHarness(
  options: {
    focused?: boolean;
    language?: string;
    loginId?: string;
    execution?: 'bootstrap' | 'html';
    autoInstall?: boolean;
    url?: string;
    actualUrl?: string;
    secureContext?: boolean;
    pageGlobals?: Record<string, unknown>;
    bridge?: 'native' | 'webkit';
    warningSinkFailure?: boolean;
    configuration?: Parameters<typeof createEliteDocument>[0]['configuration'];
    namedMarker?: boolean;
    pageOwnId?: unknown;
    appendScriptError?: Error;
    navigator?: { languages?: unknown; language?: unknown };
  } = {}
) {
  const listeners = new Map<string, Listener[]>();
  const documentListeners = new Map<string, Listener[]>();
  const messages: Array<Record<string, unknown>> = [];
  const warnings: unknown[][] = [];
  const order: string[] = [];
  const documentReadyState: Array<{ scriptAppended: boolean; initializationQueued: boolean }> = [];
  let focused = options.focused ?? true;
  let focusError: Error | undefined;
  let scriptElement: Record<string, unknown> | undefined;
  let scriptHeadMarkup: string | undefined;
  let startResult: Promise<unknown> = new Promise(() => undefined);
  let startError: unknown;
  let bodyChildElementCount = 1;
  let replacements = 0;
  let initializations = 0;
  let loaderRemoved = false;
  let bodyObserver: (() => void) | undefined;

  const loadingElement = {
    remove() {
      if (loaderRemoved) return;
      loaderRemoved = true;
      bodyChildElementCount -= 1;
    },
  };
  const createBody = (innerHTML = '') => ({
    innerHTML,
    get childElementCount() {
      return bodyChildElementCount;
    },
  });
  const createHead = (innerHTML = '') => ({
    innerHTML,
    scripts: [] as Array<Record<string, unknown>>,
    appendChild(element: Record<string, unknown>) {
      assert.equal(this, document.head);
      this.scripts.push(element);
      scriptElement = element;
      scriptHeadMarkup = this.innerHTML;
      if (options.appendScriptError !== undefined) throw options.appendScriptError;
    },
  });
  const originalBody = createBody('<p>site-body</p>');
  const originalHead = createHead('<style>.site{color:red}</style>');
  class TestMutationObserver {
    constructor(private readonly callback: () => void) {}

    observe(target: unknown, options: unknown) {
      assert.equal(target, document.body);
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
    body: originalBody,
    head: originalHead,
    adoptedStyleSheets: [{ source: 'site' }],
    createElement(name: string) {
      if (name === 'head') return createHead();
      if (name === 'body') return createBody();
      assert.equal(name, 'script');
      return {};
    },
    documentElement: {
      attributes: [{ name: 'class' }, { name: 'style' }, { name: 'onload' }],
      lang: 'site-language',
      removeAttribute(name: string) {
        this.attributes = this.attributes.filter((attribute) => attribute.name !== name);
      },
      replaceChildren(head: ReturnType<typeof createHead>, body: ReturnType<typeof createBody>) {
        assert.notEqual(head, document.head);
        assert.notEqual(body, document.body);
        document.head = head;
        document.body = body;
        replacements += 1;
      },
    },
    getElementById(id: string) {
      assert.equal(id, 'ownid-loading');
      return document.body.innerHTML.includes('id="ownid-loading"') ? loadingElement : null;
    },
    hasFocus() {
      if (focusError !== undefined) throw focusError;
      return focused;
    },
    addEventListener: (name: string, listener: Listener) => add(documentListeners, name, listener),
    removeEventListener: (name: string, listener: Listener) => remove(documentListeners, name, listener),
  };
  const window = {
    document,
    location: { href: options.actualUrl ?? options.url ?? 'https://login.example.com/' },
    isSecureContext: options.secureContext ?? true,
    customElements: { get: () => undefined },
    navigator: options.navigator ?? { languages: ['fr-CA', 'en'], language: 'fr-CA' },
    crypto: {
      getRandomValues(bytes: Uint8Array) {
        for (let index = 0; index < bytes.length; index += 1) bytes[index] = index;
        return bytes;
      },
    },
    addEventListener: (name: string, listener: Listener) => add(listeners, name, listener),
    removeEventListener: (name: string, listener: Listener) => remove(listeners, name, listener),
  } as Record<string, unknown> & { ownid?: QueuedOwnID };

  const source = createEliteDocument({
    configuration: options.configuration ?? configuration,
    url: options.url ?? 'https://login.example.com/',
    ...(options.language === undefined ? {} : { language: options.language }),
    ...(options.loginId === undefined ? {} : { loginId: options.loginId }),
  });
  if (options.namedMarker) window.__ownidEliteInstalled = { siteElement: true };
  if (options.pageOwnId !== undefined) window.ownid = options.pageOwnId as QueuedOwnID;
  window._ownid_globalCss = { source: 'site' };
  const postMessage = (data: string) => {
    const frame = JSON.parse(data) as Record<string, unknown>;
    messages.push(frame);
    if (frame.kind === 'document-ready') {
      documentReadyState.push({
        scriptAppended: scriptElement !== undefined,
        initializationQueued: window.ownid?.q?.some((call) => call[1] === 'init') ?? false,
      });
    }
    order.push(String(frame.kind));
  };
  if (options.bridge === 'webkit') {
    window.webkit = { messageHandlers: { ReactNativeWebView: { postMessage } } };
  } else {
    window.ReactNativeWebView = { postMessage };
  }
  Object.assign(window, options.pageGlobals);
  const context = createContext({
    window,
    document,
    console: {
      warn(...args: unknown[]) {
        warnings.push(args);
        if (options.warningSinkFailure) throw new Error('Warning sink failed');
      },
    },
    AbortController,
    MutationObserver: TestMutationObserver,
    Uint8Array,
    URL,
  });
  let initCall: OwnIDCall | undefined;
  let initConfig: InitConfig | undefined;
  let whenReady: Promise<unknown> | undefined;
  const install = () => {
    let result: unknown;
    if (options.execution === 'html') {
      const script = /<script>([\s\S]*)<\/script>/.exec(source.html)?.[1];
      assert.ok(script);
      const head = /<head>([\s\S]*?)<\/head>/.exec(source.html)?.[1];
      const body = /<body>([\s\S]*?)<script>/.exec(source.html)?.[1];
      assert.ok(head);
      assert.ok(body);
      document.head.innerHTML = head;
      document.body.innerHTML = body;
      result = runInContext(script, context);
    } else {
      result = runInContext(source.installEliteScript, context);
      if (window.__ownidEliteInstalled !== true) return result;
    }
    if (initCall !== undefined) return result;
    const queue = window.ownid?.q;
    assert.ok(queue);
    assert.equal(queue.length, 1);
    initCall = queue[0];
    assert.ok(initCall);
    assert.equal(initCall[1], 'init');
    initializations += 1;
    initConfig = initCall[2] as InitConfig;
    window.testInitConfig = initConfig;
    whenReady = window.ownid?.whenReady;
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
    return result;
  };
  if (options.autoInstall !== false) install();

  const invoke = (path: string, args: unknown[]): Promise<unknown> => {
    window.testInput = JSON.stringify(args);
    return runInContext(`window.testInitConfig.${path}.apply(undefined, JSON.parse(window.testInput))`, context) as Promise<unknown>;
  };

  return {
    source,
    document,
    window,
    get initConfig() {
      assert.ok(initConfig);
      return initConfig;
    },
    originalHead,
    originalBody,
    install,
    get replacements() {
      return replacements;
    },
    get initializations() {
      return initializations;
    },
    messages,
    documentReadyState,
    warnings,
    order,
    get initPromise() {
      return whenReady;
    },
    reinstall() {
      return runInContext(source.installEliteScript, context) as unknown;
    },
    get scriptHeadMarkup() {
      return scriptHeadMarkup;
    },
    get scriptElement() {
      return scriptElement;
    },
    resolveInit(value: unknown = {}) {
      assert.ok(initCall);
      initCall[0].r(value);
      return flush();
    },
    rejectInit(error: unknown = new Error('init')) {
      assert.ok(initCall);
      initCall[0].j(error);
      return flush();
    },
    setStartResult(value: Promise<unknown>) {
      startResult = value;
    },
    setStartError(error: unknown) {
      startError = error;
    },
    setFocusError(error: Error) {
      focusError = error;
    },
    listenerCount() {
      return [...listeners.values(), ...documentListeners.values()].reduce((count, values) => count + values.length, 0);
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

function assertUntouchedRejectedPage(harness: ReturnType<typeof createHarness>): void {
  assert.equal(harness.document.head, harness.originalHead);
  assert.equal(harness.document.body, harness.originalBody);
  assert.equal(harness.document.head.innerHTML, '<style>.site{color:red}</style>');
  assert.equal(harness.document.body.innerHTML, '<p>site-body</p>');
  assert.equal(harness.document.documentElement.attributes.length, 3);
  assert.equal(harness.document.documentElement.lang, 'site-language');
  assert.deepEqual(harness.document.adoptedStyleSheets, [{ source: 'site' }]);
  assert.equal(harness.replacements, 0);
  assert.equal(harness.initializations, 0);
  assert.equal(harness.scriptElement, undefined);
  assert.equal(harness.listenerCount(), 0);
  assert.equal(harness.window.__ownidEliteInstalled, undefined);
  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0]?.kind, 'failure');
  assert.equal(harness.messages[0]?.phase, 'initialization');
}

function hostFrame(pageFrame: Record<string, unknown>, frame: Record<string, unknown>): Record<string, unknown> {
  return {
    channel: pageFrame.channel,
    version: pageFrame.version,
    documentMode: pageFrame.documentMode,
    documentToken: pageFrame.documentToken,
    ...frame,
  };
}

async function startHarness(harness: ReturnType<typeof createHarness>, initResult: unknown = {}): Promise<Record<string, unknown>> {
  await harness.resolveInit(initResult);
  const ready = harness.messages.find(({ kind }) => kind === 'ready');
  assert.ok(ready);
  harness.send(hostFrame(ready, { kind: 'start-permission', future: true }));
  return ready;
}

describe('Elite hosted document', () => {
  test('does not mistake a site DOM named property for a completed installation', async () => {
    const harness = createHarness({ namedMarker: true });
    assert.equal(harness.window.__ownidEliteInstalled, true);
    await harness.resolveInit();
    assert.deepEqual(
      harness.messages.map(({ kind }) => kind),
      ['document-ready', 'ready']
    );
  });
  test('takes over the HTTPS document once, removes site presentation, and waits before starting', async () => {
    const harness = createHarness({});
    assert.deepEqual(harness.document.documentElement.attributes, []);
    assert.equal(harness.document.documentElement.lang, 'fr-CA');
    assert.equal(harness.document.adoptedStyleSheets.length, 0);
    assert.equal(harness.window._ownid_globalCss, undefined);
    assert.notEqual(harness.document.head, harness.originalHead);
    assert.notEqual(harness.document.body, harness.originalBody);
    assert.doesNotMatch(harness.document.head.innerHTML, /\.site/);
    assert.doesNotMatch(harness.document.body.innerHTML, /site-body/);
    assert.match(harness.document.head.innerHTML, /<style>/);
    assert.equal(harness.document.head.scripts.length, 1);
    assert.equal(harness.originalHead.scripts.length, 0);
    assert.match(harness.document.body.innerHTML, /id="ownid-loading"/);
    assert.doesNotMatch(harness.document.body.innerHTML, /<script/);
    assert.equal(harness.window.location && (harness.window.location as { href: string }).href, 'https://login.example.com/');
    assert.equal(harness.reinstall(), true);
    assert.equal(harness.replacements, 1);
    assert.equal(harness.initializations, 1);
    assert.equal(harness.document.head.scripts.length, 1);
    assert.equal(harness.messages.length, 1);
    assert.equal(harness.messages[0]?.kind, 'document-ready');
    assert.deepEqual(harness.warnings, []);
    await harness.resolveInit();
    assert.deepEqual(
      harness.messages.map(({ kind }) => kind),
      ['document-ready', 'ready']
    );
    assert.equal(harness.window.startConfig, undefined);
    assert.equal(harness.reinstall(), true);
    assert.deepEqual(
      harness.messages.map(({ kind }) => kind),
      ['document-ready', 'ready']
    );
  });

  test('rejects an unexpected or insecure document before installing content or initializing the SDK', () => {
    for (const options of [{ actualUrl: 'https://login.example.com/other?x=1' }, { secureContext: false }]) {
      const harness = createHarness({ ...options, autoInstall: false });
      assert.equal(harness.install(), true);
      assertUntouchedRejectedPage(harness);
      assert.match(String(harness.messages[0]?.message), /loaded HTTPS document/);
    }
  });

  test('replaces inert page globals and starts with only its own initialization queue', async () => {
    const inertQueue = Object.assign(function () {}, { q: [['unrelated']] });
    for (const pageOwnId of [{ siteElement: true }, inertQueue]) {
      const harness = createHarness({ pageOwnId });
      assert.notEqual(harness.window.ownid, pageOwnId);
      assert.equal(harness.window._ownid_globalCss, undefined);
      await harness.resolveInit();
      assert.deepEqual(
        harness.messages.map(({ kind }) => kind),
        ['document-ready', 'ready']
      );
    }
    assert.deepEqual(inertQueue.q, [['unrelated']]);
  });

  test('warns about existing SDK markers while replacing the page and starting with a fresh configured SDK', async () => {
    for (const existing of [
      { ownid: { sdk: {} } },
      { ownid: { whenReady: Promise.resolve() } },
      { _ownid_initializing_sdk: true },
      { customElements: { get: () => function OwnIDRoot() {} } },
    ]) {
      const harness = createHarness({ autoInstall: false, pageGlobals: existing });
      const existingOwnId = harness.window.ownid;
      assert.equal(harness.install(), true);
      assert.notEqual(harness.window.ownid, existingOwnId);
      assert.notEqual(harness.document.head, harness.originalHead);
      assert.notEqual(harness.document.body, harness.originalBody);
      assert.doesNotMatch(harness.document.head.innerHTML, /site/);
      assert.doesNotMatch(harness.document.body.innerHTML, /site-body/);
      assert.equal(harness.replacements, 1);
      assert.equal(harness.initializations, 1);
      assert.equal(harness.scriptElement?.src, 'https://cdn.uat.ownid-eu.com/sdk/app123');
      assert.equal(harness.document.head.scripts.length, 1);
      assert.equal(harness.window._ownid_globalCss, undefined);
      assert.deepEqual(harness.warnings, [
        ['The bootstrap page contains an existing OwnID Web SDK, which may interfere with OwnID Elite.'],
      ]);
      assert.equal(harness.messages.length, 1);
      assert.equal(harness.messages[0]?.kind, 'document-ready');
      await harness.resolveInit();
      const ready = harness.messages.find(({ kind }) => kind === 'ready');
      assert.equal(ready?.kind, 'ready');
      assert.ok(ready);
      harness.send(hostFrame(ready, { kind: 'start-permission' }));
      await flush();
      assert.deepEqual(
        harness.messages.map(({ kind }) => kind),
        ['document-ready', 'ready', 'start-issued']
      );
      assert.ok(harness.window.startConfig);
      assert.equal(harness.reinstall(), true);
      assert.equal(harness.warnings.length, 1);
    }
  });

  test('continues normal readiness and start when the existing SDK console warning throws', async () => {
    const harness = createHarness({ pageGlobals: { ownid: { sdk: {} } }, warningSinkFailure: true });
    const ready = await startHarness(harness);
    await flush();
    assert.equal(ready.kind, 'ready');
    assert.deepEqual(
      harness.messages.map(({ kind }) => kind),
      ['document-ready', 'ready', 'start-issued']
    );
    assert.equal(harness.initializations, 1);
    assert.equal(harness.replacements, 1);
    assert.ok(harness.window.startConfig);
  });

  for (const execution of ['bootstrap', 'html'] as const) {
    test(`cleans up unexpected runtime failures with the established document token (${execution})`, async () => {
      const harness = createHarness({ execution, focused: false });
      await harness.resolveInit();
      const ready = harness.messages.find(({ kind }) => kind === 'ready');
      assert.ok(ready);
      harness.setFocusError(new Error('Focus unavailable'));
      harness.send(hostFrame(ready, { kind: 'start-permission' }));
      await flush();
      const failure = harness.messages.at(-1);
      assert.equal(failure?.kind, 'failure');
      assert.equal(failure?.phase, 'initialization');
      assert.equal(failure?.documentToken, ready.documentToken);
      assert.equal(harness.loaderRemoved, true);
      assert.equal(harness.listenerCount(), 0);
      assert.equal(harness.window.startConfig, undefined);
    });
  }

  for (const execution of ['bootstrap', 'html'] as const) {
    test(`cleans up unexpected runtime setup errors before readiness (${execution})`, async () => {
      const harness = createHarness({ execution, appendScriptError: new Error('Script insertion failed') });
      await flush();
      assert.equal(harness.messages.length, 2);
      assert.equal(harness.messages[0]?.kind, 'document-ready');
      assert.equal(harness.messages[1]?.kind, 'failure');
      assert.equal(harness.messages[1]?.documentToken, harness.messages[0]?.documentToken);
      assert.notEqual(harness.messages[1]?.documentToken, '00000000000000000000000000000000');
      assert.equal(harness.loaderRemoved, true);
      assert.equal(harness.listenerCount(), 0);
    });
  }

  test('loads the configured deployment CDN and installs the document policy before the SDK script', () => {
    const cases = [
      [{ appId: 'abc', env: 'prod', region: 'us' }, 'https://cdn.ownid.com/sdk/abc'],
      [{ appId: 'abc', env: 'uat', region: 'us' }, 'https://cdn.uat.ownid.com/sdk/abc'],
      [{ appId: 'abc', env: 'dev', region: 'eu' }, 'https://cdn.dev.ownid-eu.com/sdk/abc'],
    ] as const;
    for (const [configuration, cdnUrl] of cases) {
      const harness = createHarness({ configuration });
      assert.equal(harness.scriptElement?.src, cdnUrl);
      assert.ok(Object.isFrozen(harness.source));
      assert.equal(harness.source.url, 'https://login.example.com/');
      const policy = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(harness.scriptHeadMarkup ?? '')?.[1];
      assert.ok(policy);
      assert.deepEqual(
        Object.fromEntries(
          policy.split(';').map((directive) => {
            const [name, ...values] = directive.trim().split(/\s+/);
            return [name, values];
          })
        ),
        { 'frame-src': ['https:'], 'object-src': ["'none'"], 'base-uri': ["'none'"] }
      );
      assert.equal(harness.loaderRemoved, false);
      assert.equal(harness.document.head.scripts.length, 1);
    }
  });

  test('takes over the complete path and query URL while retaining its actual fragment', async () => {
    const url = 'https://login.example.com/auth/elite?tenant=demo&mode=login';
    const harness = createHarness({ url, actualUrl: url + '#current-step' });
    assert.equal(harness.source.url, url);
    assert.equal((harness.window.location as { href: string }).href, url + '#current-step');
    assert.equal(harness.replacements, 1);
    await harness.resolveInit();
    assert.equal(harness.messages.at(-1)?.kind, 'ready');
  });

  test('initializes using the iOS WebKit bridge when the normal bridge is absent', async () => {
    const harness = createHarness({ bridge: 'webkit' });
    assert.equal(typeof (harness.window.ReactNativeWebView as { postMessage: unknown }).postMessage, 'function');
    await harness.resolveInit();
    assert.equal(harness.messages.at(-1)?.kind, 'ready');
    assert.equal(harness.initializations, 1);
  });

  test('safely embeds input without allowing an extra script element', () => {
    // Deliberately malformed payload tests escaping, not HTML validity.
    // language=TEXT
    const loginId = '</script><img src=x>';
    // language=TEXT
    const language = '</script><script>attack()</script>\u2028\u2029';
    const source = createEliteDocument({
      configuration,
      url: 'https://login.example.com/',
      language,
      loginId,
    });

    assert.equal(source.html.match(/<script>/g)?.length, 1);
    assert.doesNotMatch(source.html, /<script>attack/);
    assert.doesNotMatch(source.html, /<img src=x>/);
    assert.match(source.html, /\\u003c\/script>/);
    assert.match(source.html, /\\u2028\\u2029/);
    const harness = createHarness({ language, loginId });
    assert.equal(harness.document.documentElement.lang, language);
    assert.equal((harness.initConfig as unknown as { language: string }).language, language);
    assert.doesNotMatch(harness.document.body.innerHTML, /<img src=x>|attack/);
  });

  for (const execution of ['bootstrap', 'html'] as const) {
    test(`queues one init Promise, awaits it, then requires permission and focus before start (${execution})`, async () => {
      const harness = createHarness({ execution, focused: false, language: 'de-DE', loginId: 'user@example.com' });
      assert.equal(typeof harness.initPromise?.then, 'function');
      assert.equal(harness.messages.length, 1);
      assert.equal(harness.messages[0]?.kind, 'document-ready');
      assert.equal(typeof harness.initConfig.events.onFinish, 'function');
      assert.equal((harness.initConfig as unknown as { language: string }).language, 'de-DE');

      await harness.resolveInit({ future: true });
      assert.deepEqual(
        harness.messages.map(({ kind }) => kind),
        ['document-ready', 'ready']
      );
      const ready = harness.messages.find(({ kind }) => kind === 'ready');
      assert.ok(ready);
      harness.send(hostFrame(ready, { kind: 'start-permission' }), 'document');
      assert.deepEqual(harness.order, ['document-ready', 'ready']);

      harness.setFocused(true);
      harness.emitWindow('focus');
      await flush();
      assert.deepEqual(Array.from(harness.order), ['document-ready', 'ready', 'start-issued', 'start-call']);
      harness.emitWindow('focus');
      assert.deepEqual(Array.from(harness.order), ['document-ready', 'ready', 'start-issued', 'start-call']);
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

      const aborted = createHarness({ execution, focused: false });
      await aborted.resolveInit();
      const abortedReady = aborted.messages.find(({ kind }) => kind === 'ready');
      assert.ok(abortedReady);
      aborted.send(hostFrame(abortedReady, { kind: 'abort' }));
      aborted.send(hostFrame(abortedReady, { kind: 'start-permission' }));
      aborted.setFocused(true);
      aborted.emitWindow('focus');
      await flush();
      assert.deepEqual(
        aborted.messages.map(({ kind }) => kind),
        ['document-ready', 'ready']
      );
      assert.equal(aborted.window.startConfig, undefined);
    });
  }

  test('uses the same resolved language for the document and Elite initialization', () => {
    for (const [options, language] of [
      [{ language: 'de-DE' }, 'de-DE'],
      [{}, 'fr-CA'],
      [{ navigator: { language: 'uk-UA' } }, 'uk-UA'],
      [{ navigator: {} }, 'en'],
    ] as const) {
      const harness = createHarness(options);
      assert.equal(harness.document.documentElement.lang, language);
      assert.equal((harness.initConfig as unknown as { language: string }).language, language);
    }
  });

  test('keeps standalone HTML initialization and locale consistent with the injected bootstrap', async () => {
    for (const execution of ['html', 'bootstrap'] as const) {
      const harness = createHarness({ execution, language: 'uk-UA' });
      assert.equal(harness.initializations, 1);
      assert.equal(harness.document.documentElement.lang, 'uk-UA');
      assert.equal((harness.initConfig as unknown as { language: string }).language, 'uk-UA');
      assert.equal(harness.scriptElement?.src, 'https://cdn.uat.ownid-eu.com/sdk/app123');
      await harness.resolveInit();
      assert.deepEqual(
        harness.messages.map(({ kind }) => kind),
        ['document-ready', 'ready']
      );
      assert.equal(harness.window.startConfig, undefined);
    }
  });

  test('acknowledges document readiness once before SDK initialization or CDN loading in both representations', async () => {
    for (const execution of ['bootstrap', 'html'] as const) {
      const harness = createHarness({ execution, focused: false });
      assert.deepEqual(
        harness.messages.map(({ kind }) => kind),
        ['document-ready']
      );
      assert.deepEqual(harness.documentReadyState, [{ scriptAppended: false, initializationQueued: false }]);
      assert.equal(harness.messages[0]?.documentMode, execution === 'html' ? 'inline' : 'https');
      assert.match(String(harness.messages[0]?.documentToken), /^[0-9a-f]{32}$/);
      assert.equal(harness.replacements, execution === 'html' ? 0 : 1);
      assert.equal(harness.scriptElement?.src, 'https://cdn.uat.ownid-eu.com/sdk/app123');
      await harness.resolveInit();
      assert.deepEqual(
        harness.messages.map(({ kind }) => kind),
        ['document-ready', 'ready']
      );
      assert.equal(harness.messages[1]?.documentToken, harness.messages[0]?.documentToken);
      assert.equal(harness.window.startConfig, undefined);
      if (execution === 'bootstrap') {
        harness.reinstall();
        assert.equal(harness.documentReadyState.length, 1);
      }
    }
  });

  test('retains the supplied security origin and port for inline HTML', () => {
    const source = createEliteDocument({ configuration, url: 'https://Login.Example.com:8443/Elite?x=1' });
    assert.equal(source.baseUrl, 'https://login.example.com:8443/');
  });

  test('inline startup reports early readiness without requiring the primary document secure-context preflight', async () => {
    const harness = createHarness({ execution: 'html', secureContext: false, language: 'uk-UA' });
    assert.equal(harness.replacements, 0);
    assert.equal(harness.initializations, 1);
    await harness.resolveInit();
    assert.equal(harness.messages.at(-1)?.kind, 'ready');
    assert.equal(harness.messages[0]?.documentMode, 'inline');
    assert.equal(harness.window.startConfig, undefined);
    assert.equal(harness.document.documentElement.lang, 'uk-UA');
  });

  test('ignores obsolete host permissions, aborts and callback responses even when their document token matches', async () => {
    const harness = createHarness({ execution: 'html' });
    await harness.resolveInit();
    const ready = harness.messages.find(({ kind }) => kind === 'ready');
    assert.ok(ready);
    harness.send(hostFrame(ready, { kind: 'start-permission', documentMode: 'https' }));
    harness.send(hostFrame(ready, { kind: 'abort', documentMode: 'https' }));
    await flush();
    assert.equal(harness.window.startConfig, undefined);
    assert.ok(harness.listenerCount() > 0);

    harness.send(hostFrame(ready, { kind: 'start-permission' }));
    await flush();
    assert.equal(harness.messages[2]?.kind, 'start-issued');
    assert.equal(harness.messages[2]?.documentMode, 'inline');
    let resolved = false;
    const callback = harness.callClose().then(() => {
      resolved = true;
    });
    const request = harness.messages.at(-1);
    assert.equal(request?.kind, 'request');
    harness.send(hostFrame(ready, { kind: 'response', id: request?.id, documentMode: 'https' }));
    await flush();
    assert.equal(resolved, false);
    harness.send(hostFrame(ready, { kind: 'response', id: request?.id }));
    await callback;
    assert.equal(resolved, true);
    harness.send(hostFrame(ready, { kind: 'abort' }));
  });

  test('retains document mode on primary installation failure and inline SDK startup failure', async () => {
    const primary = createHarness({ actualUrl: 'https://other.example.com/' });
    assert.equal(primary.messages[0]?.documentMode, 'https');
    const fallback = createHarness({ execution: 'html' });
    await fallback.rejectInit();
    assert.equal(fallback.messages.at(-1)?.kind, 'failure');
    assert.equal(fallback.messages.at(-1)?.phase, 'initialization');
    assert.equal(fallback.messages.at(-1)?.documentMode, 'inline');
  });

  for (const execution of ['bootstrap', 'html'] as const) {
    test(`accepts additive start results and reports script, initialization, and start errors (${execution})`, async () => {
      const scriptFailure = createHarness({ execution });
      (scriptFailure.scriptElement?.onerror as (() => void) | undefined)?.();
      assert.equal(scriptFailure.loaderRemoved, true);
      assert.equal(scriptFailure.loaderObserverActive, false);
      assert.deepEqual(
        scriptFailure.messages.map(({ kind, phase }) => [kind, phase]),
        [
          ['document-ready', undefined],
          ['failure', 'script-load'],
        ]
      );

      const initFailure = createHarness({ execution });
      await initFailure.resolveInit({ error: 'Bad configuration', future: true });
      assert.deepEqual(
        initFailure.messages.map(({ kind, phase }) => [kind, phase]),
        [
          ['document-ready', undefined],
          ['failure', 'initialization'],
        ]
      );

      const invalidInit = createHarness({ execution });
      await invalidInit.resolveInit([]);
      assert.deepEqual(
        invalidInit.messages.map(({ kind, phase }) => [kind, phase]),
        [
          ['document-ready', undefined],
          ['failure', 'initialization'],
        ]
      );

      const rejectedInit = createHarness({ execution });
      await rejectedInit.rejectInit();
      assert.deepEqual(
        rejectedInit.messages.map(({ kind, phase }) => [kind, phase]),
        [
          ['document-ready', undefined],
          ['failure', 'initialization'],
        ]
      );

      const singleRead = createHarness({ execution });
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
      assert.equal(singleRead.messages.at(-1)?.kind, 'ready');

      const startFailure = createHarness({ execution });
      startFailure.setStartResult(Promise.resolve({ error: 42 }));
      await startHarness(startFailure);
      await flush();
      assert.equal(startFailure.loaderRemoved, true);
      assert.equal(startFailure.loaderObserverActive, false);
      assert.deepEqual(
        startFailure.messages.map(({ kind, phase }) => [kind, phase]),
        [
          ['document-ready', undefined],
          ['ready', undefined],
          ['start-issued', undefined],
          ['failure', 'start'],
        ]
      );

      const completed = createHarness({ execution });
      completed.setStartResult(Promise.resolve({ future: true }));
      await startHarness(completed);
      await flush();
      assert.equal(completed.loaderRemoved, true);
      assert.equal(completed.loaderObserverActive, false);
      assert.deepEqual(
        completed.messages.map(({ kind }) => kind),
        ['document-ready', 'ready', 'start-issued', 'start-settled']
      );
    });
  }

  for (const execution of ['bootstrap', 'html'] as const) {
    test(`forwards finish arguments before normal start settlement can clean up the page (${execution})`, async () => {
      const harness = createHarness({ execution });
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
        ['document-ready', 'ready', 'start-issued', 'request', 'start-settled']
      );
      await finishRejection;
      assert.equal((harness.window.startConfig as { abortSignal: AbortSignal }).abortSignal.aborted, true);
    });
  }

  for (const execution of ['bootstrap', 'html'] as const) {
    test(`keeps the page active when a finish response arrives before normal start settlement (${execution})`, async () => {
      const harness = createHarness({ execution });
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
        ['document-ready', 'ready', 'start-issued', 'request']
      );
      assert.equal((harness.window.startConfig as { abortSignal: AbortSignal }).abortSignal.aborted, false);

      resolveStart({});
      await flush();
      assert.deepEqual(
        harness.messages.map(({ kind }) => kind),
        ['document-ready', 'ready', 'start-issued', 'request', 'start-settled']
      );
      assert.equal((harness.window.startConfig as { abortSignal: AbortSignal }).abortSignal.aborted, true);
      harness.send(hostFrame(ready, { kind: 'start-permission' }));
    });
  }

  for (const execution of ['bootstrap', 'html'] as const) {
    test(`forwards close arguments and preserves a delivered host rejection without ending the page (${execution})`, async () => {
      const harness = createHarness({ execution });
      const ready = await startHarness(harness);

      const close = harness.callClose('future-argument');
      const closeRequest = harness.messages.at(-1);
      assert.ok(closeRequest);
      assert.deepEqual(closeRequest.params, ['future-argument']);
      harness.send(hostFrame(closeRequest, { kind: 'response', id: closeRequest.id, error: { message: 'handler failed' } }));

      await assert.rejects(close, /handler failed/);
      assert.deepEqual(
        harness.messages.map(({ kind }) => kind),
        ['document-ready', 'ready', 'start-issued', 'request']
      );
      assert.equal((harness.window.startConfig as { abortSignal: AbortSignal }).abortSignal.aborted, false);
      harness.send(hostFrame(ready, { kind: 'abort' }));
    });
  }

  for (const execution of ['bootstrap', 'html'] as const) {
    test(`posts a close request before a normal start failure tears down pending work (${execution})`, async () => {
      const harness = createHarness({ execution });
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
          ['document-ready', undefined],
          ['ready', undefined],
          ['start-issued', undefined],
          ['request', undefined],
          ['failure', 'start'],
        ]
      );
      await closeRejection;
    });
  }

  for (const execution of ['bootstrap', 'html'] as const) {
    test(`bridges live event acknowledgements and opaque session results over both delivery targets (${execution})`, async () => {
      const harness = createHarness({ execution });
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
  }

  for (const execution of ['bootstrap', 'html'] as const) {
    test(`uses ordinary JSON serialization while rejecting explicit lossy values and teardown pending work (${execution})`, async () => {
      const harness = createHarness({ execution });
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
        documentMode: harness.messages[0]?.documentMode,
        documentToken: harness.messages[0]?.documentToken,
        kind: 'failure',
        phase: 'start',
        message: 'OwnID Elite document was unloaded.',
      });
      const frameCount = harness.messages.length;
      harness.emitWindow('pagehide');
      assert.equal(harness.messages.length, frameCount);
    });
  }
});
