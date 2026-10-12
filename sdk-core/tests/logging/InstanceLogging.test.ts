import '../reactNativePlatform';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import { Container } from '../../src/di';
import { prepareInitialization } from '../../src/configuration/runtime';
import { OwnIDLogLevel, OwnIdLoggerDiToken, OwnIdLogRouterDiToken, ServerLoggerDiToken } from '../../src/logging';
import { OwnIdLogger } from '../../src/logging/OwnIdLogger';
import { OwnIdLogRouterImpl } from '../../src/logging/impl/OwnIdLogRouterImpl';
import { ServerLoggerImpl } from '../../src/logging/impl/ServerLoggerImpl';
import { defaultRuntimeComposition } from '../../src/runtime/composition';
import type { RuntimeComposition } from '../../src/runtime/composition';
import { RuntimeRoot } from '../../src/runtime/RuntimeRoot';
import { prepareEliteLaunch } from '../../src/flows/elite/run';
import type { OwnIDInstance } from '../../src/namespace/InstanceNamespace';
import type { OwnIDLogEntry } from '../../src/logging';
import { createSenderRuntime, flush, readBody } from './serverLoggerHarness';

function compose(localLogging = new OwnIdLogger()) {
  const root = Container.createRoot('test.root');
  root.registerValue(OwnIdLoggerDiToken, localLogging);
  root.registerValue(
    OwnIdLogRouterDiToken,
    new OwnIdLogRouterImpl(
      () => root.resolveOptional(OwnIdLoggerDiToken),
      () => undefined
    )
  );
  const scope = root.createChild('test.instance');
  const abort = new AbortController();
  const composition = defaultRuntimeComposition.composeInstance(
    scope,
    prepareInitialization({ appId: 'Example123' }).configuration,
    abort.signal,
    () => true
  );
  return { root, scope, abort, composition };
}

test('instance diagnostics reach the server independently of root local logging Off', (context) => {
  const serverCalls = context.mock.method(ServerLoggerImpl.prototype, 'log', () => undefined);
  const { root, scope, composition } = compose();
  const rootRouter = root.resolve(OwnIdLogRouterDiToken);
  const instanceRouter = scope.resolve(OwnIdLogRouterDiToken);
  assert.notEqual(instanceRouter, rootRouter);
  assert.equal(scope.resolve(OwnIdLoggerDiToken), root.resolve(OwnIdLoggerDiToken));
  assert.ok(scope.resolve(ServerLoggerDiToken) instanceof ServerLoggerImpl);
  assert.equal(root.resolveOptional(ServerLoggerDiToken), undefined);
  instanceRouter.log(OwnIDLogLevel.Warn, 'Elite.load', 'Recovery');
  assert.equal(serverCalls.mock.callCount(), 1);
  assert.deepEqual(serverCalls.mock.calls[0]?.arguments, [OwnIDLogLevel.Warn, 'Elite.load', 'Recovery', undefined]);
  rootRouter.log(OwnIDLogLevel.Error, 'OwnID', 'root diagnostic');
  assert.equal(serverCalls.mock.callCount(), 1);
  composition.dispose();
});

test('throwing local sink cannot block server diagnostics and server failure cannot escape', (context) => {
  const serverCalls = context.mock.method(ServerLoggerImpl.prototype, 'log', () => {
    throw new Error('server sink failed');
  });
  const local = new OwnIdLogger();
  context.mock.method(local, 'emit', () => {
    throw new Error('local sink failed');
  });
  const { scope, composition } = compose(local);
  assert.doesNotThrow(() => scope.resolve(OwnIdLogRouterDiToken).log(OwnIDLogLevel.Error, 'Elite', 'Failed'));
  assert.equal(serverCalls.mock.callCount(), 1);
  composition.dispose();
});

test('existing instance routers resolve the currently registered local logger', (context) => {
  const serverCalls = context.mock.method(ServerLoggerImpl.prototype, 'log', () => undefined);
  const { root, scope, composition } = compose();
  const sources: string[] = [];
  const replacement = new OwnIdLogger();
  replacement.configure({ level: OwnIDLogLevel.Info, onLog: (entry) => sources.push(entry.source) });
  root.registerValue(OwnIdLoggerDiToken, replacement);
  scope.resolve(OwnIdLogRouterDiToken).log(OwnIDLogLevel.Warn, 'Elite.recovery', 'Recovery');
  assert.deepEqual(sources, ['Elite.recovery']);
  assert.equal(serverCalls.mock.callCount(), 1);
  composition.dispose();
});

test('source router isolates provider resolution failures independently for both sinks', () => {
  const localSources: string[] = [];
  const local = new OwnIdLogger();
  local.configure({ level: OwnIDLogLevel.Error, onLog: (entry) => localSources.push(entry.source) });
  const serverSources: string[] = [];
  const server = { log: (_level: OwnIDLogLevel, source: string) => serverSources.push(source), dispose: () => undefined };
  new OwnIdLogRouterImpl(
    () => {
      throw new Error('local unavailable');
    },
    () => server
  ).log(OwnIDLogLevel.Error, 'server-only', 'failure');
  new OwnIdLogRouterImpl(
    () => local,
    () => {
      throw new Error('server unavailable');
    }
  ).log(OwnIDLogLevel.Error, 'local-only', 'failure');
  assert.deepEqual(serverSources, ['server-only']);
  assert.deepEqual(localSources, ['local-only']);
});

test('composition construction does not start requests and disposal closes its server sink', (context) => {
  const fetchCalls = context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('unexpected request');
  });
  const disposeCalls = context.mock.method(ServerLoggerImpl.prototype, 'dispose', () => undefined);
  const { composition } = compose();
  assert.equal(fetchCalls.mock.callCount(), 0);
  composition.dispose();
  assert.equal(disposeCalls.mock.callCount(), 1);
});

// Load the actual composition with the actual sender running behind mocked RN/fetch/timers.
// RuntimeRoot, containers, namespace scopes, and Elite launch preparation remain the real modules.
function actualRuntime() {
  const sender = createSenderRuntime();
  const file = fileURLToPath(new URL('../../src/runtime/composition.ts', import.meta.url));
  const sourceRequire = createRequire(file);
  const output = { exports: {} as { defaultRuntimeComposition: RuntimeComposition } };
  runInNewContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports: output.exports,
      module: output,
      require(name: string) {
        if (name === '../logging/impl/ServerLoggerImpl') return { ServerLoggerImpl: sender.ServerLoggerImpl };
        return sourceRequire(name);
      },
    },
    { filename: file }
  );
  return { sender, composition: output.exports.defaultRuntimeComposition };
}

function launch(namespace: OwnIDInstance) {
  return prepareEliteLaunch(
    namespace.flows.elite,
    { origin: 'https://hosted.example.com/' },
    {},
    { session: { create: async () => ({ status: 'logged-in' }) } },
    '/.well-known/assetlinks.json'
  );
}

test('real runtime routes child launches to their instance while sharing current root local logging', async () => {
  const { sender, composition } = actualRuntime();
  const root = RuntimeRoot.create(composition);
  const firstEntries: OwnIDLogEntry[] = [];
  const nextEntries: OwnIDLogEntry[] = [];
  try {
    root.initialize('A', { appId: 'First123' });
    root.initialize('B', { appId: 'Second123', env: 'uat', region: 'eu' });
    const parent = root.getInstanceNamespace('A');
    const a = launch(
      parent.withContext({ loginId: 'a@example.com' }).withProviders({ session: { create: async () => ({ status: 'logged-in' }) } })
    );
    const b = launch(root.getInstanceNamespace('B'));
    assert.equal(a.logging, launch(parent).logging);
    assert.notEqual(a.logging, b.logging);
    assert.equal(sender.requests.length, 0);
    a.logging.log(OwnIDLogLevel.Warn, 'A.load', 'root local logging is off');
    await flush();
    assert.equal(sender.requests[0]?.url, 'https://First123.server.ownid.com/events');

    root.configureLogging({ level: OwnIDLogLevel.Error, label: 'First', onLog: (entry) => firstEntries.push(entry) });
    b.logging.log(OwnIDLogLevel.Warn, 'B.load', 'below local threshold');
    a.logging.log(OwnIDLogLevel.Error, 'A.process', 'visible locally');
    root.configureLogging({ level: OwnIDLogLevel.Warn, label: 'Next', onLog: (entry) => nextEntries.push(entry) });
    b.logging.log(OwnIDLogLevel.Warn, 'B.recovery', 'uses new configuration');
    await flush();
    assert.deepEqual(
      firstEntries.map(({ label, source }) => ({ label, source })),
      [{ label: 'First', source: 'A.process' }]
    );
    assert.deepEqual(
      nextEntries.map(({ label, source }) => ({ label, source })),
      [{ label: 'Next', source: 'B.recovery' }]
    );
    assert.deepEqual(
      sender.requests
        .map((request) => [request.url, readBody(request).codeInitiator])
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]))),
      [
        ['https://First123.server.ownid.com/events', 'A.load'],
        ['https://First123.server.ownid.com/events', 'A.process'],
        ['https://Second123.server.uat.ownid-eu.com/events', 'B.load'],
        ['https://Second123.server.uat.ownid-eu.com/events', 'B.recovery'],
      ]
    );
  } finally {
    root.destroy('A');
    root.destroy('B');
    await flush();
  }
  assert.equal(sender.timers.size, 0);
});

test('reinitialization and destroy cancel only the owner and prevent old launch delivery', async () => {
  const { sender, composition } = actualRuntime();
  const root = RuntimeRoot.create(composition);
  try {
    root.initialize('A', { appId: 'Old123' });
    root.initialize('B', { appId: 'Other123' });
    const oldNamespace = root.getInstanceNamespace('A').withContext({ loginId: 'old@example.com' });
    const old = launch(oldNamespace);
    const other = launch(root.getInstanceNamespace('B'));
    old.logging.log(OwnIDLogLevel.Error, 'old', 'in flight');
    other.logging.log(OwnIDLogLevel.Error, 'other', 'in flight');
    await flush();
    root.initialize('A', { appId: 'New123' });
    assert.equal(sender.requests[0]?.init.signal?.aborted, true);
    assert.equal(sender.requests[1]?.init.signal?.aborted, false);
    assert.throws(() => launch(oldNamespace), /no longer active/);
    old.logging.log(OwnIDLogLevel.Error, 'stale-old', 'ignored');
    const current = launch(root.getInstanceNamespace('A'));
    current.logging.log(OwnIDLogLevel.Warn, 'new', 'replacement');
    await flush();
    assert.equal(sender.requests[2]?.url, 'https://New123.server.ownid.com/events');
    root.destroy('A');
    current.logging.log(OwnIDLogLevel.Error, 'stale-new', 'ignored');
    other.logging.log(OwnIDLogLevel.Warn, 'other-again', 'still active');
    await flush();
    assert.equal(sender.requests[2]?.init.signal?.aborted, true);
    assert.equal(sender.requests[1]?.init.signal?.aborted, false);
    assert.deepEqual(
      sender.requests.map((request) => readBody(request).codeInitiator),
      ['old', 'other', 'new', 'other-again']
    );
    sender.requests[0]?.reject(new Error('late old failure'));
    sender.requests[2]?.reject(new Error('late replacement failure'));
    await flush();
  } finally {
    root.destroy('A');
    root.destroy('B');
    await flush();
  }
  assert.equal(sender.timers.size, 0);
});

test('a local callback destroying its instance suppresses server delivery without affecting another instance', async () => {
  const { sender, composition } = actualRuntime();
  const root = RuntimeRoot.create(composition);
  try {
    root.initialize('A', { appId: 'Callback123' });
    root.initialize('B', { appId: 'Survivor123' });
    const a = launch(root.getInstanceNamespace('A'));
    const b = launch(root.getInstanceNamespace('B'));
    root.configureLogging({
      level: OwnIDLogLevel.Error,
      onLog: (entry) => {
        if (entry.source === 'destroy-owner') root.destroy('A');
      },
    });
    a.logging.log(OwnIDLogLevel.Error, 'destroy-owner', 'local callback runs first');
    b.logging.log(OwnIDLogLevel.Error, 'survivor', 'still delivers');
    await flush();
    assert.equal(sender.requests.length, 1);
    assert.equal(sender.requests[0]?.url, 'https://Survivor123.server.ownid.com/events');
    assert.equal(readBody(sender.requests[0]).codeInitiator, 'survivor');
  } finally {
    root.destroy('A');
    root.destroy('B');
    await flush();
  }
});

test('root initialization and cleanup failures stay local even while an instance has a server sink', async () => {
  const { sender, composition } = actualRuntime();
  const cleanupFailure = new Error('cleanup failed');
  const root = RuntimeRoot.create({
    composeRoot: composition.composeRoot,
    composeInstance(...args) {
      const instance = composition.composeInstance(...args);
      return {
        namespace: instance.namespace,
        dispose: () => {
          instance.dispose();
          throw cleanupFailure;
        },
      };
    },
  });
  const entries: OwnIDLogEntry[] = [];
  root.configureLogging({ level: OwnIDLogLevel.Error, onLog: (entry) => entries.push(entry) });
  root.initialize('A', { appId: 'Root123' });
  assert.throws(() => root.initialize('B', { appId: '' }), TypeError);
  root.destroy('A');
  await flush();
  assert.deepEqual(
    entries.map(({ source, message }) => ({ source, message })),
    [
      { source: 'OwnID.initialize', message: 'OwnID initialization failed.' },
      { source: 'OwnID.destroy', message: 'OwnID instance cleanup failed.' },
    ]
  );
  assert.equal(entries[1]?.cause, cleanupFailure);
  assert.equal(sender.platformReads(), 0);
  assert.equal(sender.requests.length, 0);
  assert.equal(sender.timers.size, 0);
});
