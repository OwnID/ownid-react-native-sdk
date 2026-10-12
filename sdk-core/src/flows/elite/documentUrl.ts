const URL_PATTERN = /^https:\/\/([^/:?#@\\]+)(?::([0-9]+))?(\/[^?#\\]*)?(\?[^#\\]*)?$/i;
const DNS_LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const DECIMAL_LABEL_PATTERN = /^[0-9]+$/;
const HEXADECIMAL_LABEL_PATTERN = /^0x[0-9a-f]*$/i;
const PRINTABLE_ASCII_PATTERN = /^[\x21-\x7e]+$/;

export type EliteUrl = Readonly<{ url: string; origin: string }>;

export function normalizeEliteUrl(input: string | undefined): EliteUrl {
  if (typeof input !== 'string' || !PRINTABLE_ASCII_PATTERN.test(input)) {
    throw invalidUrl();
  }

  const match = URL_PATTERN.exec(input);
  if (match === null || match[0].length !== input.length) {
    throw invalidUrl();
  }

  const host = match[1];
  if (host === undefined || host.length > 253) {
    throw invalidUrl();
  }

  const labels = host.split('.');
  if (labels.some((label) => !DNS_LABEL_PATTERN.test(label))) {
    throw invalidUrl();
  }

  const finalLabel = labels[labels.length - 1];
  if (finalLabel === undefined || DECIMAL_LABEL_PATTERN.test(finalLabel) || HEXADECIMAL_LABEL_PATTERN.test(finalLabel)) {
    throw invalidUrl();
  }

  const port = match[2];
  let portSuffix = '';
  if (port !== undefined) {
    const portNumber = Number(port);
    if (portNumber > 65_535) {
      throw invalidUrl();
    }
    if (portNumber !== 443) portSuffix = `:${portNumber}`;
  }

  const origin = `https://${host.toLowerCase()}${portSuffix}`;
  const path = match[3] ?? '/';
  const query = match[4] ?? '';

  // RN's URL polyfill does not fully implement WHATWG normalization. Our narrow
  // ASCII HTTPS grammar needs only path shortening and these percent-encode sets.
  const normalizedPath = normalizePath(path).replace(/["<>^`{}]/g, percentEncode);
  const normalizedQuery = query.replace(/["<>']/g, percentEncode);
  return { url: `${origin}${normalizedPath}${normalizedQuery}`, origin };
}

export function resolveEliteDocumentUrl(input: string | undefined, defaultDocumentPath: string): EliteUrl {
  const normalized = normalizeEliteUrl(input);
  if (normalized.url !== `${normalized.origin}/`) return normalized;

  return { url: `${normalized.origin}${defaultDocumentPath}`, origin: normalized.origin };
}

export function isEliteDocumentUrl(url: string, documentUrl: string): boolean {
  try {
    return normalizeEliteUrl(stripFragment(url)).url === documentUrl;
  } catch {
    return false;
  }
}

export function isEliteDocumentOrigin(actualUrl: string, expectedUrl: string): boolean {
  try {
    return normalizeEliteUrl(stripFragment(actualUrl)).origin === normalizeEliteUrl(expectedUrl).origin;
  } catch {
    return false;
  }
}

export function decideEliteNavigation(
  request: Readonly<{ url: string; isTopFrame?: boolean }>,
  documentUrl: string,
  initialNavigationPending: boolean
): Readonly<{ allowed: boolean; initialNavigationPending: boolean }> {
  if (request.isTopFrame === false) {
    return { allowed: true, initialNavigationPending };
  }
  const matchesDocument = isEliteDocumentUrl(request.url, documentUrl);
  if (matchesDocument && request.url.includes('#')) {
    return { allowed: true, initialNavigationPending };
  }
  if (initialNavigationPending && matchesDocument) {
    return { allowed: true, initialNavigationPending: false };
  }
  return { allowed: false, initialNavigationPending };
}

function stripFragment(url: string): string {
  const fragmentIndex = url.indexOf('#');
  return fragmentIndex < 0 ? url : url.slice(0, fragmentIndex);
}

function normalizePath(path: string): string {
  const result: string[] = [];
  const segments = path.slice(1).split('/');
  for (const [index, segment] of segments.entries()) {
    const dots = segment.replace(/%2e/gi, '.');
    if (dots === '.' || dots === '..') {
      if (dots === '..') result.pop();
      if (index === segments.length - 1) result.push('');
    } else {
      result.push(segment);
    }
  }
  return `/${result.join('/')}`;
}

function percentEncode(character: string): string {
  return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
}

function invalidUrl(): TypeError {
  return new TypeError('Invalid OwnID Elite origin: expected a full HTTPS URL with an ASCII DNS host, optional port, and no fragment.');
}
