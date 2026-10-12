import type { RuntimeConfiguration } from '../../configuration/runtime';
import { ELITE_PROTOCOL_CHANNEL, ELITE_PROTOCOL_VERSION } from './protocol';
import { normalizeEliteUrl } from './documentUrl';

export type CreateEliteDocumentInput = Readonly<{
  configuration: RuntimeConfiguration;
  url: string;
  language?: string;
  loginId?: string;
}>;

export type EliteDocumentSource = Readonly<{
  html: string;
  url: string;
  baseUrl: string;
  installEliteScript: string;
}>;

const CONTENT_SECURITY_POLICY = "frame-src https:; object-src 'none'; base-uri 'none'";

export function createEliteDocument(input: CreateEliteDocumentInput): EliteDocumentSource {
  const descriptor = {
    channel: ELITE_PROTOCOL_CHANNEL,
    version: ELITE_PROTOCOL_VERSION,
    cdnUrl: createCdnUrl(input.configuration),
    ...(input.language === undefined ? {} : { language: input.language }),
    ...(input.loginId === undefined ? {} : { loginId: input.loginId }),
  };

  const head = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">
  <title>OwnID</title>
  <style>
    html,body{width:100%;height:100%;margin:0;background:#fff}
    body{overflow:hidden}
    #ownid-loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#fff}
    #ownid-loading::after{content:'';box-sizing:border-box;width:40px;height:40px;border:5px solid rgba(133,133,133,.3);border-top-color:#858585;border-radius:50%;animation:ownid-loading 1s linear infinite}
    @keyframes ownid-loading{to{transform:rotate(360deg)}}
  </style>`;
  const body = '<div id="ownid-loading" aria-hidden="true"></div>';
  const runtime = `(async function(input) {
    'use strict';

    let active = true;
    let startAllowed = false;
    let started = false;
    let nextRequestId = 0;
    let wakeStart = function() {};
    const pending = new Map();
    const abortController = new AbortController();
    let loading = document.getElementById('ownid-loading');
    let loadingObserver;
    const documentToken = Array.from(
      window.crypto.getRandomValues(new Uint8Array(16)),
      function(byte) { return ('0' + byte.toString(16)).slice(-2); }
    ).join('');

    const onFocus = function() { wakeStart(); };
    const onPageHide = function() {
      stop({
        kind: 'failure',
        phase: started ? 'start' : 'initialization',
        message: 'OwnID Elite document was unloaded.'
      });
    };

    try {
      window.addEventListener('message', receive);
      document.addEventListener('message', receive);
      window.addEventListener('focus', onFocus);
      window.addEventListener('pagehide', onPageHide);
      post({ kind: 'document-ready' });

      try {
        const pageSdk = window.ownid;
        if (window.customElements.get('ownid-root') !== undefined || window._ownid_initializing_sdk ||
            (pageSdk != null && (pageSdk.sdk !== undefined || pageSdk.whenReady !== undefined))) {
          console.warn('The bootstrap page contains an existing OwnID Web SDK, which may interfere with OwnID Elite.');
        }
      } catch (_) {}

      window.ownid = function() {
        const args = Array.prototype.slice.call(arguments);
        return new Promise(function(resolve, reject) {
          (window.ownid.q = window.ownid.q || []).push([{ r: resolve, j: reject, _isResolvers: true }].concat(args));
        });
      };

      let language = input.language;
      if (language === undefined) {
        language = Array.isArray(window.navigator.languages) && typeof window.navigator.languages[0] === 'string'
          ? window.navigator.languages[0]
          : typeof window.navigator.language === 'string' ? window.navigator.language : 'en';
      }

      document.documentElement.lang = language;

      const initPromise = window.ownid('init', {
        language: language,
        onError: function(message, details) {
          const frame = {
            kind: 'failure',
            phase: started ? 'start' : 'initialization',
            message: typeof message === 'string' ? message : 'OwnID Elite failed.'
          };
          if (details !== undefined) frame.details = details;
          stop(frame);
        },
        events: {
          onFinish: (...args) => request('events.onFinish', args),
          onError: (...args) => request('events.onError', args),
          onClose: (...args) => request('events.onClose', args)
        },
        providers: {
          session: {
            create: (...args) => request('providers.session.create', args)
          }
        }
      });
      window.ownid.whenReady = initPromise;

      const script = document.createElement('script');
      script.src = input.cdnUrl;
      script.async = true;
      script.onerror = function() {
        stop({ kind: 'failure', phase: 'script-load', message: 'OwnID Web SDK could not be loaded. ' + input.cdnUrl });
      };
      document.head.appendChild(script);

      let initResult;
      try {
        initResult = await initPromise;
      } catch (cause) {
        stop({ kind: 'failure', phase: 'initialization', message: failureMessage('OwnID Web SDK initialization failed.', cause) });
        return;
      }
      if (!active) return;

      const initError = readResultError(initResult);
      if (initError !== undefined) {
        stop({ kind: 'failure', phase: 'initialization', message: initError });
        return;
      }

      try {
        post({ kind: 'ready' });
      } catch (_) {
        stop();
        return;
      }

      while (active && (!startAllowed || !document.hasFocus())) {
        await new Promise(function(resolve) {
          wakeStart = resolve;
        });
      }
      if (!active) return;

      started = true;
      const startOptions = { abortSignal: abortController.signal, animation: false };
      if (input.loginId !== undefined) startOptions.loginId = input.loginId;

      let startResult;
      try {
        post({ kind: 'start-issued' });
        const initialBodyChildCount = document.body.childElementCount;
        loadingObserver = new MutationObserver(function() {
          if (document.body.childElementCount > initialBodyChildCount) hideLoader();
        });
        loadingObserver.observe(document.body, { childList: true });
        startResult = await window.ownid('start', startOptions);
      } catch (cause) {
        stop({ kind: 'failure', phase: 'start', message: failureMessage('OwnID Elite start failed.', cause) });
        return;
      }
      if (!active) return;

      const startError = readResultError(startResult);
      if (startError === undefined) {
        stop({ kind: 'start-settled', status: 'completed' });
      } else {
        stop({ kind: 'failure', phase: 'start', message: startError });
      }

    } catch (cause) {
      stop({ kind: 'failure', phase: started ? 'start' : 'initialization', message: failureMessage('OwnID Elite bootstrap failed.', cause) });
    }

    function failureMessage(message, cause) {
      let reason;
      try {
        if (typeof cause === 'string') reason = cause;
        else if (cause instanceof Error) reason = cause.message;
        else if (typeof cause === 'object' && cause !== null) {
          const descriptor = Object.getOwnPropertyDescriptor(cause, 'message');
          if (descriptor !== undefined) reason = descriptor.value;
        }
      } catch (_) {}
      return typeof reason === 'string' && reason.trim() !== '' ? message + ' ' + reason : message;
    }

    function post(frame) {
      const envelope = Object.assign({
        channel: input.channel,
        version: input.version,
        documentMode: input.documentMode,
        documentToken: documentToken
      }, frame);
      // noinspection JSUnresolvedVariable -- The native WebView installs this bridge.
      window.ReactNativeWebView.postMessage(JSON.stringify(envelope, function(key, value) {
        if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Value is not JSON-compatible.');
        if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
          throw new TypeError('Value is not JSON-compatible.');
        }
        if (Array.isArray(this) && value === undefined) throw new TypeError('Value is not JSON-compatible.');
        return value;
      }));
    }

    function request(method, params) {
      return new Promise(function(resolve, reject) {
        if (!active || !started || nextRequestId >= Number.MAX_SAFE_INTEGER) {
          reject(new Error('OwnID Elite request is unavailable.'));
          return;
        }

        const id = ++nextRequestId;
        pending.set(id, { resolve: resolve, reject: reject });
        try {
          post({ kind: 'request', id: id, method: method, params: params });
        } catch (error) {
          pending.delete(id);
          reject(error);
        }
      });
    }

    function receive(event) {
      if (!active || typeof event.data !== 'string') return;

      let response;
      try {
        response = JSON.parse(event.data);
      } catch (_) {
        return;
      }
      if (typeof response !== 'object' ||
          response === null ||
          Array.isArray(response) ||
          response.channel !== input.channel ||
          response.version !== input.version ||
          response.documentMode !== input.documentMode ||
          response.documentToken !== documentToken) {
        return;
      }

      if (response.kind === 'start-permission') {
        startAllowed = true;
        wakeStart();
        return;
      }
      if (response.kind === 'abort') {
        stop();
        return;
      }
      if (response.kind !== 'response' || !Number.isSafeInteger(response.id) || response.id <= 0) return;

      const callback = pending.get(response.id);
      if (callback === undefined) return;
      pending.delete(response.id);

      const hasResult = Object.prototype.hasOwnProperty.call(response, 'result');
      const hasError = Object.prototype.hasOwnProperty.call(response, 'error');
      if (hasResult && hasError) {
        callback.reject(new Error('Invalid OwnID Elite response.'));
      } else if (hasError) {
        const responseError = response.error;
        if (typeof responseError !== 'object' ||
            responseError === null ||
            Array.isArray(responseError) ||
            typeof responseError.message !== 'string') {
          callback.reject(new Error('Invalid OwnID Elite response.'));
        } else {
          callback.reject(new Error(responseError.message));
        }
      } else {
        callback.resolve(response.result);
      }
    }

    function stop(frame) {
      if (!active) return;
      active = false;
      hideLoader();
      wakeStart();
      window.removeEventListener('message', receive);
      document.removeEventListener('message', receive);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onPageHide);
      abortController.abort();

      if (frame !== undefined) {
        try {
          post(frame);
        } catch (_) {
          if (frame.kind === 'failure' && frame.details !== undefined) {
            try {
              post({ kind: 'failure', phase: frame.phase, message: frame.message });
            } catch (_) {}
          }
        }
      }

      const callbacks = Array.from(pending.values());
      pending.clear();
      callbacks.forEach(function(callback) {
        callback.reject(new Error('OwnID Elite document stopped.'));
      });
    }

    function hideLoader() {
      if (loadingObserver !== undefined) {
        loadingObserver.disconnect();
        loadingObserver = undefined;
      }
      if (loading !== null) {
        loading.remove();
        loading = null;
      }
    }

    function readResultError(result) {
      if (typeof result !== 'object' || result === null || Array.isArray(result)) {
        return 'OwnID Web SDK returned an invalid result.';
      }
      try {
        const error = result.error;
        if (error === undefined) return undefined;
        return typeof error === 'string' ? error : 'OwnID Web SDK returned an invalid result.';
      } catch (_) {
        return 'OwnID Web SDK returned an invalid result.';
      }
    }
  })`;
  const inlineRuntime = `${runtime}(${serializeForInlineScript({ ...descriptor, documentMode: 'inline' })})`;
  const httpsRuntime = `${runtime}(${serializeForInlineScript({ ...descriptor, documentMode: 'https' })})`;
  const html = `<!DOCTYPE html>
<html lang="">
<head>${head}
</head>
<body>
  ${body}
  <script>${inlineRuntime};</script>
</body>
</html>`;

  return Object.freeze({
    html,
    url: input.url,
    baseUrl: `${normalizeEliteUrl(input.url).origin}/`,
    installEliteScript: createEliteInstallScript(head, body, httpsRuntime, input.url),
  });
}

function createEliteInstallScript(head: string, body: string, runtime: string, url: string): string {
  return `(function(input) {
    'use strict';
    if (!window.ReactNativeWebView && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ReactNativeWebView) {
      window.ReactNativeWebView = { postMessage: function(message) { window.webkit.messageHandlers.ReactNativeWebView.postMessage(String(message)); } };
    }
    if (window.__ownidEliteInstalled === true) return true;
    try {
      const actual = new URL(window.location.href);
      actual.hash = '';
      if (actual.href !== input.url || !window.isSecureContext) throw new Error('OwnID Elite requires its loaded HTTPS document.');
      const head = document.createElement('head');
      head.innerHTML = input.head;
      const body = document.createElement('body');
      body.innerHTML = input.body;
      const root = document.documentElement;
      Array.from(root.attributes).forEach(function(attribute) { root.removeAttribute(attribute.name); });
      root.replaceChildren(head, body);
      if ('adoptedStyleSheets' in document) document.adoptedStyleSheets = [];
      window._ownid_globalCss = undefined;
      window.__ownidEliteInstalled = true;
      ${runtime}.catch(function(cause) { fail('OwnID Elite bootstrap failed.', cause); });
    } catch (cause) {
      fail('OwnID Elite could not install its content.', cause);
    }
    function fail(message, cause) {
      let reason;
      try {
        if (typeof cause === 'string') reason = cause;
        else if (cause instanceof Error) reason = cause.message;
        else if (typeof cause === 'object' && cause !== null) {
          const descriptor = Object.getOwnPropertyDescriptor(cause, 'message');
          if (descriptor !== undefined) reason = descriptor.value;
        }
      } catch (_) {}
      if (typeof reason === 'string' && reason.trim() !== '') message += ' ' + reason;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        channel: '${ELITE_PROTOCOL_CHANNEL}', version: ${ELITE_PROTOCOL_VERSION}, documentMode: 'https',
        documentToken: '00000000000000000000000000000000',
        kind: 'failure', phase: 'initialization', message: message
      }));
    }
    return true;
  })(${serializeForInlineScript({ url, head, body })});`;
}

function createCdnUrl(configuration: RuntimeConfiguration): string {
  const environment = configuration.env === 'prod' ? '' : `.${configuration.env}`;
  const region = configuration.region === 'us' ? '' : '-eu';
  return `https://cdn${environment}.ownid${region}.com/sdk/${configuration.appId}`;
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
