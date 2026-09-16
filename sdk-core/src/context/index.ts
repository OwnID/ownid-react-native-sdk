import { createToken } from '../di';
import type { Container } from '../di';

/** Application-supplied values used by OwnID authentication. */
export interface OwnIDContext {
  /**
   * Login identifier used when starting authentication for a known user.
   *
   * The value is stored without login-ID syntax validation. `withContext` replaces the full Context: omitting `loginId`, including
   * `withContext({})`, or setting `loginId` to `undefined` or `null` masks an inherited login ID. `setContext` keeps the current value when
   * `loginId` is omitted or `undefined`; `null` clears it without restoring an inherited value.
   */
  readonly loginId?: string | null;
}

export interface ContextValue {
  readonly loginId?: string;
}

export const ContextToken = createToken<ContextValue>('ownid.context');

const EMPTY_CONTEXT: ContextValue = Object.freeze({});

export function prepareContext(context: OwnIDContext): ContextValue {
  assertRecord(context, 'context');
  const loginId = hasOwn(context, 'loginId') ? context.loginId : undefined;
  return loginId === undefined || loginId === null ? EMPTY_CONTEXT : freezeContext(assertLoginId(loginId));
}

export function prepareContextPatch(visible: ContextValue | undefined, patch: OwnIDContext): ContextValue {
  assertRecord(patch, 'patch');
  const loginId = hasOwn(patch, 'loginId') ? patch.loginId : undefined;

  if (loginId === undefined) {
    return visible === undefined ? EMPTY_CONTEXT : freezeContext(visible.loginId);
  }

  return loginId === null ? EMPTY_CONTEXT : freezeContext(assertLoginId(loginId));
}

export function createContextScope(parent: Container, context: ContextValue): Container {
  const child = parent.createChild('ownid.scope.context');
  child.registerValue(ContextToken, context);
  return child;
}

export function setContext(scope: Container, context: ContextValue): void {
  scope.registerValue(ContextToken, context);
}

export function clearContext(scope: Container): void {
  scope.removeLocal(ContextToken);
}

function freezeContext(loginId: string | undefined): ContextValue {
  return loginId === undefined ? EMPTY_CONTEXT : Object.freeze({ loginId });
}

function assertLoginId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('OwnID Context loginId must be a string, null, or undefined.');
  }

  return value;
}

function assertRecord(value: unknown, name: string): asserts value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`OwnID ${name} must be an object.`);
  }
}

function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}
