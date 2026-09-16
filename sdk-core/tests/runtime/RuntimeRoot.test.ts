import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';

import { prepareInitialization, RuntimeConfigurationToken, RuntimeLanguageProviderToken } from '../../src/configuration/runtime';
import type { RuntimeConfiguration } from '../../src/configuration/runtime';
import type { OwnIDConfigurationOptions } from '../../src/configuration';
import { Container } from '../../src/di';
import { OwnIDLogLevel } from '../../src/logging';
import type { OwnIDLogEntry } from '../../src/logging';
import { defaultRuntimeComposition } from '../../src/runtime/composition';
import type { RuntimeComposition } from '../../src/runtime/composition';
import { InstanceIdentityConflictError, RuntimeRoot } from '../../src/runtime/RuntimeRoot';

const requireFromTest = createRequire(import.meta.url);
const requireFromReactNative = createRequire(requireFromTest.resolve('react-native/package.json'));
const ReactNativeAbortController = (
  requireFromReactNative('abort-controller/dist/abort-controller') as { readonly AbortController: typeof AbortController }
).AbortController;

interface CapturedInstance {
  readonly configuration: RuntimeConfiguration;
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
  disposeCalls: number;
  onDispose?: () => void;
  disposeError?: Error;
}

function options(appId: string, options: Partial<{ env: 'prod' | 'uat'; region: 'us' | 'eu' }> = {}): OwnIDConfigurationOptions {
  return { appId, ...options };
}

function recordingComposition(captures: CapturedInstance[], failForAppId?: string): RuntimeComposition {
  let pendingFailure = failForAppId !== undefined;
  return {
    composeRoot(root: Container): void {
      void root;
    },
    composeInstance(scope, candidate, signal, isCurrent) {
      const capture: CapturedInstance = {
        configuration: candidate,
        signal,
        isCurrent,
        disposeCalls: 0,
      };
      captures.push(capture);
      assert.equal(isCurrent(), false);

      if (pendingFailure && candidate.appId === failForAppId) {
        pendingFailure = false;
        throw new Error(`Composition failed for ${candidate.appId}`);
      }

      const composed = defaultRuntimeComposition.composeInstance(scope, candidate, signal, isCurrent);
      return {
        namespace: composed.namespace,
        dispose: () => {
          capture.disposeCalls += 1;
          capture.onDispose?.();
          if (capture.disposeError !== undefined) {
            throw capture.disposeError;
          }
        },
      };
    },
  };
}

function initialize(root: RuntimeRoot, name: string, candidate: OwnIDConfigurationOptions): void {
  root.initialize(name, candidate);
}

function readLanguageOverride(root: RuntimeRoot): readonly string[] | null {
  return (root as unknown as { readonly languageOverride: readonly string[] | null }).languageOverride;
}

function addThrowingObjectAbortListener(signal: AbortSignal, error: Error, onAbort?: () => void): void {
  const eventTarget = signal as unknown as {
    addEventListener(type: 'abort', listener: { handleEvent(): void }): void;
  };
  eventTarget.addEventListener('abort', {
    handleEvent(): void {
      onAbort?.();
      throw error;
    },
  });
}

function withReactNativeAbortController(action: () => void): void {
  const runtimeGlobal = globalThis as typeof globalThis & { AbortController: typeof AbortController };
  const originalAbortController = runtimeGlobal.AbortController;
  runtimeGlobal.AbortController = ReactNativeAbortController;
  try {
    action();
  } finally {
    runtimeGlobal.AbortController = originalAbortController;
  }
}

describe('runtime root lifecycle', () => {
  test('production composition binds instance configuration to its namespace scope', () => {
    const scope = Container.createRoot('ownid.scope.test-instance');
    const candidate = prepareInitialization(options('Direct123', { env: 'uat', region: 'eu' })).configuration;
    defaultRuntimeComposition.composeInstance(scope, candidate, new AbortController().signal, () => true);

    assert.equal(scope.resolve(RuntimeConfigurationToken), candidate);
  });

  test('language overrides are snapshotted, preserved across lifecycle calls, and reset by an empty list', () => {
    const languages = ['uk-UA', 'en-US'];
    const root = RuntimeRoot.create();
    initialize(root, 'DEFAULT', { ...options('First123'), languages });
    const stored = readLanguageOverride(root);
    assert.deepEqual(stored, ['uk-UA', 'en-US']);
    assert.equal(Object.isFrozen(stored), true);

    languages[0] = 'fr-FR';
    assert.deepEqual(readLanguageOverride(root), ['uk-UA', 'en-US']);

    initialize(root, 'DEFAULT', options('Second123'));
    assert.equal(readLanguageOverride(root), stored);
    initialize(root, 'DEFAULT', { ...options('Third123'), languages: null });
    assert.equal(readLanguageOverride(root), stored);

    root.destroy('DEFAULT');
    assert.equal(readLanguageOverride(root), stored);

    initialize(root, 'DEFAULT', { ...options('Fourth123'), languages: [] });
    assert.equal(readLanguageOverride(root), null);
    initialize(root, 'DEFAULT', options('Fifth123'));
    assert.equal(readLanguageOverride(root), null);
  });

  test('exposes the current frozen language snapshot through the root dependency scope', () => {
    let snapshot: (() => readonly string[] | null) | undefined;
    const composition: RuntimeComposition = {
      composeRoot(root) {
        snapshot = root.resolve(RuntimeLanguageProviderToken).snapshot;
      },
      composeInstance: defaultRuntimeComposition.composeInstance,
    };
    const root = RuntimeRoot.create(composition);
    assert.equal(snapshot?.(), null);

    initialize(root, 'DEFAULT', { ...options('First123'), languages: ['uk-UA', 'en-US'] });
    const first = snapshot?.();
    assert.deepEqual(first, ['uk-UA', 'en-US']);
    assert.equal(Object.isFrozen(first), true);

    initialize(root, 'DEFAULT', options('Second123'));
    assert.equal(snapshot?.(), first);
    initialize(root, 'DEFAULT', { ...options('Third123'), languages: [] });
    assert.equal(snapshot?.(), null);
  });

  test('same-name replacement publishes the candidate before disposing the previous instance', () => {
    const captures: CapturedInstance[] = [];
    const root = RuntimeRoot.create(recordingComposition(captures));
    initialize(root, 'DEFAULT', options('First123'));
    const first = captures[0];
    assert.ok(first);
    assert.equal(first.isCurrent(), true);

    first.onDispose = () => {
      assert.equal(first.isCurrent(), false);
      assert.equal(captures[1]?.isCurrent(), true);
    };
    initialize(root, 'DEFAULT', options('Second123'));
    const second = captures[1];
    assert.ok(second);

    assert.equal(first.signal.aborted, true);
    assert.equal(first.disposeCalls, 1);
    assert.equal(second.signal.aborted, false);
    assert.equal(second.isCurrent(), true);
  });

  test('JSON initialization shares atomic replacement and language state with typed initialization', () => {
    const captures: CapturedInstance[] = [];
    const root = RuntimeRoot.create(recordingComposition(captures));
    initialize(root, 'DEFAULT', { ...options('Typed123'), languages: ['en-US'] });
    const typed = captures[0];
    assert.ok(typed);

    root.initializeFromJson('DEFAULT', '{"appID":"Json123","env":"DEV","region":"EU","languages":["uk-UA"]}');
    const json = captures[1];
    assert.ok(json);
    assert.deepEqual(json.configuration, { appId: 'Json123', env: 'dev', region: 'eu' });
    assert.equal(typed.signal.aborted, true);
    assert.equal(json.isCurrent(), true);
    assert.deepEqual(readLanguageOverride(root), ['uk-UA']);

    assert.throws(() => root.initializeFromJson('DEFAULT', '{"appId":"Broken123","languages":[7]}'), /languages\[0\]/);
    assert.equal(json.signal.aborted, false);
    assert.equal(json.isCurrent(), true);
    assert.deepEqual(readLanguageOverride(root), ['uk-UA']);
  });

  test('destroy removes the instance before disposal and is idempotent', () => {
    const captures: CapturedInstance[] = [];
    const root = RuntimeRoot.create(recordingComposition(captures));
    initialize(root, '', options('EmptyName123'));
    const current = captures[0];
    assert.ok(current);
    current.onDispose = () => assert.equal(current.isCurrent(), false);

    root.destroy('');
    root.destroy('');

    assert.equal(current.signal.aborted, true);
    assert.equal(current.disposeCalls, 1);
  });

  test('identity conflicts retain the owner and do not compose a contender', () => {
    const captures: CapturedInstance[] = [];
    const root = RuntimeRoot.create(recordingComposition(captures));
    initialize(root, 'owner', { ...options('Shared123'), languages: ['en-US'] });
    const owner = captures[0];
    assert.ok(owner);
    const ownerLanguages = readLanguageOverride(root);

    assert.throws(
      () => initialize(root, 'contender', { ...options('Shared123'), languages: ['fr-FR'] }),
      (error: unknown) =>
        error instanceof InstanceIdentityConflictError &&
        error.name === 'InstanceIdentityConflictError' &&
        error.conflictingInstanceName === 'owner'
    );
    assert.equal(captures.length, 1);
    assert.equal(owner.isCurrent(), true);
    assert.equal(owner.signal.aborted, false);
    assert.equal(readLanguageOverride(root), ownerLanguages);

    initialize(root, 'regional', options('Shared123', { region: 'eu' }));
    initialize(root, 'environment', options('Shared123', { env: 'uat' }));
    assert.equal(captures.length, 3);
  });

  test('a failed candidate is aborted and leaves the current entry reusable', () => {
    const captures: CapturedInstance[] = [];
    const root = RuntimeRoot.create(recordingComposition(captures, 'Fail123'));
    initialize(root, 'DEFAULT', { ...options('Stable123'), languages: ['en-US'] });
    const stable = captures[0];
    assert.ok(stable);

    assert.throws(() => initialize(root, 'DEFAULT', { ...options('Fail123'), languages: ['fr-FR'] }), /Composition failed/);
    const failed = captures[1];
    assert.ok(failed);
    assert.equal(failed.signal.aborted, true);
    assert.equal(failed.isCurrent(), false);
    assert.equal(stable.signal.aborted, false);
    assert.equal(stable.isCurrent(), true);
    assert.deepEqual(readLanguageOverride(root), ['en-US']);

    initialize(root, 'other', options('Fail123'));
    assert.equal(captures[2]?.isCurrent(), true);
    assert.deepEqual(readLanguageOverride(root), ['en-US']);
  });

  test('a React Native object abort-listener failure cannot mask the original composition error', () => {
    withReactNativeAbortController(() => {
      const originalError = new Error('expected composition failure');
      const abortError = new Error('expected abort-listener failure');
      const logs: OwnIDLogEntry[] = [];
      let failedSignal: AbortSignal | undefined;
      let stableIsCurrent: (() => boolean) | undefined;
      const root = RuntimeRoot.create({
        composeRoot(): void {},
        composeInstance(scope, candidate, signal, isCurrent) {
          if (candidate.appId === 'Fail123') {
            failedSignal = signal;
            addThrowingObjectAbortListener(signal, abortError);
            throw originalError;
          }

          stableIsCurrent = isCurrent;
          return defaultRuntimeComposition.composeInstance(scope, candidate, signal, isCurrent);
        },
      });
      root.configureLogging({ level: OwnIDLogLevel.Error, onLog: (entry) => logs.push(entry) });
      initialize(root, 'DEFAULT', { ...options('Stable123'), languages: ['en-US'] });

      assert.throws(
        () => initialize(root, 'DEFAULT', { ...options('Fail123'), languages: ['fr-FR'] }),
        (error: unknown) => error === originalError
      );
      assert.equal(failedSignal?.aborted, true);
      assert.equal(stableIsCurrent?.(), true);
      assert.deepEqual(readLanguageOverride(root), ['en-US']);
      assert.deepEqual(
        logs.map(({ message, cause }) => ({ message, cause })),
        [
          { message: 'OwnID initialization failed.', cause: originalError },
          { message: 'OwnID instance abort failed.', cause: abortError },
        ]
      );
    });
  });

  test('React Native object abort-listener and disposer failures are isolated after both cleanup steps', () => {
    withReactNativeAbortController(() => {
      const abortError = new Error('expected abort-listener failure');
      const disposeError = new Error('expected disposer failure');
      const logs: OwnIDLogEntry[] = [];
      const sequence: string[] = [];
      let disposeCalls = 0;
      const root = RuntimeRoot.create({
        composeRoot(): void {},
        composeInstance(scope, candidate, signal, isCurrent) {
          addThrowingObjectAbortListener(signal, abortError, () => sequence.push('abort'));
          const composed = defaultRuntimeComposition.composeInstance(scope, candidate, signal, isCurrent);
          return {
            namespace: composed.namespace,
            dispose: () => {
              sequence.push('dispose');
              disposeCalls += 1;
              throw disposeError;
            },
          };
        },
      });
      root.configureLogging({
        level: OwnIDLogLevel.Error,
        onLog: (entry) => {
          sequence.push(`log:${entry.message}`);
          logs.push(entry);
        },
      });
      initialize(root, 'DEFAULT', options('First123'));

      assert.doesNotThrow(() => root.destroy('DEFAULT'));
      root.destroy('DEFAULT');

      assert.equal(disposeCalls, 1);
      assert.deepEqual(sequence, ['abort', 'dispose', 'log:OwnID instance abort failed.', 'log:OwnID instance cleanup failed.']);
      assert.deepEqual(
        logs.map(({ source, cause }) => ({ source, cause })),
        [
          { source: 'OwnID.destroy', cause: abortError },
          { source: 'OwnID.destroy', cause: disposeError },
        ]
      );
    });
  });

  test('reentrant replacement from old disposal wins the final map state', () => {
    const captures: CapturedInstance[] = [];
    const root = RuntimeRoot.create(recordingComposition(captures));
    initialize(root, 'DEFAULT', { ...options('First123'), languages: ['en-US'] });
    const first = captures[0];
    assert.ok(first);
    first.onDispose = () => {
      assert.deepEqual(readLanguageOverride(root), ['fr-FR']);
      initialize(root, 'DEFAULT', { ...options('Third123'), languages: ['de-DE'] });
    };

    initialize(root, 'DEFAULT', { ...options('Second123'), languages: ['fr-FR'] });

    const second = captures[1];
    const third = captures[2];
    assert.ok(second);
    assert.ok(third);
    assert.equal(first.disposeCalls, 1);
    assert.equal(second.disposeCalls, 1);
    assert.equal(second.signal.aborted, true);
    assert.equal(second.isCurrent(), false);
    assert.equal(third.isCurrent(), true);
    assert.deepEqual(readLanguageOverride(root), ['de-DE']);
  });

  test('reentrant initialization from destroy disposal remains current', () => {
    const captures: CapturedInstance[] = [];
    const root = RuntimeRoot.create(recordingComposition(captures));
    initialize(root, 'DEFAULT', options('First123'));
    const first = captures[0];
    assert.ok(first);
    first.onDispose = () => initialize(root, 'DEFAULT', options('Second123'));

    root.destroy('DEFAULT');

    assert.equal(captures[1]?.isCurrent(), true);
  });

  test('a throwing old disposer is logged while the published replacement remains current', () => {
    const captures: CapturedInstance[] = [];
    const logs: OwnIDLogEntry[] = [];
    const root = RuntimeRoot.create(recordingComposition(captures));
    root.configureLogging({ level: OwnIDLogLevel.Error, onLog: (entry) => logs.push(entry) });
    initialize(root, 'DEFAULT', options('First123'));
    const first = captures[0];
    assert.ok(first);
    first.disposeError = new Error('expected dispose failure');

    initialize(root, 'DEFAULT', options('Second123'));
    const second = captures[1];
    assert.ok(second);
    assert.equal(first.signal.aborted, true);
    assert.equal(first.disposeCalls, 1);
    assert.equal(second.isCurrent(), true);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.source, 'OwnID.initialize');
    assert.equal(logs[0]?.cause, first.disposeError);

    root.destroy('DEFAULT');
    assert.equal(first.disposeCalls, 1);
    assert.equal(second.disposeCalls, 1);
  });
});
