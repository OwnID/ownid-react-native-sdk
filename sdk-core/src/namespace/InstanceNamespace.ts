import type { OwnIDContext } from '../context';
import type { OwnIDProviders } from '../providers';
import { createFlowsNamespace } from './FlowsNamespace';
import type { OwnIDFlows } from './FlowsNamespace';
import { createNamespaceBinding, patchContext, patchProviders, removeContext, withContext, withProviders } from './scoping';
import type { NamespaceBinding } from './scoping';

/**
 * Configured OwnID SDK instance.
 *
 * Its current public API provides authentication flows and methods to configure Context and providers.
 *
 * An `OwnIDInstance` remains associated with the OwnID initialization from which it was obtained. Reinitializing or destroying OwnID makes
 * its methods throw an `Error`; obtain a new instance through `OwnID` before starting more work.
 */
export interface OwnIDInstance {
  /** Authentication flows using this object's Context and providers. */
  readonly flows: OwnIDFlows;

  /**
   * Returns a new `OwnIDInstance` using the complete supplied Context while leaving this object unchanged.
   *
   * @throws TypeError when Context is not an object or `loginId` is not a string, `null`, or `undefined`.
   */
  withContext(context: OwnIDContext): OwnIDInstance;

  /**
   * Updates the Context used by this object and returns this object.
   *
   * Omitted fields keep their current values. A `null` field clears that value without restoring an inherited value.
   *
   * @throws TypeError when the patch is not an object or `loginId` is not a string, `null`, or `undefined`. Failure leaves Context unchanged.
   */
  setContext(patch: OwnIDContext): OwnIDInstance;

  /** Clears this object's Context override, restores any inherited Context, and returns this object. */
  clearContext(): OwnIDInstance;

  /**
   * Returns a new `OwnIDInstance` overriding supplied provider callbacks, or this object when none are supplied.
   *
   * Omitted callbacks remain inherited and cannot clear an inherited callback.
   *
   * @throws TypeError when a provider group is invalid or a supplied provider member is not a supported callback.
   */
  withProviders(providers: OwnIDProviders): OwnIDInstance;

  /**
   * Updates supplied provider callbacks used by this object and returns this object.
   *
   * Omitted callbacks remain unchanged and cannot be cleared with `undefined`.
   *
   * @throws TypeError when a provider group is invalid or a supplied provider member is not a supported callback. Failure leaves providers
   * unchanged.
   */
  setProviders(providers: OwnIDProviders): OwnIDInstance;
}

export function createInstanceNamespace(scope: NamespaceBinding['scope'], signal: AbortSignal, isCurrent: () => boolean): OwnIDInstance {
  return createBoundInstanceNamespace(createNamespaceBinding(scope, signal, isCurrent));
}

function createBoundInstanceNamespace(binding: NamespaceBinding): OwnIDInstance {
  const namespace: OwnIDInstance = {
    flows: createFlowsNamespace(binding),
    withContext(context: OwnIDContext): OwnIDInstance {
      return withContext(binding, context, createBoundInstanceNamespace);
    },
    setContext(patch: OwnIDContext): OwnIDInstance {
      return patchContext(namespace, binding, patch);
    },
    clearContext(): OwnIDInstance {
      return removeContext(namespace, binding);
    },
    withProviders(providers: OwnIDProviders): OwnIDInstance {
      return withProviders(namespace, binding, providers, createBoundInstanceNamespace);
    },
    setProviders(providers: OwnIDProviders): OwnIDInstance {
      return patchProviders(namespace, binding, providers);
    },
  };
  return Object.freeze(namespace);
}
