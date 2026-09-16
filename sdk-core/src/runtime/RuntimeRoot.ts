import { Container } from '../di';
import { prepareInitialization, prepareJsonInitialization, RuntimeLanguageProviderToken } from '../configuration/runtime';
import type { PreparedInitialization, RuntimeConfiguration } from '../configuration/runtime';
import type { OwnIDConfigurationOptions } from '../configuration';
import { OwnIDLogLevel } from '../logging';
import { LoggingService, LoggingServiceToken } from '../logging/internal';
import type { OwnIDLoggingOptions } from '../logging';
import { defaultRuntimeComposition } from './composition';
import type { RuntimeComposition } from './composition';
import type { OwnIDInstance } from '../namespace/InstanceNamespace';

interface InstanceEntry {
  readonly configuration: RuntimeConfiguration;
  readonly abortController: AbortController;
  readonly namespace: OwnIDInstance;
  readonly dispose: () => void;
}

export class InstanceIdentityConflictError extends Error {
  readonly conflictingInstanceName: string;

  constructor(conflictingInstanceName: string) {
    super(`OwnID instance identity is already in use by '${conflictingInstanceName}'.`);
    this.name = 'InstanceIdentityConflictError';
    this.conflictingInstanceName = conflictingInstanceName;
  }
}

export class RuntimeRoot {
  private readonly root: Container;
  private readonly composition: RuntimeComposition;
  private readonly logging: LoggingService;
  private readonly instances = new Map<string, InstanceEntry>();
  private languageOverride: readonly string[] | null = null;

  static create(composition: RuntimeComposition = defaultRuntimeComposition): RuntimeRoot {
    const root = Container.createRoot('ownid.scope.root');
    const logging = new LoggingService();
    root.registerValue(LoggingServiceToken, logging);
    const runtime = new RuntimeRoot(root, composition, logging);
    root.registerValue(RuntimeLanguageProviderToken, Object.freeze({ snapshot: () => runtime.languageOverride }));
    composition.composeRoot(root);
    return runtime;
  }

  private constructor(root: Container, composition: RuntimeComposition, logging: LoggingService) {
    this.root = root;
    this.composition = composition;
    this.logging = logging;
  }

  configureLogging(options?: OwnIDLoggingOptions): void {
    this.logging.configure(options);
  }

  initialize(name: string, configuration: OwnIDConfigurationOptions): void {
    this.initializePrepared(name, () => prepareInitialization(configuration), 'OwnID.initialize');
  }

  initializeFromJson(name: string, json: string): void {
    this.initializePrepared(name, () => prepareJsonInitialization(json), 'OwnID.initializeFromJson');
  }

  getInstanceNamespace(name: string): OwnIDInstance {
    const namespace = this.instances.get(name)?.namespace;
    if (namespace === undefined) {
      throw new Error('OwnID is not initialized. Call OwnID.initialize(...) first.');
    }

    return namespace;
  }

  private initializePrepared(name: string, prepare: () => PreparedInitialization, source: string): void {
    let previous: InstanceEntry | undefined;
    let candidateAbortController: AbortController | undefined;
    try {
      const { configuration: runtimeConfiguration, languageOverrideUpdate } = prepare();
      this.assertIdentityAvailable(name, runtimeConfiguration);

      const nextLanguageOverride =
        languageOverrideUpdate === undefined ? this.languageOverride : languageOverrideUpdate.length === 0 ? null : languageOverrideUpdate;
      const scope = this.root.createChild('ownid.scope.instance');
      const abortController = new AbortController();
      candidateAbortController = abortController;
      let candidate: InstanceEntry | undefined = undefined;

      const composed = this.composition.composeInstance(
        scope,
        runtimeConfiguration,
        abortController.signal,
        () => candidate !== undefined && this.instances.get(name) === candidate
      );
      candidate = {
        configuration: runtimeConfiguration,
        abortController,
        namespace: composed.namespace,
        dispose: composed.dispose,
      };

      previous = this.instances.get(name);
      this.languageOverride = nextLanguageOverride;
      this.instances.set(name, candidate);
    } catch (error) {
      let abortFailure: { readonly cause: unknown } | undefined;
      if (candidateAbortController !== undefined) {
        try {
          candidateAbortController.abort();
        } catch (cause) {
          abortFailure = { cause };
        }
      }

      this.logging.emit(OwnIDLogLevel.Error, source, 'OwnID initialization failed.', error);
      if (abortFailure !== undefined) {
        this.logging.emit(OwnIDLogLevel.Error, source, 'OwnID instance abort failed.', abortFailure.cause);
      }
      throw error;
    }

    if (previous !== undefined) {
      this.disposeEntry(previous, source);
    }
    this.logging.emit(OwnIDLogLevel.Debug, source, 'OwnID initialized.');
  }

  destroy(name: string): void {
    const current = this.instances.get(name);
    if (current === undefined) {
      return;
    }

    this.instances.delete(name);
    this.disposeEntry(current, 'OwnID.destroy');
    this.logging.emit(OwnIDLogLevel.Debug, 'OwnID.destroy', 'OwnID destroyed.');
  }

  private assertIdentityAvailable(name: string, candidate: RuntimeConfiguration): void {
    for (const [existingName, entry] of this.instances) {
      if (existingName !== name && hasSameIdentity(entry.configuration, candidate)) {
        throw new InstanceIdentityConflictError(existingName);
      }
    }
  }

  private disposeEntry(entry: InstanceEntry, source: string): void {
    if (entry.abortController.signal.aborted) {
      return;
    }

    const failures: { readonly message: string; readonly cause: unknown }[] = [];
    try {
      entry.abortController.abort();
    } catch (cause) {
      failures.push({ message: 'OwnID instance abort failed.', cause });
    }

    try {
      entry.dispose();
    } catch (cause) {
      failures.push({ message: 'OwnID instance cleanup failed.', cause });
    }

    for (const failure of failures) {
      this.logging.emit(OwnIDLogLevel.Error, source, failure.message, failure.cause);
    }
  }
}

function hasSameIdentity(left: RuntimeConfiguration, right: RuntimeConfiguration): boolean {
  return left.env === right.env && left.region === right.region && left.appId === right.appId;
}
