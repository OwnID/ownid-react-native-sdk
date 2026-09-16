import { AuthMethod, type AuthResult, type LoginPayload } from '../../models/authentication';
import { ErrorCode, type ErrorDetails } from '../../models/error';
import { OperationType } from '../../models/operation';
import type { OwnIDEliteFinishParams } from './events';

export const ELITE_PROTOCOL_CHANNEL = 'ownid.elite' as const;
export const ELITE_PROTOCOL_VERSION = 1 as const;

type EliteFrameBase = Readonly<{
  channel: typeof ELITE_PROTOCOL_CHANNEL;
  version: typeof ELITE_PROTOCOL_VERSION;
  documentToken: string;
}>;

export type ElitePageRequest =
  | (EliteFrameBase &
      Readonly<{ kind: 'request'; id: number; method: 'events.onFinish'; params: readonly [OwnIDEliteFinishParams, ...unknown[]] }>)
  | (EliteFrameBase &
      Readonly<{ kind: 'request'; id: number; method: 'events.onError'; params: readonly [string, ErrorDetails, ...unknown[]] }>)
  | (EliteFrameBase & Readonly<{ kind: 'request'; id: number; method: 'events.onClose'; params: readonly unknown[] }>)
  | (EliteFrameBase &
      Readonly<{ kind: 'request'; id: number; method: 'providers.session.create'; params: readonly [LoginPayload, ...unknown[]] }>);

export type ElitePageFrame =
  | (EliteFrameBase & Readonly<{ kind: 'ready' }>)
  | (EliteFrameBase & Readonly<{ kind: 'start-issued' }>)
  | (EliteFrameBase & Readonly<{ kind: 'start-settled'; status: 'completed' }>)
  | (EliteFrameBase &
      Readonly<{ kind: 'failure'; phase: 'script-load' | 'initialization' | 'start'; message: string; details?: ErrorDetails }>)
  | ElitePageRequest;

export type EliteHostFramePayload =
  | Readonly<{ kind: 'start-permission' }>
  | Readonly<{ kind: 'abort' }>
  | Readonly<{ kind: 'response'; id: number; result?: AuthResult; error?: never }>
  | Readonly<{ kind: 'response'; id: number; error: Readonly<{ message: string }>; result?: never }>;

export type EliteHostFrame = EliteFrameBase & EliteHostFramePayload;

const DOCUMENT_TOKEN_PATTERN = /^[0-9a-f]{32}$/;
const authMethods = new Set<string>(Object.values(AuthMethod));
const errorCodes = new Set<string>(Object.values(ErrorCode));
const operationTypes = new Set<string>(Object.values(OperationType));

export function parseElitePageFrame(data: string): ElitePageFrame {
  if (typeof data !== 'string') throw invalidFrame();

  let value: unknown;
  try {
    value = JSON.parse(data) as unknown;
  } catch {
    throw invalidFrame();
  }

  if (!isRecord(value) || !hasValidBase(value) || typeof value.kind !== 'string') throw invalidFrame();

  switch (value.kind) {
    case 'ready':
    case 'start-issued':
      break;
    case 'start-settled':
      if (value.status !== 'completed') throw invalidFrame();
      break;
    case 'failure':
      parseFailure(value);
      break;
    case 'request':
      parseRequest(value);
      break;
    default:
      throw invalidFrame();
  }

  return value as ElitePageFrame;
}

export function serializeEliteHostFrame(frame: EliteHostFrame): string {
  try {
    const hasResult = frame.kind === 'response' && Object.prototype.hasOwnProperty.call(frame, 'result');
    const serialized = JSON.stringify(frame, rejectUnsupportedJsonValue);
    if (serialized === undefined) throw invalidFrame();
    if (hasResult) {
      const wireFrame = JSON.parse(serialized) as unknown;
      if (!isRecord(wireFrame) || !Object.prototype.hasOwnProperty.call(wireFrame, 'result') || !isAuthResult(wireFrame.result)) {
        throw invalidFrame();
      }
    }
    return serialized;
  } catch {
    throw invalidFrame();
  }
}

function parseFailure(value: Record<string, unknown>): void {
  if (
    (value.phase !== 'script-load' && value.phase !== 'initialization' && value.phase !== 'start') ||
    typeof value.message !== 'string' ||
    (hasDefined(value, 'details') && !isErrorDetails(value.details))
  ) {
    throw invalidFrame();
  }
}

function parseRequest(value: Record<string, unknown>): void {
  if (!isRequestId(value.id) || typeof value.method !== 'string' || !Array.isArray(value.params)) throw invalidFrame();

  switch (value.method) {
    case 'events.onFinish':
      if (value.params.length < 1 || !isFinishParams(value.params[0])) throw invalidFrame();
      break;
    case 'events.onError':
      if (value.params.length < 2 || typeof value.params[0] !== 'string' || !isErrorDetails(value.params[1])) throw invalidFrame();
      break;
    case 'events.onClose':
      break;
    case 'providers.session.create':
      if (value.params.length < 1 || !isLoginPayload(value.params[0])) throw invalidFrame();
      break;
    default:
      throw invalidFrame();
  }
}

function hasValidBase(value: Record<string, unknown>): boolean {
  return (
    value.channel === ELITE_PROTOCOL_CHANNEL &&
    value.version === ELITE_PROTOCOL_VERSION &&
    typeof value.documentToken === 'string' &&
    DOCUMENT_TOKEN_PATTERN.test(value.documentToken)
  );
}

function isRequestId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isFinishParams(value: unknown): value is OwnIDEliteFinishParams {
  return (
    isRecord(value) &&
    typeof value.loginId === 'string' &&
    typeof value.authType === 'string' &&
    authMethods.has(value.authType) &&
    (value.source === 'mobile' || value.source === 'desktop') &&
    (!hasDefined(value, 'authToken') || typeof value.authToken === 'string')
  );
}

function isErrorDetails(value: unknown): value is ErrorDetails {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    errorCodes.has(value.code) &&
    typeof value.source === 'string' &&
    (!hasDefined(value, 'additionalDetails') ||
      typeof value.additionalDetails === 'string' ||
      (typeof value.additionalDetails === 'object' && value.additionalDetails !== null))
  );
}

function isLoginPayload(value: unknown): value is LoginPayload {
  if (!isRecord(value) || !isRecord(value.metadata)) return false;
  const metadata = value.metadata;
  if (
    typeof metadata.loginId !== 'string' ||
    typeof metadata.authType !== 'string' ||
    !authMethods.has(metadata.authType) ||
    (hasDefined(metadata, 'authToken') && typeof metadata.authToken !== 'string')
  ) {
    return false;
  }

  if (!hasDefined(metadata, 'proofTokens')) return true;
  if (!isRecord(metadata.proofTokens)) return false;
  return Object.entries(metadata.proofTokens).every(([operation, token]) => operationTypes.has(operation) && typeof token === 'string');
}

function isAuthResult(value: unknown): value is AuthResult {
  if (!isRecord(value) || typeof value.status !== 'string') return false;
  switch (value.status) {
    case 'logged-in':
    case 'success':
      return true;
    case 'auth-completed':
      return hasDefined(value, 'sessionPayload');
    case 'fail':
      return !hasDefined(value, 'reason') || typeof value.reason === 'string';
    default:
      return false;
  }
}

function rejectUnsupportedJsonValue(this: unknown, _key: string, value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) throw invalidFrame();
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') throw invalidFrame();
  if (Array.isArray(this) && value === undefined) throw invalidFrame();
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasDefined(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined;
}

function invalidFrame(): TypeError {
  return new TypeError('Invalid OwnID Elite protocol frame.');
}
