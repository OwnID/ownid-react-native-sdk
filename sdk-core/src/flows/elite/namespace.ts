import { assertNamespaceBindingAvailable } from '../../namespace/scoping';
import type { NamespaceBinding } from '../../namespace/scoping';

declare const eliteNamespaceBrand: unique symbol;

/**
 * Elite flow selected through `OwnID.flows.elite` or an `OwnIDFlows` object with selected Context and providers.
 *
 * `OwnIDEliteView` reads the current Context and providers when it mounts. To use different values, call `withContext` or `withProviders` on an
 * `OwnIDFlows` object before selecting `elite`, or update the `OwnIDInstance` from which the flow was selected before mounting the View.
 */
export interface OwnIDEliteNamespace {
  readonly [eliteNamespaceBrand]: true;
}

const bindings = new WeakMap<OwnIDEliteNamespace, NamespaceBinding>();

export function createEliteNamespace(binding: NamespaceBinding): OwnIDEliteNamespace {
  const namespace = Object.freeze({}) as OwnIDEliteNamespace;
  bindings.set(namespace, binding);
  return namespace;
}

export function getEliteNamespaceBinding(namespace: OwnIDEliteNamespace): NamespaceBinding {
  const binding = bindings.get(namespace);
  if (binding === undefined) {
    throw new TypeError('OwnID Elite namespace was not created by this SDK.');
  }

  assertNamespaceBindingAvailable(binding);
  return binding;
}
