import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AuthMethod, type AuthResult } from '../../../src/models/authentication';
import { ErrorCode } from '../../../src/models/error';
import {
  ELITE_PROTOCOL_CHANNEL,
  ELITE_PROTOCOL_VERSION,
  parseElitePageFrame,
  serializeEliteHostFrame,
  type EliteHostFrame,
} from '../../../src/flows/elite/protocol';

const documentToken = '00112233445566778899aabbccddeeff';
const base = { channel: ELITE_PROTOCOL_CHANNEL, version: ELITE_PROTOCOL_VERSION, documentMode: 'https', documentToken } as const;

function parse(value: unknown) {
  return parseElitePageFrame(JSON.stringify(value));
}

function serialize(value: unknown): string {
  return serializeEliteHostFrame(value as EliteHostFrame);
}

function assertInvalid(action: () => unknown): void {
  assert.throws(action, (error: unknown) => error instanceof TypeError && error.message === 'Invalid OwnID Elite protocol frame.');
}

describe('Elite page protocol parsing', () => {
  test('parses lifecycle frames from their required fields and tolerates additive fields', () => {
    const frames = [
      { ...base, kind: 'document-ready' },
      { ...base, documentMode: 'inline', kind: 'document-ready' },
      { ...base, kind: 'ready', future: true },
      { ...base, kind: 'start-issued' },
      { ...base, kind: 'start-settled', status: 'completed' },
      { ...base, kind: 'failure', phase: 'script-load', message: 'load failed' },
      {
        ...base,
        kind: 'failure',
        phase: 'initialization',
        message: 'init failed',
        details: { code: ErrorCode.INTEGRATION_ERROR, source: 'getCallSdk', additionalDetails: { method: 'init' } },
      },
    ];

    for (const frame of frames) assert.deepEqual(parse(frame), frame);
  });

  test('parses the four requests while preserving opaque and additive data', () => {
    const frames = [
      {
        ...base,
        kind: 'request',
        id: 1,
        method: 'events.onFinish',
        params: [
          { loginId: 'user@example.com', authType: AuthMethod.PASSKEY, source: 'mobile', authToken: 'token', future: true },
          'future',
        ],
      },
      {
        ...base,
        kind: 'request',
        id: 2,
        method: 'events.onError',
        params: ['Try again', { code: ErrorCode.NETWORK, source: 'Login', additionalDetails: { retryable: true }, future: true }, 'future'],
      },
      { ...base, kind: 'request', id: 3, method: 'events.onClose', params: ['future'], future: true },
      {
        ...base,
        kind: 'request',
        id: Number.MAX_SAFE_INTEGER,
        method: 'providers.session.create',
        params: [
          {
            metadata: {
              loginId: 'user@example.com',
              authType: AuthMethod.PASSKEY,
              proofTokens: { PasskeyAuth: 'proof' },
              future: true,
            },
            isNewUser: true,
            profile: null,
          },
          'future',
        ],
      },
    ];

    for (const frame of frames) assert.deepEqual(parse(frame), frame);
  });

  test('rejects malformed envelopes, methods, arities, and required payload fields', () => {
    const invalid: unknown[] = [
      null,
      [],
      { ...base, channel: 'ownid', kind: 'ready' },
      { ...base, version: 2, kind: 'ready' },
      { ...base, documentMode: undefined, kind: 'document-ready' },
      { ...base, documentMode: 'unknown', kind: 'document-ready' },
      { ...base, documentToken: 'not-a-token', kind: 'ready' },
      { ...base, kind: 'start-settled', status: 'failed' },
      { ...base, kind: 'failure', phase: 'protocol', message: 'bad' },
      { ...base, kind: 'request', id: 0, method: 'events.onClose', params: [] },
      { ...base, kind: 'request', id: 1.5, method: 'events.onClose', params: [] },
      { ...base, kind: 'request', id: 1, method: 'events.unknown', params: [] },
      { ...base, kind: 'request', id: 1, method: 'events.onFinish', params: [] },
      { ...base, kind: 'request', id: 1, method: 'events.onError', params: ['Error'] },
      { ...base, kind: 'request', id: 1, method: 'providers.session.create', params: [] },
      {
        ...base,
        kind: 'request',
        id: 1,
        method: 'events.onFinish',
        params: [{ loginId: 'user@example.com', authType: 'new-method', source: 'mobile' }],
      },
      {
        ...base,
        kind: 'request',
        id: 1,
        method: 'events.onError',
        params: ['Error', { code: 'new-code', source: 'Web' }],
      },
      {
        ...base,
        kind: 'request',
        id: 1,
        method: 'providers.session.create',
        params: [{ metadata: { loginId: 'user@example.com', authType: AuthMethod.PASSKEY, proofTokens: { Unknown: 'x' } } }],
      },
    ];

    assertInvalid(() => parseElitePageFrame('{'));
    for (const frame of invalid) assertInvalid(() => parse(frame));
  });
});

describe('Elite host protocol serialization', () => {
  test('serializes controls, void acknowledgements, results, and errors', () => {
    const result: AuthResult = { status: 'logged-in', result: { persisted: true } };
    const frames: EliteHostFrame[] = [
      { ...base, kind: 'start-permission' },
      { ...base, kind: 'abort' },
      { ...base, kind: 'response', id: 1 },
      { ...base, kind: 'response', id: 2, result },
      { ...base, kind: 'response', id: 3, error: { message: 'handler failed' } },
    ];

    for (const frame of frames) assert.deepEqual(JSON.parse(serializeEliteHostFrame(frame)), frame);
  });

  test('uses ordinary JSON object, array, toJSON, getter, and number semantics', () => {
    const inherited = Object.create({ inherited: 'ignored' }) as Record<string, unknown>;
    inherited.own = 'kept';
    const array = [1] as unknown[] & { extra?: string };
    array.extra = 'ignored';
    const withGetter = Object.defineProperty({}, 'value', { get: () => 'read', enumerable: true });

    const encoded = serialize({
      ...base,
      kind: 'response',
      id: 1,
      result: {
        status: 'logged-in',
        result: {
          absent: undefined,
          date: new Date('2026-01-02T03:04:05.000Z'),
          negativeZero: -0,
          inherited,
          array,
          withGetter,
          [Symbol('ignored')]: 'ignored',
        },
      },
    });

    assert.deepEqual(JSON.parse(encoded), {
      ...base,
      kind: 'response',
      id: 1,
      result: {
        status: 'logged-in',
        result: {
          date: '2026-01-02T03:04:05.000Z',
          negativeZero: 0,
          inherited: { own: 'kept' },
          array: [1],
          withGetter: { value: 'read' },
        },
      },
    });
  });

  test('rejects explicitly unsupported and lossy JSON values', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const sparse: unknown[] = [];
    sparse[1] = 'value';
    const values = [Number.NaN, Number.POSITIVE_INFINITY, 1n, Symbol('value'), () => undefined, cyclic, sparse, [undefined]];

    for (const value of values) {
      assertInvalid(() => serialize({ ...base, kind: 'response', id: 1, result: { status: 'logged-in', result: value } }));
    }
  });

  test('validates an application session result once before sending it to the page', () => {
    const invalidResults = [undefined, null, {}, { status: 'unknown' }, { status: 'auth-completed' }, { status: 'fail', reason: 42 }];

    for (const result of invalidResults) {
      assertInvalid(() => serialize({ ...base, kind: 'response', id: 1, result }));
    }

    assertInvalid(() =>
      serialize({
        ...base,
        kind: 'response',
        id: 1,
        result: { status: 'logged-in', toJSON: () => ({ status: 'unknown' }) },
      })
    );
    assert.deepEqual(
      JSON.parse(
        serialize({
          ...base,
          kind: 'response',
          id: 1,
          result: { status: 'unknown', toJSON: () => ({ status: 'success' }) },
        })
      ).result,
      { status: 'success' }
    );
  });
});
