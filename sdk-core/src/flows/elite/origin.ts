const DEFAULT_ELITE_ORIGIN = 'https://webview.ownid.com';
const ORIGIN_PATTERN = /^https:\/\/([^/:?#@]+)(?::([0-9]+))?(\/)?$/i;
const DNS_LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const DECIMAL_LABEL_PATTERN = /^[0-9]+$/;
const HEXADECIMAL_LABEL_PATTERN = /^0x[0-9a-f]*$/i;
const PRINTABLE_ASCII_PATTERN = /^[\x21-\x7e]+$/;

export function normalizeEliteOrigin(origin: string | undefined): string {
  if (origin === undefined) {
    return DEFAULT_ELITE_ORIGIN;
  }
  if (typeof origin !== 'string' || !PRINTABLE_ASCII_PATTERN.test(origin)) {
    throw invalidOrigin();
  }

  const match = ORIGIN_PATTERN.exec(origin);
  if (match === null || match[0].length !== origin.length) {
    throw invalidOrigin();
  }

  const host = match[1];
  if (host === undefined || host.length > 253) {
    throw invalidOrigin();
  }

  const labels = host.split('.');
  if (labels.some((label) => !DNS_LABEL_PATTERN.test(label))) {
    throw invalidOrigin();
  }

  const finalLabel = labels[labels.length - 1];
  if (finalLabel === undefined || DECIMAL_LABEL_PATTERN.test(finalLabel) || HEXADECIMAL_LABEL_PATTERN.test(finalLabel)) {
    throw invalidOrigin();
  }

  const port = match[2];
  if (port === undefined) {
    return `https://${host.toLowerCase()}`;
  }

  const normalizedPort = port.replace(/^0+(?=[0-9])/, '');
  if (normalizedPort.length > 5) {
    throw invalidOrigin();
  }

  const portNumber = Number(normalizedPort);
  if (portNumber > 65_535) {
    throw invalidOrigin();
  }

  return `https://${host.toLowerCase()}${portNumber === 443 ? '' : `:${portNumber}`}`;
}

export function isEliteDocumentUrl(url: string, origin: string): boolean {
  if (url === origin || url === `${origin}/`) return true;
  return isEliteFragmentNavigation(url, origin);
}

export function decideEliteNavigation(
  request: Readonly<{ url: string; isTopFrame: boolean }>,
  origin: string,
  initialNavigationPending: boolean
): Readonly<{ allowed: boolean; initialNavigationPending: boolean }> {
  if (request.isTopFrame === false || isEliteFragmentNavigation(request.url, origin)) {
    return { allowed: true, initialNavigationPending };
  }
  if (initialNavigationPending && isEliteDocumentUrl(request.url, origin)) {
    return { allowed: true, initialNavigationPending: false };
  }
  return { allowed: false, initialNavigationPending };
}

function isEliteFragmentNavigation(url: string, origin: string): boolean {
  return url.startsWith(`${origin}#`) || url.startsWith(`${origin}/#`);
}

function invalidOrigin(): TypeError {
  return new TypeError('Invalid OwnID Elite origin: expected an HTTPS origin with an ASCII DNS host and optional port.');
}
