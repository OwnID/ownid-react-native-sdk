import type { Container } from '../di';
import type { OwnIDContext } from '../context';
import { clearContext, ContextToken, createContextScope, prepareContext, prepareContextPatch, setContext } from '../context';
import type { OwnIDProviders } from '../providers';
import { createProvidersScope, prepareProviders, setProviders } from '../providers/internal';

export interface NamespaceBinding {
  readonly scope: Container;
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
}

export function createNamespaceBinding(scope: Container, signal: AbortSignal, isCurrent: () => boolean): NamespaceBinding {
  return Object.freeze({ scope, signal, isCurrent });
}

export function withContext<Self>(binding: NamespaceBinding, context: OwnIDContext, rebind: (binding: NamespaceBinding) => Self): Self {
  assertNamespaceBindingAvailable(binding);
  const prepared = prepareContext(context);
  assertNamespaceBindingAvailable(binding);
  return rebind(rebindScope(binding, createContextScope(binding.scope, prepared)));
}

export function withProviders<Self>(
  current: Self,
  binding: NamespaceBinding,
  providers: OwnIDProviders,
  rebind: (binding: NamespaceBinding) => Self
): Self {
  assertNamespaceBindingAvailable(binding);
  const prepared = prepareProviders(providers);
  assertNamespaceBindingAvailable(binding);
  const scope = createProvidersScope(binding.scope, prepared);
  return scope === binding.scope ? current : rebind(rebindScope(binding, scope));
}

export function patchContext<Self>(current: Self, binding: NamespaceBinding, patch: OwnIDContext): Self {
  assertNamespaceBindingAvailable(binding);
  const prepared = prepareContextPatch(binding.scope.resolveOptional(ContextToken), patch);
  assertNamespaceBindingAvailable(binding);
  setContext(binding.scope, prepared);
  return current;
}

export function removeContext<Self>(current: Self, binding: NamespaceBinding): Self {
  assertNamespaceBindingAvailable(binding);
  clearContext(binding.scope);
  return current;
}

export function patchProviders<Self>(current: Self, binding: NamespaceBinding, providers: OwnIDProviders): Self {
  assertNamespaceBindingAvailable(binding);
  const prepared = prepareProviders(providers);
  assertNamespaceBindingAvailable(binding);
  setProviders(binding.scope, prepared);
  return current;
}

export function assertNamespaceBindingAvailable(binding: NamespaceBinding): void {
  if (binding.signal.aborted || !binding.isCurrent()) {
    throw new Error('OwnID namespace is no longer active. Reacquire it from OwnID.');
  }
}

function rebindScope(binding: NamespaceBinding, scope: Container): NamespaceBinding {
  return Object.freeze({ ...binding, scope });
}
