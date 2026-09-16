import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { decideEliteNavigation, isEliteDocumentUrl, normalizeEliteOrigin } from '../../../src/flows/elite/origin';

function normalizeRuntimeInput(input: unknown): string {
  return normalizeEliteOrigin(input as string | undefined);
}

describe('Elite origin normalization', () => {
  test('applies the fallback and canonicalizes accepted origins idempotently', () => {
    const maxLabel = 'a'.repeat(63);
    const maxHost = `${maxLabel}.${maxLabel}.${maxLabel}.${'a'.repeat(61)}`;
    const cases: ReadonlyArray<readonly [unknown, string]> = [
      [undefined, 'https://webview.ownid.com'],
      ['https://login.example.com', 'https://login.example.com'],
      ['HTTPS://Login.Example.COM/', 'https://login.example.com'],
      ['https://login.example.com:443/', 'https://login.example.com'],
      ['https://login.example.com:00000443', 'https://login.example.com'],
      ['https://login.example.com:00080', 'https://login.example.com:80'],
      ['https://login.example.com:0', 'https://login.example.com:0'],
      ['https://login.example.com:65535', 'https://login.example.com:65535'],
      ['https://3com.example', 'https://3com.example'],
      ['https://intranet', 'https://intranet'],
      ['https://XN--E1AFMKFD.XN--P1AI/', 'https://xn--e1afmkfd.xn--p1ai'],
      [`https://${maxHost}/`, `https://${maxHost}`],
    ];

    for (const [input, expected] of cases) {
      const normalized = normalizeRuntimeInput(input);
      assert.equal(normalized, expected, String(input));
      assert.equal(normalizeEliteOrigin(normalized), normalized, `idempotence: ${String(input)}`);
    }
  });

  test('rejects values outside the narrow HTTPS DNS-origin grammar', () => {
    const tooLongLabel = 'a'.repeat(64);
    const maxLabel = 'a'.repeat(63);
    const tooLongHost = `${maxLabel}.${maxLabel}.${maxLabel}.${'a'.repeat(62)}`;
    const cases: readonly unknown[] = [
      null,
      7,
      '',
      ' https://example.com',
      'https://example.com ',
      'https://exam ple.com',
      'https://example.com\n',
      'http://example.com',
      'httpss://example.com',
      'https:/example.com',
      'https://user@example.com',
      'https://example.com/path',
      'https://example.com//',
      'https://example.com?query',
      'https://example.com#fragment',
      'https://example.com:',
      'https://example.com:+443',
      'https://example.com:-1',
      'https://example.com:44.3',
      'https://example.com:65536',
      'https://bücher.example',
      'https://%65xample.com',
      'https://127.0.0.1',
      'https://127.1',
      'https://0177.0.0.1',
      'https://0x7f000001',
      'https://2130706433',
      'https://[::1]',
      'https://example.123',
      'https://example.09',
      'https://example.0x',
      'https://example.0x12',
      'https://example..com',
      'https://example.com.',
      'https://_service.example',
      'https://-example.com',
      'https://example-.com',
      `https://${tooLongLabel}.example`,
      `https://${tooLongHost}`,
    ];

    for (const input of cases) {
      assert.throws(
        () => normalizeRuntimeInput(input),
        (error: unknown) =>
          error instanceof TypeError &&
          error.message === 'Invalid OwnID Elite origin: expected an HTTPS origin with an ASCII DNS host and optional port.',
        String(input)
      );
    }
  });
});

describe('Elite navigation policy', () => {
  test('allows embedded HTTPS documents without consuming the one initial top-document navigation', () => {
    const origin = 'https://login.example.com';
    let initialNavigationPending = true;
    const decide = (url: string, isTopFrame: boolean) => {
      const decision = decideEliteNavigation({ url, isTopFrame }, origin, initialNavigationPending);
      initialNavigationPending = decision.initialNavigationPending;
      return decision.allowed;
    };

    assert.equal(decide('https://idpay.example/frame', false), true);
    assert.equal(initialNavigationPending, true);
    assert.equal(decide('https://login.example.com/#waiting', true), true);
    assert.equal(initialNavigationPending, true);
    assert.equal(decide('https://login.example.com', true), true);
    assert.equal(initialNavigationPending, false);

    assert.equal(decide('https://idpay.example/next', false), true);
    assert.equal(decide('https://login.example.com/#capture', true), true);
    assert.equal(decide('https://login.example.com/', true), false);
    assert.equal(decide('https://external.example', true), false);
    assert.equal(decide('https://login.example.com.evil.example', true), false);
    assert.equal(decide('file:///tmp/elite.html', true), false);
  });

  test('recognizes only the exact generated document and its fragment locations', () => {
    const origin = 'https://login.example.com';

    for (const url of [origin, `${origin}/`, `${origin}#step`, `${origin}/#step`]) {
      assert.equal(isEliteDocumentUrl(url, origin), true, url);
    }
    for (const url of [`${origin}/path`, `${origin}?query`, `${origin}.evil.example`, 'file:///tmp/elite.html']) {
      assert.equal(isEliteDocumentUrl(url, origin), false, url);
    }
  });
});
