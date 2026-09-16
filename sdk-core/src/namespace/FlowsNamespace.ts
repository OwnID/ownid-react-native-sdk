import type { OwnIDContext } from '../context';
import type { OwnIDProviders } from '../providers';
import { createEliteNamespace } from '../flows/elite/namespace';
import type { OwnIDEliteNamespace } from '../flows/elite/namespace';
import { withContext, withProviders } from './scoping';
import type { NamespaceBinding } from './scoping';

/**
 * OwnID authentication flows with selected Context and provider callbacks.
 *
 * Apply Context or providers before selecting a flow. Reinitializing or destroying OwnID makes methods on previously obtained `OwnIDFlows`
 * objects throw an `Error`; read `OwnID.flows` again before starting more work.
 */
export interface OwnIDFlows {
  /** Hosted Elite authentication flow using this object's Context and providers. */
  readonly elite: OwnIDEliteNamespace;

  /**
   * Returns a new `OwnIDFlows` object using the complete supplied Context.
   *
   * This object remains unchanged. An empty Context masks inherited values.
   *
   * @throws TypeError when Context is not an object or `loginId` is not a string, `null`, or `undefined`.
   */
  withContext(context: OwnIDContext): OwnIDFlows;

  /**
   * Returns a new `OwnIDFlows` object overriding the supplied provider callbacks.
   *
   * This object remains unchanged. An input with no supplied provider members returns this object unchanged.
   *
   * Omitted callbacks remain inherited and cannot clear an inherited callback.
   *
   * @throws TypeError when a provider group is invalid or a supplied provider member is not a supported callback.
   */
  withProviders(providers: OwnIDProviders): OwnIDFlows;
}

export function createFlowsNamespace(binding: NamespaceBinding): OwnIDFlows {
  const namespace: OwnIDFlows = {
    elite: createEliteNamespace(binding),
    withContext(context: OwnIDContext): OwnIDFlows {
      return withContext(binding, context, createFlowsNamespace);
    },
    withProviders(providers: OwnIDProviders): OwnIDFlows {
      return withProviders(namespace, binding, providers, createFlowsNamespace);
    },
  };
  return Object.freeze(namespace);
}
