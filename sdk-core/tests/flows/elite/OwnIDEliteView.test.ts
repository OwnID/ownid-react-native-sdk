import '../../reactNativePlatform';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, describe, test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import { RuntimeConfigurationToken, RuntimeLanguageProviderToken } from '../../../src/configuration/runtime';
import { Container } from '../../../src/di';
import type { OwnIDEliteErrorDetails, OwnIDEliteFinishParams, OwnIDEliteViewProps } from '../../../src';
import { createEliteNamespace } from '../../../src/flows/elite/namespace';
import { ELITE_PROTOCOL_CHANNEL, ELITE_PROTOCOL_VERSION } from '../../../src/flows/elite/protocol';
import { createEliteRun, type EliteRunClock } from '../../../src/flows/elite/run';
import { OwnIdLogger } from '../../../src/logging/OwnIdLogger';
import { OwnIdLogRouterImpl } from '../../../src/logging/impl/OwnIdLogRouterImpl';
import { OwnIDLogLevel, OwnIdLoggerDiToken, OwnIdLogRouterDiToken } from '../../../src/logging';
import type { OwnIDLogEntry } from '../../../src/logging';
// noinspection ES6PreferShortImport -- Keep Node tests independent of the React Native entry point.
import { AuthMethod } from '../../../src/models/authentication';
// noinspection ES6PreferShortImport -- Keep Node tests independent of the React Native entry point.
import { ErrorCode } from '../../../src/models/error';
import { createNamespaceBinding } from '../../../src/namespace/scoping';

const url = 'https://login.example.com/Account/Elite?x=1';
const origin = 'https://login.example.com';
const base = {
  channel: ELITE_PROTOCOL_CHANNEL,
  version: ELITE_PROTOCOL_VERSION,
  documentMode: 'https',
  documentToken: '00112233445566778899aabbccddeeff',
};
const payload = { metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY } };
const sourceFile = fileURLToPath(new URL('../../../src/flows/elite/OwnIDEliteView.tsx', import.meta.url));
const sourceRequire = createRequire(sourceFile);
const adapterCode = ts.transpileModule(readFileSync(sourceFile, 'utf8'), {
  fileName: sourceFile,
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

type NativeEvent = { nativeEvent: { url: string; data?: string } };
type WebViewNode = {
  type: string;
  key: string | null;
  props: {
    ref(webView: unknown): void;
    source: { uri?: string; html?: string; baseUrl?: string };
    key?: number;
    javaScriptEnabled: boolean;
    style: Array<false | { opacity?: number }>;
    onLoadStart(event: NativeEvent): void;
    onLoad(event: NativeEvent): void;
    onMessage(event: NativeEvent): void;
    onError(event: NativeEvent): void;
    onHttpError(event: NativeEvent): void;
    onRenderProcessGone(event: NativeEvent): void;
    onContentProcessDidTerminate(event: NativeEvent): void;
    onOpenWindow(event: NativeEvent): void;
    onShouldStartLoadWithRequest(request: { url: string; isTopFrame: boolean }): boolean;
  };
};
type Tree = { type: string; props: { children?: [WebViewNode, false | { type: string }] } };

// This small driver verifies the actual JS adapter with real launch/controller/URL/protocol logic.
// Hook and native doubles do not reproduce React effect/StrictMode or native WebView scheduling.
function createHarness(overrides: Partial<OwnIDEliteViewProps> = {}, platform: 'android' | 'ios' | 'windows' = 'android') {
  const refs: Array<{ current: unknown }> = [];
  const states: unknown[] = [];
  let refCursor = 0;
  let stateCursor = 0;
  let effect: (() => (() => void) | undefined) | undefined;
  let cleanup: (() => void) | undefined;
  const hooks = {
    useRef(initial: unknown) {
      const index = refCursor++;
      let slot = refs[index];
      if (slot === undefined) {
        slot = { current: initial };
        refs[index] = slot;
      }
      return slot;
    },
    useState(initial: unknown) {
      const index = stateCursor++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (update: unknown) => {
          states[index] = typeof update === 'function' ? update(states[index]) : update;
        },
      ];
    },
    useLayoutEffect(callback: () => (() => void) | undefined) {
      effect ??= callback;
    },
  };
  const clock: EliteRunClock = { now: () => 0, setTimeout: () => 1, clearTimeout: () => undefined };
  const moduleOutput = { exports: {} as { OwnIDEliteView(props: OwnIDEliteViewProps): Tree } };
  runInNewContext(
    adapterCode,
    {
      module: moduleOutput,
      exports: moduleOutput.exports,
      // Imported launch code and the adapter share one exception realm in React Native.
      Error,
      TypeError,
      require(name: string) {
        if (name === 'react') return hooks;
        if (name === 'react-native') {
          return {
            View: 'View',
            Platform: { select: (paths: Record<string, string>) => paths[platform] ?? paths.default },
            ActivityIndicator: 'ActivityIndicator',
            StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
          };
        }
        if (name === 'react-native-webview') return { WebView: 'WebView' };
        if (name === './nativeWebView') return { webAuthenticationNativeConfig: undefined };
        if (name === './run') {
          return {
            ...sourceRequire(name),
            createEliteRun: (...args: Parameters<typeof createEliteRun>) => createEliteRun(args[0], args[1], clock),
          };
        }
        return sourceRequire(name);
      },
    },
    { filename: sourceFile }
  );
  const scope = Container.createRoot('adapter-test');
  scope.registerValue(RuntimeConfigurationToken, Object.freeze({ appId: 'App123', env: 'prod', region: 'us' }));
  scope.registerValue(RuntimeLanguageProviderToken, { snapshot: () => null });
  const localLogger = new OwnIdLogger();
  const logs: OwnIDLogEntry[] = [];
  scope.registerValue(OwnIdLoggerDiToken, localLogger);
  scope.registerValue(
    OwnIdLogRouterDiToken,
    new OwnIdLogRouterImpl(
      () => localLogger,
      () => undefined
    )
  );
  const abortController = new AbortController();
  const binding = createNamespaceBinding(scope, abortController.signal, () => !abortController.signal.aborted);
  const errors: Array<{ message: string; code: ErrorCode }> = [];
  const providerCalls: unknown[] = [];
  let props: OwnIDEliteViewProps = {
    namespace: createEliteNamespace(binding),
    options: { origin: url },
    events: { onError: async (message, details) => void errors.push({ message, code: details.code }) },
    providers: {
      session: {
        create: async (value) => {
          providerCalls.push(value);
          return { status: 'logged-in' };
        },
      },
    },
    ...overrides,
  };
  const actions: string[] = [];
  const injections: string[] = [];
  const messages: Array<Record<string, unknown>> = [];
  const native = {
    injectJavaScript(script: string) {
      actions.push('inject');
      injections.push(script);
      harness.onInject?.();
      if (harness.failInjection) throw new Error('injection failed');
      actions.push('injected');
    },
    postMessage(message: string) {
      const frame = JSON.parse(message) as Record<string, unknown>;
      messages.push(frame);
      actions.push(`post:${String(frame.kind)}`);
    },
    requestFocus() {
      actions.push('focus');
    },
    stopLoading() {
      actions.push('stop');
      harness.onStop?.();
    },
  };
  let webView: WebViewNode;
  function render(nextProps = props): Tree {
    props = nextProps;
    refCursor = stateCursor = 0;
    const tree = moduleOutput.exports.OwnIDEliteView(props);
    if (tree.props.children !== undefined) {
      webView = tree.props.children[0];
      webView.props.ref(native);
    }
    return tree;
  }
  const harness = {
    errors,
    logs,
    captureLogs() {
      localLogger.configure({ level: OwnIDLogLevel.Verbose, onLog: (entry) => logs.push(entry) });
    },
    providerCalls,
    actions,
    injections,
    messages,
    failInjection: false,
    onStop: undefined as (() => void) | undefined,
    onInject: undefined as (() => void) | undefined,
    render,
    get props() {
      return props;
    },
    get webView() {
      return webView;
    },
    detach() {
      cleanup?.();
    },
    attach() {
      cleanup = effect?.();
    },
    load(actualUrl = webView.props.source.baseUrl ?? webView.props.source.uri ?? url, withStart = true) {
      if (withStart) webView.props.onLoadStart({ nativeEvent: { url: actualUrl } });
      webView.props.onLoad({ nativeEvent: { url: actualUrl } });
    },
    message(frame: Record<string, unknown>, actualUrl = origin) {
      webView.props.onMessage({
        nativeEvent: {
          url: actualUrl,
          data: JSON.stringify({ ...base, documentMode: webView.props.source.html === undefined ? 'https' : 'inline', ...frame }),
        },
      });
    },
    start() {
      harness.load();
      harness.message({ kind: 'document-ready' });
      harness.message({ kind: 'ready' });
      harness.message({ kind: 'start-issued' });
    },
    removed() {
      return render().props.children === undefined;
    },
  };
  render();
  harness.attach();
  render();
  cleanupRuns.push(() => {
    abortController.abort();
    harness.detach();
  });
  return harness;
}

const cleanupRuns: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanupRuns.splice(0)) cleanup();
});

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('OwnIDEliteView JS adapter', () => {
  test('selects the platform document only for an origin or root without a query', () => {
    for (const platform of ['android', 'ios', 'windows'] as const) {
      const defaultPath = platform === 'ios' ? '/.well-known/apple-app-site-association' : '/.well-known/assetlinks.json';
      const cases = [
        ['https://Login.Example.com:8443', `${origin}:8443${defaultPath}`],
        ['https://Login.Example.com:8443/', `${origin}:8443${defaultPath}`],
        ['https://Login.Example.com:443/', `${origin}${defaultPath}`],
        ['https://Login.Example.com:8443/Elite', `${origin}:8443/Elite`],
        ['https://Login.Example.com:8443?tenant=demo', `${origin}:8443/?tenant=demo`],
        ['https://Login.Example.com:8443/?', `${origin}:8443/?`],
      ] as const;
      for (const [input, expected] of cases) {
        const h = createHarness({ options: { origin: input } }, platform);
        assert.equal(h.webView.props.source.uri, expected, `${platform}: ${input}`);
        assert.equal(h.webView.props.source.html, undefined);
        assert.equal(h.errors.length, 0);
      }
    }
  });

  test('reports preparation failures once without mounting a native child or throwing from render', () => {
    for (const [overrides, code] of [
      [{ options: { origin: 'http://login.example.com' } }, ErrorCode.INVALID_ARGUMENT],
      [{ providers: {} }, ErrorCode.MISSING_CAPABILITY_PROVIDER],
    ] as const) {
      const errors: Array<[string, OwnIDEliteErrorDetails]> = [];
      const h = createHarness({
        ...overrides,
        events: { onError: async (message, details) => void errors.push([message, details]) },
      });
      h.attach();
      assert.equal(h.removed(), true);
      assert.equal(errors.length, 1);
      assert.ok(errors[0]?.[0]);
      assert.deepEqual({ ...errors[0]?.[1] }, { code, source: 'OwnIDEliteView.prepare', terminal: true });
      assert.deepEqual(h.actions, []);
      assert.deepEqual(h.messages, []);
    }
  });

  test('completes an inline run with a session result, live error acknowledgment and deferred finish', async () => {
    const providerPayloads: unknown[] = [];
    const errors: Array<[string, OwnIDEliteErrorDetails]> = [];
    const finished: OwnIDEliteFinishParams[] = [];
    let resolveFinish = (): void => undefined;
    const finishPending = new Promise<void>((resolve) => {
      resolveFinish = resolve;
    });
    const h = createHarness({
      providers: {
        session: {
          create: async (value) => {
            providerPayloads.push(value);
            return { status: 'logged-in', result: { persisted: true } };
          },
        },
      },
      events: {
        onError: async (message, details) => void errors.push([message, details]),
        onFinish: (params) => {
          finished.push(params);
          return finishPending;
        },
      },
    });
    h.webView.props.onError({ nativeEvent: { url } });
    h.render();
    const inlineToken = 'ffeeddccbbaa99887766554433221100';
    h.load();
    h.message({ documentToken: inlineToken, kind: 'document-ready' });
    h.message({ documentToken: inlineToken, kind: 'ready' });
    h.message({ documentToken: inlineToken, kind: 'start-issued' });
    assert.equal(h.webView.key, 'inline');
    assert.equal(h.webView.props.source.baseUrl, `${origin}/`);
    assert.equal(h.render().props.children?.[1], false);
    assert.deepEqual(errors, []);
    const inlineBase = { ...base, documentMode: 'inline', documentToken: inlineToken };
    h.message({ documentToken: inlineToken, kind: 'request', id: 1, method: 'providers.session.create', params: [payload] });
    await flush();
    assert.deepEqual(providerPayloads, [payload]);
    assert.deepEqual(h.messages.at(-1), {
      ...inlineBase,
      kind: 'response',
      id: 1,
      result: { status: 'logged-in', result: { persisted: true } },
    });
    h.message({
      documentToken: inlineToken,
      kind: 'request',
      id: 2,
      method: 'events.onError',
      params: ['Try again', { code: ErrorCode.NETWORK, source: 'Web.session', additionalDetails: 'retry', terminal: true }],
    });
    await flush();
    assert.deepEqual(errors, [
      [
        'Try again',
        {
          code: ErrorCode.NETWORK,
          source: 'Web.session',
          additionalDetails: 'retry',
          terminal: false,
        },
      ],
    ]);
    assert.deepEqual(h.messages.at(-1), { ...inlineBase, kind: 'response', id: 2 });
    const finish = { loginId: 'user@example.com', authType: AuthMethod.PASSKEY, source: 'mobile', authToken: 'token' };
    h.message({
      documentToken: inlineToken,
      kind: 'request',
      id: 3,
      method: 'events.onFinish',
      params: [{ ...finish, context: { browserOnly: true } }],
    });
    h.message({ documentToken: inlineToken, kind: 'start-settled', status: 'completed' });
    h.message({ documentToken: inlineToken, kind: 'request', id: 4, method: 'providers.session.create', params: [payload] });
    await flush();
    assert.deepEqual(finished, [finish]);
    assert.equal(h.removed(), false);
    assert.equal(
      h.messages.some((frame) => frame.id === 3 || frame.id === 4),
      false
    );
    assert.equal(providerPayloads.length, 1);
    resolveFinish();
    await flush();
    assert.deepEqual(h.messages.at(-1), { ...inlineBase, kind: 'response', id: 3 });
    assert.equal(h.removed(), true);
    assert.equal(errors.length, 1);
    assert.equal(h.actions.filter((action) => action === 'focus').length, 1);
    assert.equal(h.injections.length, 0);
  });

  test('waits for an inline close callback to settle, including rejection, before clearing the View', async () => {
    for (const rejects of [false, true]) {
      let closeCalls = 0;
      let settleClose = (): void => undefined;
      const close = new Promise<void>((resolve, reject) => {
        settleClose = rejects ? () => reject(new Error('close callback failed')) : resolve;
      });
      const errors: unknown[] = [];
      const h = createHarness({
        events: {
          onError: async (message, details) => void errors.push([message, details]),
          onClose: () => {
            closeCalls++;
            return close;
          },
        },
      });
      h.webView.props.onHttpError({ nativeEvent: { url } });
      h.render();
      h.start();
      h.message({ kind: 'request', id: 1, method: 'events.onClose', params: [] });
      await flush();
      assert.equal(closeCalls, 1);
      assert.equal(h.removed(), false);
      assert.equal(
        h.messages.some((frame) => frame.id === 1),
        false
      );
      settleClose();
      await flush();
      assert.deepEqual(h.messages.at(-1), {
        ...base,
        documentMode: 'inline',
        kind: 'response',
        id: 1,
        ...(rejects ? { error: { message: 'OwnID Elite application callback failed.' } } : {}),
      });
      assert.equal(h.removed(), true);
      assert.deepEqual(errors, []);
    }
  });

  test('recovers a synthetic load finish followed by native error and ignores every obsolete callback', async () => {
    const h = createHarness();
    h.captureLogs();
    const primary = h.webView;
    h.load();
    h.onStop = () => primary.props.onError({ nativeEvent: { url } });
    const cause = { url };
    primary.props.onError({ nativeEvent: cause });
    h.render();
    const inline = h.webView;
    assert.notEqual(inline.key, primary.key);
    assert.equal(inline.props.source.baseUrl, `${origin}/`);
    assert.equal(h.errors.length, 0);
    for (const handler of [
      'onError',
      'onHttpError',
      'onRenderProcessGone',
      'onContentProcessDidTerminate',
      'onOpenWindow',
      'onLoad',
      'onLoadStart',
    ] as const) {
      primary.props[handler]({ nativeEvent: { url } });
    }
    primary.props.ref(null);
    assert.equal(primary.props.onShouldStartLoadWithRequest({ url: 'https://other.example.com/', isTopFrame: true }), false);
    primary.props.onMessage({ nativeEvent: { url: origin, data: JSON.stringify({ ...base, kind: 'ready' }) } });
    h.message({ documentMode: 'https', kind: 'document-ready' });
    h.message({ documentMode: 'https', kind: 'ready' });
    assert.deepEqual(
      h.logs.map(({ level, source, cause: loggedCause }) => ({ level, source, cause: loggedCause })),
      [{ level: OwnIDLogLevel.Warn, source: 'OwnIDEliteView.load', cause }]
    );
    const spinner = h.render().props.children?.[1];
    assert.ok(spinner);
    assert.equal(spinner.type, 'ActivityIndicator');
    assert.equal(h.messages.length, 0);
    const inlineToken = 'ffeeddccbbaa99887766554433221100';
    h.message({ documentToken: inlineToken, kind: 'document-ready' });
    h.message({ documentToken: inlineToken, kind: 'ready' });
    assert.equal(h.messages.length, 0);
    h.load();
    assert.equal(h.messages.at(-1)?.kind, 'start-permission');
    assert.equal(h.messages.at(-1)?.documentToken, inlineToken);
    h.message({ documentToken: inlineToken, kind: 'start-issued' });
    h.message({ documentToken: inlineToken, kind: 'request', id: 1, method: 'providers.session.create', params: [payload] });
    h.message({ documentToken: inlineToken, kind: 'request', id: 1, method: 'providers.session.create', params: [payload] });
    await flush();
    assert.deepEqual(h.providerCalls, [payload]);
    assert.equal(h.messages.filter((frame) => frame.kind === 'start-permission').length, 1);
    assert.equal(h.injections.length, 1);
    assert.equal(h.errors.length, 0);
  });

  test('an obsolete injection exception cannot fail the replacement document', () => {
    const h = createHarness();
    const primary = h.webView;
    h.onInject = () => primary.props.onError({ nativeEvent: { url } });
    h.failInjection = true;
    h.load();
    h.render();
    assert.equal(h.errors.length, 0);
    assert.equal(h.webView.props.source.baseUrl, `${origin}/`);
    h.load();
    h.message({ kind: 'document-ready' });
    h.message({ kind: 'ready' });
    assert.equal(h.messages.at(-1)?.kind, 'start-permission');
    assert.equal(h.messages.at(-1)?.documentMode, 'inline');
  });

  test('reports one final inline loading error after an immediate initial redirect fallback', () => {
    const h = createHarness({ options: { origin: 'https://sub.example.com:8443/' } });
    assert.equal(h.webView.props.source.uri, 'https://sub.example.com:8443/.well-known/assetlinks.json');
    h.webView.props.onShouldStartLoadWithRequest({ url: 'https://other.example.com/', isTopFrame: true });
    h.render();
    assert.equal(h.webView.props.source.baseUrl, 'https://sub.example.com:8443/');
    assert.equal(h.errors.length, 0);
    h.webView.props.onError({ nativeEvent: { url: 'https://sub.example.com:8443/' } });
    h.webView.props.onError({ nativeEvent: { url: 'https://sub.example.com:8443/' } });
    assert.equal(h.errors.length, 1);
    assert.equal(h.removed(), true);
  });

  test('native failures after permission do not replace the document even before start-issued', () => {
    const h = createHarness();
    h.load();
    h.message({ kind: 'document-ready' });
    h.message({ kind: 'ready' });
    const primary = h.webView;
    primary.props.onError({ nativeEvent: { url } });
    h.message({ kind: 'start-issued' });
    assert.equal(h.errors.length, 1);
    assert.equal(h.removed(), true);
    assert.equal(h.messages.filter((frame) => frame.kind === 'start-permission').length, 1);
  });

  test('loads the complete HTTPS URI with JS enabled and injects once before granting start permission', () => {
    const h = createHarness();
    assert.equal(h.webView.type, 'WebView');
    assert.equal(h.webView.props.source.uri, url);
    assert.equal(h.webView.props.javaScriptEnabled, true);
    h.onInject = () => {
      h.message({ kind: 'document-ready' });
      h.message({ kind: 'ready' });
    };
    h.load();
    h.load();
    assert.equal(h.injections.length, 1);
    assert.deepEqual(h.actions, ['inject', 'injected', 'focus', 'post:start-permission']);
    assert.equal(h.errors.length, 0);
  });

  test('ignores messages until bootstrap dispatch and keeps the native loader visible until ready', () => {
    const h = createHarness();
    const before = h.render();
    assert.equal(before.props.children?.[1] && before.props.children[1].type, 'ActivityIndicator');
    assert.equal(
      h.webView.props.style.some((style) => style && style.opacity === 0),
      true
    );
    h.message({ kind: 'document-ready' });
    h.message({ kind: 'ready' });
    h.message({ kind: 'request', id: 1, method: 'events.onClose', params: [] });
    assert.deepEqual(h.actions, []);
    assert.equal(h.removed(), false);
    h.load();
    assert.equal(h.messages.length, 0);
    h.message({ kind: 'document-ready' });
    h.message({ kind: 'ready' });
    assert.equal(h.render().props.children?.[1], false);
    assert.equal(
      h.webView.props.style.some((style) => style && style.opacity === 0),
      false
    );
  });

  test('accepts Android source origins and iOS full message URLs, while rejecting another origin', () => {
    for (const reportedUrl of [origin, url]) {
      const h = createHarness();
      h.load();
      h.message({ kind: 'document-ready' }, reportedUrl);
      h.message({ kind: 'ready' }, reportedUrl);
      assert.equal(h.messages[0]?.kind, 'start-permission');
      assert.equal(h.errors.length, 0);
    }
    const foreign = createHarness();
    foreign.load();
    foreign.message({ kind: 'ready' }, 'https://other.example.com');
    assert.equal(
      foreign.messages.some((frame) => frame.kind === 'start-permission'),
      false
    );
    assert.equal(foreign.errors.length, 1);
    assert.equal(foreign.removed(), true);
  });

  test('checks the full initial document URL while accepting its fragment', () => {
    const fragment = createHarness();
    fragment.load(`${url}#step`);
    assert.equal(fragment.injections.length, 1);
    const wrongPath = createHarness();
    wrongPath.load('https://login.example.com/Other?x=1');
    assert.equal(wrongPath.injections.length, 0);
    assert.equal(wrongPath.errors.length, 0);
    assert.equal(wrongPath.removed(), false);
    assert.equal(wrongPath.webView.props.source.baseUrl, `${origin}/`);
  });

  test('handles Android initial loading without a should-start callback and blocks subsequent document navigation', () => {
    const h = createHarness();
    h.load();
    assert.equal(h.injections.length, 1);
    assert.equal(h.webView.props.onShouldStartLoadWithRequest({ url: `${url}#step`, isTopFrame: true }), true);
    assert.equal(h.webView.props.onShouldStartLoadWithRequest({ url: 'https://cdn.example.com/widget', isTopFrame: false }), true);
    assert.equal(h.webView.props.onShouldStartLoadWithRequest({ url, isTopFrame: true }), false);
    assert.equal(h.removed(), true);
    const beforeStart = createHarness();
    assert.equal(beforeStart.webView.props.onShouldStartLoadWithRequest({ url, isTopFrame: true }), true);
    assert.equal(beforeStart.webView.props.onShouldStartLoadWithRequest({ url: 'https://other.example.com/', isTopFrame: true }), false);
    assert.equal(beforeStart.injections.length, 0);
  });

  test('ignores subresource HTTP errors and recovers document HTTP failure before permission', () => {
    const h = createHarness();
    h.captureLogs();
    h.webView.props.onHttpError({ nativeEvent: { url: 'https://cdn.example.com/sdk' } });
    assert.deepEqual(h.logs, []);
    assert.equal(h.errors.length, 0);
    h.load();
    const cause = { url };
    h.webView.props.onHttpError({ nativeEvent: cause });
    assert.deepEqual(
      h.logs.map(({ level, source, cause: loggedCause }) => ({ level, source, cause: loggedCause })),
      [{ level: OwnIDLogLevel.Warn, source: 'OwnIDEliteView.http', cause }]
    );
    h.message({ kind: 'document-ready' });
    h.message({ kind: 'ready' });
    assert.equal(
      h.messages.some((frame) => frame.kind === 'start-permission'),
      false
    );
    assert.equal(h.errors.length, 0);
    assert.equal(h.removed(), false);
    h.load();
    h.message({ kind: 'document-ready' });
    h.message({ kind: 'ready' });
    assert.equal(h.messages.at(-1)?.kind, 'start-permission');
  });

  test('recovers a synchronous injection exception without starting the failed document', () => {
    const h = createHarness();
    h.failInjection = true;
    h.load();
    h.load();
    assert.equal(h.injections.length, 1);
    assert.deepEqual(h.actions, ['inject', 'stop']);
    assert.equal(h.errors.length, 0);
    assert.equal(h.removed(), false);
    h.load();
    h.message({ kind: 'document-ready' });
    h.message({ kind: 'ready' });
    assert.equal(h.messages.at(-1)?.documentMode, 'inline');
  });

  test('native process loss and new-window callbacks remove the View once', () => {
    for (const handler of ['onRenderProcessGone', 'onContentProcessDidTerminate', 'onOpenWindow'] as const) {
      const h = createHarness();
      h.captureLogs();
      const cause = { url };
      h.webView.props[handler]({ nativeEvent: cause });
      h.webView.props[handler]({ nativeEvent: { url } });
      assert.deepEqual(
        h.logs.map(({ level, source, cause: loggedCause }) => ({ level, source, cause: loggedCause })),
        [{ level: OwnIDLogLevel.Error, source: handler === 'onOpenWindow' ? 'OwnIDEliteView.navigation' : 'OwnIDEliteView.process', cause }]
      );
      assert.equal(h.errors.length, 1, handler);
      assert.deepEqual(h.actions, ['stop']);
      assert.equal(h.removed(), true, handler);
    }
  });

  test('captures launch URL/providers/events once across rerenders', async () => {
    let originalClose = 0;
    let replacementClose = 0;
    let replacementProvider = 0;
    const h = createHarness({ events: { onClose: async () => void originalClose++ } });
    const source = h.webView.props.source;
    h.render({
      ...h.props,
      options: { origin: 'https://other.example.com/new' },
      providers: {
        session: {
          create: async () => {
            replacementProvider++;
            return { status: 'logged-in' };
          },
        },
      },
      events: { onClose: async () => void replacementClose++ },
    });
    assert.equal(h.webView.props.source, source);
    h.start();
    h.message({ kind: 'request', id: 1, method: 'providers.session.create', params: [payload] });
    await flush();
    assert.deepEqual(h.providerCalls, [payload]);
    assert.equal(replacementProvider, 0);
    h.message({ kind: 'request', id: 2, method: 'events.onClose', params: [] });
    await flush();
    assert.equal(originalClose, 1);
    assert.equal(replacementClose, 0);
    assert.equal(h.removed(), true);
  });

  for (const outcome of ['fulfillment', 'rejection'] as const) {
    test(`isolates a fresh HTTPS mount from a detached mount's late session ${outcome}`, async () => {
      const oldProviderCalls: unknown[] = [];
      const oldCallbacks: string[] = [];
      let settleOld = (): void => undefined;
      const oldSession = new Promise<{ status: 'logged-in'; result: { flow: string } }>((resolve, reject) => {
        settleOld =
          outcome === 'fulfillment'
            ? () => resolve({ status: 'logged-in', result: { flow: 'old' } })
            : () => reject(new Error('old session failed'));
      });
      const old = createHarness({
        providers: {
          session: {
            create: async (value) => {
              oldProviderCalls.push(value);
              return oldSession;
            },
          },
        },
        events: {
          onError: async () => void oldCallbacks.push('error'),
          onFinish: async () => void oldCallbacks.push('finish'),
          onClose: async () => void oldCallbacks.push('close'),
        },
      });
      old.start();
      old.message({ kind: 'request', id: 1, method: 'providers.session.create', params: [payload] });
      await flush();
      assert.deepEqual(oldProviderCalls, [payload]);
      const oldMessages = [...old.messages];
      const oldActions = [...old.actions];
      old.detach();
      old.webView.props.ref(null);

      const newPayload = { metadata: { loginId: 'next@example.com', authType: AuthMethod.PASSKEY } };
      const newProviderCalls: unknown[] = [];
      const newCallbacks: unknown[] = [];
      const newResult = { status: 'logged-in' as const, result: { flow: 'new' } };
      let resolveNew = (): void => undefined;
      const newSession = new Promise<typeof newResult>((resolve) => {
        resolveNew = () => resolve(newResult);
      });
      const fresh = createHarness({
        namespace: old.props.namespace,
        providers: {
          session: {
            create: async (value) => {
              newProviderCalls.push(value);
              return newSession;
            },
          },
        },
        events: {
          onError: async (message, details) => void newCallbacks.push([message, details]),
          onFinish: async (value) => void newCallbacks.push(value),
          onClose: async () => void newCallbacks.push('close'),
        },
      });
      fresh.start();
      fresh.message({ kind: 'request', id: 1, method: 'providers.session.create', params: [newPayload] });
      await flush();
      assert.deepEqual(newProviderCalls, [newPayload]);
      settleOld();
      await flush();
      assert.deepEqual(old.messages, oldMessages);
      assert.deepEqual(old.actions, oldActions);
      assert.deepEqual(oldCallbacks, []);
      assert.deepEqual(newCallbacks, []);
      assert.deepEqual(fresh.messages, [{ ...base, kind: 'start-permission' }]);

      resolveNew();
      await flush();
      assert.deepEqual(fresh.messages.at(-1), { ...base, kind: 'response', id: 1, result: newResult });
      const finish = { loginId: 'next@example.com', authType: AuthMethod.PASSKEY, source: 'mobile' };
      fresh.message({ kind: 'request', id: 2, method: 'events.onFinish', params: [finish] });
      fresh.message({ kind: 'request', id: 2, method: 'events.onFinish', params: [finish] });
      fresh.message({ kind: 'start-settled', status: 'completed' });
      await flush();
      assert.deepEqual(newCallbacks, [finish]);
      assert.deepEqual(newProviderCalls, [newPayload]);
      assert.equal(fresh.removed(), true);
      assert.deepEqual(fresh.messages.at(-1), { ...base, kind: 'response', id: 2 });
      assert.equal(fresh.messages.filter((frame) => frame.kind === 'start-permission').length, 1);
      assert.deepEqual(old.messages, oldMessages);
      assert.deepEqual(oldCallbacks, []);
    });
  }

  test('preserves load and readiness across transient effect and ref cleanup, granting start once after reattachment', () => {
    const h = createHarness();
    h.detach();
    h.webView.props.ref(null);
    h.render();
    h.load();
    h.message({ kind: 'document-ready' });
    h.message({ kind: 'ready' });
    assert.deepEqual(h.actions, ['inject', 'injected']);
    h.attach();
    assert.deepEqual(h.actions, ['inject', 'injected', 'focus', 'post:start-permission']);
    h.detach();
    h.webView.props.ref(null);
    h.render();
    h.attach();
    h.load();
    assert.equal(h.injections.length, 1);
    assert.equal(h.messages.filter((frame) => frame.kind === 'start-permission').length, 1);
  });

  test('forwards detached provider requests to the controller queue', async () => {
    const h = createHarness();
    h.start();
    h.detach();
    h.message({ kind: 'request', id: 1, method: 'providers.session.create', params: [payload] });
    await flush();
    assert.equal(h.providerCalls.length, 0);
    assert.equal(
      h.messages.some((frame) => frame.kind === 'response'),
      false
    );
    h.attach();
    await flush();
    assert.deepEqual(h.providerCalls, [payload]);
    assert.equal(h.messages.at(-1)?.kind, 'response');
    assert.equal(h.messages.at(-1)?.id, 1);
  });

  test('preserves detached finish and close callbacks until reattachment and then removes the View', async () => {
    for (const method of ['events.onFinish', 'events.onClose']) {
      const calls: unknown[] = [];
      const h = createHarness({
        events: { onFinish: async (value) => void calls.push(value), onClose: async () => void calls.push('close') },
      });
      h.start();
      h.detach();
      const finish = { loginId: 'user@example.com', authType: AuthMethod.PASSKEY, source: 'mobile' };
      h.message({ kind: 'request', id: 1, method, params: method === 'events.onFinish' ? [finish] : [] });
      h.message({ kind: 'start-settled', status: 'completed' });
      await flush();
      assert.equal(calls.length, 0);
      assert.equal(h.removed(), false);
      h.attach();
      await flush();
      assert.deepEqual(calls, method === 'events.onFinish' ? [finish] : ['close']);
      assert.equal(h.removed(), true);
    }
  });

  test('unexpected-origin URL diagnostic is emitted once without requiring an application error callback', () => {
    const h = createHarness({ events: {} });
    h.captureLogs();
    h.load();
    const primary = h.webView;
    h.message({ kind: 'document-ready' }, 'https://other.example.com/');
    primary.props.onMessage({ nativeEvent: { url: 'https://other.example.com/', data: JSON.stringify({ ...base, kind: 'ready' }) } });
    primary.props.onRenderProcessGone({ nativeEvent: { url } });
    assert.deepEqual(
      h.logs.map(({ level, source, message }) => ({ level, source, message })),
      [
        {
          level: OwnIDLogLevel.Error,
          source: 'OwnIDEliteView.message',
          message: 'OwnID Elite received a message from an unexpected origin.',
        },
      ]
    );
    const cause = h.logs[0]?.cause as { url?: unknown } | undefined;
    assert.ok(cause);
    assert.equal(cause.url, 'https://other.example.com/');
    assert.deepEqual(Object.keys(cause), ['url']);
    assert.deepEqual(h.errors, []);
    assert.equal(h.removed(), true);
  });
});
