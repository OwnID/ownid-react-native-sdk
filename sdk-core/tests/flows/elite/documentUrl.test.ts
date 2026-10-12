import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  decideEliteNavigation,
  isEliteDocumentOrigin,
  isEliteDocumentUrl,
  normalizeEliteUrl,
  resolveEliteDocumentUrl,
  type EliteUrl,
} from '../../../src/flows/elite/documentUrl';

function normalizeRuntimeInput(input: unknown): EliteUrl {
  return normalizeEliteUrl(input as string | undefined);
}

describe('Elite document URL selection', () => {
  test('uses platform paths only for a bare host or root without query', () => {
    for (const path of ['/.well-known/assetlinks.json', '/.well-known/apple-app-site-association']) {
      for (const input of ['https://Login.Example.com:8443', 'https://Login.Example.com:8443/']) {
        assert.deepEqual(resolveEliteDocumentUrl(input, path), {
          url: `https://login.example.com:8443${path}`,
          origin: 'https://login.example.com:8443',
        });
      }
      for (const input of [
        'https://login.example.com:8443/Elite?x=1',
        'https://login.example.com:8443/Elite',
        'https://login.example.com:8443?x=1',
        'https://login.example.com:8443/?x=1',
        'https://login.example.com:8443/?',
      ]) {
        assert.deepEqual(resolveEliteDocumentUrl(input, path), normalizeEliteUrl(input), input);
      }
    }
  });

  test('preserves strict HTTPS validation before selecting a platform URL', () => {
    for (const path of ['/.well-known/assetlinks.json', '/.well-known/apple-app-site-association']) {
      for (const input of [
        undefined,
        'http://login.example.com',
        'https://user@login.example.com',
        'https://127.0.0.1',
        'https://login.example.com/#fragment',
      ]) {
        assert.throws(() => resolveEliteDocumentUrl(input, path), TypeError);
      }
    }
  });
});

describe('Elite HTTPS URL normalization', () => {
  test('separates the complete navigation URL from its security origin', () => {
    const maxLabel = 'a'.repeat(63);
    const maxHost = `${maxLabel}.${maxLabel}.${maxLabel}.${'a'.repeat(61)}`;
    const cases: ReadonlyArray<readonly [string, string, string]> = [
      ['https://login.example.com', 'https://login.example.com/', 'https://login.example.com'],
      ['HTTPS://Login.Example.COM/', 'https://login.example.com/', 'https://login.example.com'],
      ['https://login.example.com:443/', 'https://login.example.com/', 'https://login.example.com'],
      ['https://login.example.com:00000443', 'https://login.example.com/', 'https://login.example.com'],
      ['https://login.example.com:00080/path', 'https://login.example.com:80/path', 'https://login.example.com:80'],
      ['https://login.example.com:0', 'https://login.example.com:0/', 'https://login.example.com:0'],
      ['https://login.example.com:000000000', 'https://login.example.com:0/', 'https://login.example.com:0'],
      ['https://login.example.com:0000065535', 'https://login.example.com:65535/', 'https://login.example.com:65535'],
      ['https://login.example.com:65535', 'https://login.example.com:65535/', 'https://login.example.com:65535'],
      ['https://3com.example', 'https://3com.example/', 'https://3com.example'],
      ['https://intranet', 'https://intranet/', 'https://intranet'],
      ['https://XN--E1AFMKFD.XN--P1AI/', 'https://xn--e1afmkfd.xn--p1ai/', 'https://xn--e1afmkfd.xn--p1ai'],
      [`https://${maxHost}/`, `https://${maxHost}/`, `https://${maxHost}`],
      [
        'https://login.example.com/Account/Elite?b=2&a=1&a=3',
        'https://login.example.com/Account/Elite?b=2&a=1&a=3',
        'https://login.example.com',
      ],
      ['https://login.example.com?next=%2Flogin&x=a+b', 'https://login.example.com/?next=%2Flogin&x=a+b', 'https://login.example.com'],
      ['https://login.example.com//path/%2f?', 'https://login.example.com//path/%2f?', 'https://login.example.com'],
    ];

    for (const [input, url, origin] of cases) {
      const normalized = normalizeEliteUrl(input);
      assert.deepEqual(normalized, { url, origin }, input);
      assert.deepEqual(normalizeEliteUrl(normalized.url), normalized, `idempotence: ${input}`);
      assert.equal(normalized.url, new URL(input).href, `WHATWG serialization: ${input}`);
      assert.equal(normalized.origin, new URL(input).origin, `WHATWG origin: ${input}`);
    }
  });

  test('matches browser path and query serialization without decoding encoded separators or reordering query parameters', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['/a/./b', '/a/b'],
      ['/a/../b', '/b'],
      ['/a/..', '/'],
      ['/a/.', '/a/'],
      ['/../../b', '/b'],
      ['/a//../b', '/a/b'],
      ['/a/%2e/b', '/a/b'],
      ['/a/.%2E/b', '/b'],
      ['/a/%2e./b', '/b'],
      ['/a/%2E%2e/b', '/b'],
      ['/%2e', '/'],
      ['/a/%2F/b?b=2&a=1&a=3', '/a/%2F/b?b=2&a=1&a=3'],
      ['/a/%23/b?next=https://example.org/a?b=1', '/a/%23/b?next=https://example.org/a?b=1'],
      ['/a"<>^`{}/b?x="<>\'`{}^', '/a%22%3C%3E%5E%60%7B%7D/b?x=%22%3C%3E%27`{}^'],
      ['/path?x=%27&y=+&z=%20', '/path?x=%27&y=+&z=%20'],
      ['/path?x=%zz', '/path?x=%zz'],
      ['?', '/?'],
      ['?next=/page?value=1?extra', '/?next=/page?value=1?extra'],
      ['/path??value=1', '/path??value=1'],
    ];
    for (const [suffix, expectedSuffix] of cases) {
      const input = `https://login.example.com${suffix}`;
      const normalized = normalizeEliteUrl(input).url;
      assert.equal(normalized, `https://login.example.com${expectedSuffix}`, input);
      assert.equal(normalized, new URL(input).href, `WHATWG serialization: ${input}`);
    }
  });

  test('requires a URL and preserves the existing ASCII DNS, port, and credential restrictions', () => {
    const tooLongLabel = 'a'.repeat(64);
    const maxLabel = 'a'.repeat(63);
    const tooLongHost = `${maxLabel}.${maxLabel}.${maxLabel}.${'a'.repeat(62)}`;
    // noinspection HttpUrlsUsage -- These inputs must include insecure URLs to verify rejection.
    const cases: readonly unknown[] = [
      undefined,
      null,
      7,
      '',
      ' https://example.com',
      'https://example.com ',
      'https://exam ple.com',
      'https://example.com\n',
      'https://example.com/path with spaces',
      'http://example.com',
      'httpss://example.com',
      'https:/example.com',
      'https://user@example.com',
      'https://user:pass@example.com/path',
      'https://example.com#fragment',
      'https://example.com/path?query#fragment',
      'https://example.com\\evil',
      'https://example.com/path\\next',
      'https://example.com:',
      'https://example.com:+443',
      'https://example.com:-1',
      'https://example.com:44.3',
      'https://example.com:65536',
      'https://example.com:0000065536',
      'https://example.com:999999999999999999999999999999',
      'https://example.com?query\\next',
      'https://bücher.example',
      'https://example.com/é',
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
        (error: unknown) => error instanceof TypeError && error.message.startsWith('Invalid OwnID Elite origin:'),
        String(input)
      );
    }
  });
});

describe('Elite navigation policy', () => {
  const documentUrl = normalizeEliteUrl('https://login.example.com/Account/Elite?b=2&a=1').url;

  test('allows only one exact initial top-document navigation, then fragments of that document', () => {
    let initialNavigationPending = true;
    const decide = (url: string, isTopFrame: boolean) => {
      const decision = decideEliteNavigation({ url, isTopFrame }, documentUrl, initialNavigationPending);
      initialNavigationPending = decision.initialNavigationPending;
      return decision.allowed;
    };

    assert.equal(decide('https://idpay.example/frame', false), true);
    assert.equal(initialNavigationPending, true);
    assert.equal(decide(`${documentUrl}#waiting`, true), true);
    assert.equal(initialNavigationPending, true);
    for (const url of ['https://login.example.com/', 'https://login.example.com/other?b=2&a=1', 'https://external.example/']) {
      assert.equal(decide(url, true), false, url);
      assert.equal(initialNavigationPending, true);
    }
    assert.equal(decide(documentUrl, true), true);
    assert.equal(initialNavigationPending, false);
    assert.equal(decide('https://idpay.example/next', false), true);
    assert.equal(decide(`${documentUrl}#capture`, true), true);
    assert.equal(decide(documentUrl, true), false);
    assert.equal(decide('https://login.example.com/Account/Elite?a=1&b=2', true), false);
  });

  test('recognizes the complete document URL including path and query, with browser-equivalent authority serialization', () => {
    for (const url of [documentUrl, `${documentUrl}#step`, 'HTTPS://LOGIN.EXAMPLE.COM:443/Account/Elite?b=2&a=1']) {
      assert.equal(isEliteDocumentUrl(url, documentUrl), true, url);
    }
    // noinspection HttpUrlsUsage -- These inputs must include insecure URLs to verify rejection.
    for (const url of [
      'https://login.example.com/',
      'https://login.example.com/Account/Elite',
      'https://login.example.com/account/Elite?b=2&a=1',
      'https://login.example.com/Account/Elite?a=1&b=2',
      'https://login.example.com/Account/Elite?b=2&a=1&x=3',
      'https://login.example.com.evil.example/Account/Elite?b=2&a=1',
      'http://login.example.com/Account/Elite?b=2&a=1',
      'file:///tmp/elite.html',
    ]) {
      assert.equal(isEliteDocumentUrl(url, documentUrl), false, url);
    }
    const rootUrl = normalizeEliteUrl('https://login.example.com').url;
    assert.equal(isEliteDocumentUrl('https://login.example.com', rootUrl), true);
    assert.equal(isEliteDocumentUrl('https://login.example.com/#step', rootUrl), true);
  });

  test('matches Android message origins and iOS full document URLs against the document origin', () => {
    for (const actualUrl of [
      'https://login.example.com',
      'https://login.example.com/',
      'HTTPS://LOGIN.EXAMPLE.COM:443',
      documentUrl,
      `${documentUrl}#step`,
      'https://login.example.com/another/page?value=1',
    ]) {
      assert.equal(isEliteDocumentOrigin(actualUrl, documentUrl), true, actualUrl);
    }
    // noinspection HttpUrlsUsage -- These inputs must include insecure URLs to verify rejection.
    for (const actualUrl of [
      'https://external.example',
      'https://login.example.com:444',
      'https://login.example.com.evil.example/Account/Elite?b=2&a=1',
      'https://user@login.example.com',
      'http://login.example.com',
      'null',
      '',
    ]) {
      assert.equal(isEliteDocumentOrigin(actualUrl, documentUrl), false, actualUrl);
    }
    assert.equal(isEliteDocumentOrigin(documentUrl, 'invalid expected URL'), false);
    assert.equal(isEliteDocumentOrigin(documentUrl, `${documentUrl}#step`), false);
    assert.equal(isEliteDocumentUrl(documentUrl, `${documentUrl}#step`), false);
  });

  test('applies the main-document policy when Android omits isTopFrame', () => {
    for (const url of ['https://login.example.com/redirected', 'https://external.example/', `${documentUrl}&extra=1#step`]) {
      assert.deepEqual(decideEliteNavigation({ url }, documentUrl, true), {
        allowed: false,
        initialNavigationPending: true,
      });
    }
    assert.deepEqual(decideEliteNavigation({ url: documentUrl }, documentUrl, true), {
      allowed: true,
      initialNavigationPending: false,
    });
    assert.deepEqual(decideEliteNavigation({ url: documentUrl }, documentUrl, false), {
      allowed: false,
      initialNavigationPending: false,
    });
    assert.deepEqual(decideEliteNavigation({ url: `${documentUrl}#step` }, documentUrl, false), {
      allowed: true,
      initialNavigationPending: false,
    });
    assert.equal(decideEliteNavigation({ url: 'https://external.example/' }, documentUrl, false).allowed, false);
  });
});
