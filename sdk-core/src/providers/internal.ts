import { createToken } from '../di';
import type { Container } from '../di';
import type { OwnIDProviders } from './index';

export interface SessionCreateProvider {
  readonly create: NonNullable<NonNullable<OwnIDProviders['session']>['create']>;
}

export const SessionCreateProviderToken = createToken<SessionCreateProvider>('ownid.providers.session.create');

export interface PreparedProviders {
  readonly sessionCreate?: SessionCreateProvider;
}

const EMPTY_PROVIDERS: PreparedProviders = Object.freeze({});

export function createProvidersScope(parent: Container, providers: PreparedProviders): Container {
  if (providers.sessionCreate === undefined) {
    return parent;
  }

  const child = parent.createChild('ownid.scope.providers');
  setProviders(child, providers);
  return child;
}

export function setProviders(scope: Container, providers: PreparedProviders): void {
  if (providers.sessionCreate !== undefined) {
    scope.registerValue(SessionCreateProviderToken, providers.sessionCreate);
  }
}

export function prepareProviders(providers: OwnIDProviders): PreparedProviders {
  assertRecord(providers, 'providers');

  const session = providers.session;
  if (session === undefined) {
    return EMPTY_PROVIDERS;
  }
  assertRecord(session, 'providers.session');

  const sessionCreate: unknown = session.create;
  if (sessionCreate === undefined) {
    return EMPTY_PROVIDERS;
  }
  if (typeof sessionCreate !== 'function') {
    throw new TypeError('OwnID providers.session.create must be a function or undefined.');
  }
  const then: unknown = (sessionCreate as { readonly then?: unknown }).then;
  if (typeof then === 'function') {
    throw new TypeError('OwnID providers.session.create must not be thenable.');
  }

  return Object.freeze({ sessionCreate: createSessionCreateProvider(sessionCreate as SessionCreateProvider['create']) });
}

function createSessionCreateProvider(create: SessionCreateProvider['create']): SessionCreateProvider {
  const provider = Object.create(null) as SessionCreateProvider;
  Object.defineProperty(provider, 'create', { enumerable: true, value: create });
  return Object.freeze(provider);
}

function assertRecord(value: unknown, name: string): asserts value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`OwnID ${name} must be an object.`);
  }
}
