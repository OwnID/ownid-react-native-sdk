import type { RuntimeConfiguration } from '../../configuration/runtime';
import { ELITE_PROTOCOL_CHANNEL, ELITE_PROTOCOL_VERSION } from './protocol';

export type CreateEliteDocumentInput = Readonly<{
  configuration: RuntimeConfiguration;
  origin: string;
  language?: string;
  loginId?: string;
}>;

export type EliteDocumentSource = Readonly<{
  html: string;
  baseUrl: string;
}>;

const CONTENT_SECURITY_POLICY = "frame-src https:; object-src 'none'; base-uri 'none'";

export function createEliteDocument(input: CreateEliteDocumentInput): EliteDocumentSource {
  const descriptor = serializeForInlineScript({
    channel: ELITE_PROTOCOL_CHANNEL,
    version: ELITE_PROTOCOL_VERSION,
    cdnUrl: createCdnUrl(input.configuration),
    ...(input.language === undefined ? {} : { language: input.language }),
    ...(input.loginId === undefined ? {} : { loginId: input.loginId }),
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
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
  </style>
</head>
<body>
  <div id="ownid-loading" aria-hidden="true"></div>
  <script>(async function(input) {
    'use strict';

    var active = true;
    var startAllowed = false;
    var started = false;
    var nextRequestId = 0;
    var wakeStart = function() {};
    var pending = new Map();
    var abortController = new AbortController();
    var loading = document.getElementById('ownid-loading');
    var loadingObserver;
    var documentToken = Array.from(
      window.crypto.getRandomValues(new Uint8Array(16)),
      function(byte) { return byte.toString(16).padStart(2, '0'); }
    ).join('');

    var onFocus = function() { wakeStart(); };
    var onPageHide = function() {
      stop({
        kind: 'failure',
        phase: started ? 'start' : 'initialization',
        message: 'OwnID Elite document was unloaded.'
      });
    };

    window.addEventListener('message', receive);
    document.addEventListener('message', receive);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onPageHide);

    window.ownid = window.ownid || function() {
      var args = Array.prototype.slice.call(arguments);
      return new Promise(function(resolve, reject) {
        (window.ownid.q = window.ownid.q || []).push([{ r: resolve, j: reject, _isResolvers: true }].concat(args));
      });
    };

    var language = input.language;
    if (language === undefined) {
      language = Array.isArray(window.navigator.languages) && typeof window.navigator.languages[0] === 'string'
        ? window.navigator.languages[0]
        : typeof window.navigator.language === 'string' ? window.navigator.language : 'en';
    }

    var initPromise = window.ownid('init', {
      language: language,
      onError: function(message, details) {
        var frame = {
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

    var script = document.createElement('script');
    script.src = input.cdnUrl;
    script.async = true;
    script.onerror = function() {
      stop({ kind: 'failure', phase: 'script-load', message: 'OwnID Web SDK could not be loaded.' });
    };
    document.head.appendChild(script);

    var initResult;
    try {
      initResult = await initPromise;
    } catch (_) {
      stop({ kind: 'failure', phase: 'initialization', message: 'OwnID Web SDK initialization failed.' });
      return;
    }
    if (!active) return;

    var initError = readResultError(initResult);
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
    var startOptions = { abortSignal: abortController.signal, animation: false };
    if (input.loginId !== undefined) startOptions.loginId = input.loginId;

    var startResult;
    try {
      post({ kind: 'start-issued' });
      var initialBodyChildCount = document.body.childElementCount;
      loadingObserver = new MutationObserver(function() {
        if (document.body.childElementCount > initialBodyChildCount) hideLoader();
      });
      loadingObserver.observe(document.body, { childList: true });
      startResult = await window.ownid('start', startOptions);
    } catch (_) {
      stop({ kind: 'failure', phase: 'start', message: 'OwnID Elite start failed.' });
      return;
    }
    if (!active) return;

    var startError = readResultError(startResult);
    if (startError === undefined) {
      stop({ kind: 'start-settled', status: 'completed' });
    } else {
      stop({ kind: 'failure', phase: 'start', message: startError });
    }

    function post(frame) {
      var envelope = Object.assign({
        channel: input.channel,
        version: input.version,
        documentToken: documentToken
      }, frame);
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

        var id = ++nextRequestId;
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

      var response;
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

      var callback = pending.get(response.id);
      if (callback === undefined) return;
      pending.delete(response.id);

      var hasResult = Object.prototype.hasOwnProperty.call(response, 'result');
      var hasError = Object.prototype.hasOwnProperty.call(response, 'error');
      if (hasResult && hasError) {
        callback.reject(new Error('Invalid OwnID Elite response.'));
      } else if (hasError) {
        var responseError = response.error;
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

      var callbacks = Array.from(pending.values());
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
        var error = result.error;
        if (error === undefined) return undefined;
        return typeof error === 'string' ? error : 'OwnID Web SDK returned an invalid result.';
      } catch (_) {
        return 'OwnID Web SDK returned an invalid result.';
      }
    }
  })(${descriptor});</script>
</body>
</html>`;

  return Object.freeze({ html, baseUrl: input.origin });
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
