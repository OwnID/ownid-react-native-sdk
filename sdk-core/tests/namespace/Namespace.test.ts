import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { OwnIDContext } from '../../src/context';
import { ContextToken } from '../../src/context';
import { Container } from '../../src/di';
import { getEliteNamespaceBinding } from '../../src/flows/elite/namespace';
import type { OwnIDEliteNamespace } from '../../src/flows/elite/namespace';
import type { AuthResult, LoginPayload } from '../../src/models/authentication';
import type { OwnIDProviders } from '../../src/providers';
import { SessionCreateProviderToken } from '../../src/providers/internal';
import { defaultRuntimeComposition } from '../../src/runtime/composition';
import { RuntimeRoot } from '../../src/runtime/RuntimeRoot';
import { prepareInitialization } from '../../src/configuration/runtime';

type SessionCreate = (payload: LoginPayload) => Promise<AuthResult>;

function createSession(label: string): SessionCreate {
  return async () => ({ status: 'logged-in', result: label });
}

function composeNamespace() {
  const scope = Container.createRoot('ownid.scope.test-instance');
  const configuration = prepareInitialization({ appId: 'Namespace123' }).configuration;
  const abortController = new AbortController();
  const composed = defaultRuntimeComposition.composeInstance(scope, configuration, abortController.signal, () => true);

  return { namespace: composed.namespace };
}

function bindingFor(namespace: OwnIDEliteNamespace) {
  return getEliteNamespaceBinding(namespace);
}

describe('namespace scoping', () => {
  test('complete child Context masks its parent while setters patch visible Context and clear reveals the parent', () => {
    const { namespace } = composeNamespace();
    namespace.setContext({ loginId: 'parent@example.com' });

    const masked = namespace.flows.withContext({});
    const providerScoped = namespace.withProviders({ session: { create: createSession('child') } });
    assert.deepEqual(bindingFor(masked.elite).scope.resolve(ContextToken), {});
    assert.equal(bindingFor(providerScoped.flows.elite).scope.resolve(ContextToken).loginId, 'parent@example.com');

    namespace.setContext({ loginId: 'updated@example.com' });
    assert.equal(bindingFor(namespace.flows.elite).scope.resolve(ContextToken).loginId, 'updated@example.com');
    assert.equal(bindingFor(providerScoped.flows.elite).scope.resolve(ContextToken).loginId, 'updated@example.com');
    assert.deepEqual(bindingFor(masked.elite).scope.resolve(ContextToken), {});

    providerScoped.setContext({});
    namespace.setContext({ loginId: 'latest@example.com' });
    assert.equal(bindingFor(providerScoped.flows.elite).scope.resolve(ContextToken).loginId, 'updated@example.com');

    providerScoped.setContext({ loginId: null });
    assert.deepEqual(bindingFor(providerScoped.flows.elite).scope.resolve(ContextToken), {});
    providerScoped.clearContext();
    assert.equal(bindingFor(providerScoped.flows.elite).scope.resolve(ContextToken).loginId, 'latest@example.com');
  });

  test('Context inputs are validated and snapshotted before scope mutation', () => {
    const { namespace } = composeNamespace();
    const context: { loginId?: string | null } = { loginId: 'captured@example.com' };
    const scoped = namespace.withContext(context);
    context.loginId = 'mutated@example.com';

    const captured = bindingFor(scoped.flows.elite).scope.resolve(ContextToken);
    assert.equal(captured.loginId, 'captured@example.com');
    assert.equal(Object.isFrozen(captured), true);

    namespace.setContext({ loginId: 'stable@example.com' });
    assert.throws(() => namespace.setContext(null as unknown as OwnIDContext), TypeError);
    assert.throws(() => namespace.setContext({ loginId: 7 } as unknown as OwnIDContext), TypeError);
    assert.equal(bindingFor(namespace.flows.elite).scope.resolve(ContextToken).loginId, 'stable@example.com');
  });

  test('provider scopes overlay supplied members and empty overlays preserve namespace identity', () => {
    const { namespace } = composeNamespace();
    const parentProvider = createSession('parent');
    const childProvider = createSession('child');
    namespace.setProviders({ session: { create: parentProvider } });

    assert.equal(namespace.flows.withProviders({}), namespace.flows);
    assert.equal(namespace.flows.withProviders({ session: {} }), namespace.flows);

    const scoped = namespace.flows.withProviders({ session: { create: childProvider } });
    const parentRegistration = bindingFor(namespace.flows.elite).scope.resolve(SessionCreateProviderToken);
    assert.equal(parentRegistration.create, parentProvider);
    assert.equal(Object.getPrototypeOf(parentRegistration), null);
    assert.equal(Object.isFrozen(parentRegistration), true);
    assert.equal(bindingFor(scoped.elite).scope.resolve(SessionCreateProviderToken).create, childProvider);

    const replacement = createSession('replacement');
    namespace.setProviders({ session: { create: replacement } });
    assert.equal(bindingFor(namespace.flows.elite).scope.resolve(SessionCreateProviderToken).create, replacement);
    assert.equal(bindingFor(scoped.elite).scope.resolve(SessionCreateProviderToken).create, childProvider);
  });

  test('provider validation completes before mutation and rejects callable thenables', () => {
    const { namespace } = composeNamespace();
    const stable = createSession('stable');
    namespace.setProviders({ session: { create: stable } });

    assert.throws(() => namespace.setProviders({ session: { create: 7 } } as unknown as OwnIDProviders), /providers\.session\.create/);
    const thenable = Object.assign(createSession('thenable'), { then: () => undefined });
    assert.throws(() => namespace.withProviders({ session: { create: thenable } }), /must not be thenable/);
    assert.equal(bindingFor(namespace.flows.elite).scope.resolve(SessionCreateProviderToken).create, stable);
  });

  test('provider registration never reads the app callback after preparation', () => {
    const root = RuntimeRoot.create();
    root.initialize('DEFAULT', { appId: 'ProviderReadFirst123' });
    const namespace = root.getInstanceNamespace('DEFAULT');
    const setterCallback = createSession('setter');
    let setterReads = 0;
    Object.defineProperty(setterCallback, 'then', {
      get(): undefined {
        setterReads += 1;
        if (setterReads === 2) {
          root.initialize('DEFAULT', { appId: 'ProviderReadSecond123' });
        }
        return undefined;
      },
    });

    namespace.setProviders({ session: { create: setterCallback } });

    assert.equal(setterReads, 1);
    assert.equal(root.getInstanceNamespace('DEFAULT'), namespace);
    assert.equal(bindingFor(namespace.flows.elite).scope.resolve(SessionCreateProviderToken).create, setterCallback);

    const instanceCallback = createSession('instance');
    let instanceReads = 0;
    Object.defineProperty(instanceCallback, 'then', {
      get(): undefined {
        instanceReads += 1;
        if (instanceReads === 2) {
          root.initialize('DEFAULT', { appId: 'ProviderReadThird123' });
        }
        return undefined;
      },
    });

    const scopedInstance = namespace.withProviders({ session: { create: instanceCallback } });

    assert.equal(instanceReads, 1);
    assert.equal(root.getInstanceNamespace('DEFAULT'), namespace);
    assert.equal(bindingFor(scopedInstance.flows.elite).scope.resolve(SessionCreateProviderToken).create, instanceCallback);

    root.destroy('DEFAULT');
  });

  test('Elite leaves are immutable opaque handles with exact private provenance', () => {
    const { namespace } = composeNamespace();
    const elite = namespace.flows.withContext({ loginId: 'user@example.com' }).elite;
    const binding = bindingFor(elite);

    assert.equal(Object.isFrozen(elite), true);
    assert.deepEqual(Object.keys(elite), []);
    assert.equal(binding.scope.resolve(ContextToken).loginId, 'user@example.com');
    assert.throws(() => getEliteNamespaceBinding({} as OwnIDEliteNamespace), /not created by this SDK/);
  });

  test('scoped namespaces retain their originating instance lifetime across replacement and destruction', () => {
    const root = RuntimeRoot.create();
    root.initialize('DEFAULT', { appId: 'First123' });
    const firstNamespace = root.getInstanceNamespace('DEFAULT');
    const firstFlows = firstNamespace.flows;
    const firstElite = firstFlows.elite;
    const first = bindingFor(firstElite);
    assert.equal(first.isCurrent(), true);
    assert.equal(first.signal.aborted, false);

    root.initialize('DEFAULT', { appId: 'Second123' });
    const secondNamespace = root.getInstanceNamespace('DEFAULT');
    const second = bindingFor(secondNamespace.flows.elite);
    assert.equal(first.isCurrent(), false);
    assert.equal(first.signal.aborted, true);
    assert.equal(second.isCurrent(), true);
    assert.equal(second.signal.aborted, false);
    assert.throws(() => firstNamespace.withContext({}), /no longer active/);
    assert.throws(() => firstNamespace.setContext({}), /no longer active/);
    assert.throws(() => firstNamespace.clearContext(), /no longer active/);
    assert.throws(() => firstNamespace.withProviders({}), /no longer active/);
    assert.throws(() => firstNamespace.setProviders({}), /no longer active/);
    assert.throws(() => firstFlows.withContext({}), /no longer active/);
    assert.throws(() => firstFlows.withProviders({}), /no longer active/);
    assert.throws(() => getEliteNamespaceBinding(firstElite), /no longer active/);
    assert.equal(secondNamespace.flows.withProviders({}), secondNamespace.flows);

    root.destroy('DEFAULT');
    assert.equal(second.isCurrent(), false);
    assert.equal(second.signal.aborted, true);
    assert.throws(() => secondNamespace.withContext({}), /no longer active/);
    assert.throws(() => getEliteNamespaceBinding(secondNamespace.flows.elite), /no longer active/);
    assert.throws(() => root.getInstanceNamespace('DEFAULT'), /not initialized/);
  });

  test('reentrant replacement during input preparation cannot mutate the stale scope', () => {
    const root = RuntimeRoot.create();
    root.initialize('DEFAULT', { appId: 'ReentrantFirst123' });
    const firstNamespace = root.getInstanceNamespace('DEFAULT');
    const firstBinding = bindingFor(firstNamespace.flows.elite);
    const patch = Object.defineProperty({}, 'loginId', {
      enumerable: true,
      get(): string {
        root.initialize('DEFAULT', { appId: 'ReentrantSecond123' });
        return 'stale@example.com';
      },
    }) as OwnIDContext;

    assert.throws(() => firstNamespace.setContext(patch), /no longer active/);
    assert.equal(firstBinding.scope.resolveOptional(ContextToken), undefined);
    const secondNamespace = root.getInstanceNamespace('DEFAULT');
    const secondBinding = bindingFor(secondNamespace.flows.elite);
    assert.equal(secondBinding.isCurrent(), true);

    const providers = Object.defineProperty({}, 'session', {
      enumerable: true,
      get(): OwnIDProviders['session'] {
        root.destroy('DEFAULT');
        return { create: createSession('stale') };
      },
    }) as OwnIDProviders;
    assert.throws(() => secondNamespace.setProviders(providers), /no longer active/);
    assert.equal(secondBinding.scope.resolveOptional(SessionCreateProviderToken), undefined);

    root.destroy('DEFAULT');
  });

  test('child-scope preparation cannot rebind replaced or destroyed instances', () => {
    const root = RuntimeRoot.create();
    root.initialize('DEFAULT', { appId: 'CallbackReentryFirst123' });
    const firstNamespace = root.getInstanceNamespace('DEFAULT');
    const firstBinding = bindingFor(firstNamespace.flows.elite);
    let replacementReads = 0;
    const replacingContext = Object.defineProperty({}, 'loginId', {
      enumerable: true,
      get(): string {
        replacementReads += 1;
        root.initialize('DEFAULT', { appId: 'CallbackReentrySecond123' });
        return 'stale@example.com';
      },
    }) as OwnIDContext;

    assert.throws(() => firstNamespace.withContext(replacingContext), /no longer active/);
    assert.equal(replacementReads, 1);
    assert.equal(firstBinding.scope.resolveOptional(ContextToken), undefined);

    const secondNamespace = root.getInstanceNamespace('DEFAULT');
    const secondBinding = bindingFor(secondNamespace.flows.elite);
    const destroyingCallback = createSession('destroyed');
    let destructionReads = 0;
    Object.defineProperty(destroyingCallback, 'then', {
      get(): undefined {
        destructionReads += 1;
        root.destroy('DEFAULT');
        return undefined;
      },
    });

    assert.throws(() => secondNamespace.flows.withProviders({ session: { create: destroyingCallback } }), /no longer active/);
    assert.equal(destructionReads, 1);
    assert.equal(secondBinding.scope.resolveOptional(SessionCreateProviderToken), undefined);
  });
});
