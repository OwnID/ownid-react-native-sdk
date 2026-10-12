import { RuntimeConfigurationToken, RuntimeLanguageProviderToken } from '../../configuration/runtime';
import { ContextToken } from '../../context';
import { OwnIDLogLevel } from '../../logging';
import type { OwnIdLogRouter } from '../../logging/OwnIdLogRouter';
import { OwnIdLogRouterDiToken } from '../../logging';
import type { ErrorDetails } from '../../models/error';
import { ErrorCode } from '../../models/error';
import type { OwnIDProviders } from '../../providers';
import type { SessionCreateProvider } from '../../providers/internal';
import { createProvidersScope, prepareProviders, SessionCreateProviderToken } from '../../providers/internal';
import type { NamespaceBinding } from '../../namespace/scoping';
import { assertNamespaceBindingAvailable } from '../../namespace/scoping';
import type { EliteDocumentSource } from './document';
import { createEliteDocument } from './document';
import type { OwnIDEliteErrorDetails, OwnIDEliteEvents, OwnIDEliteFinishParams } from './events';
import type { OwnIDEliteNamespace } from './namespace';
import { getEliteNamespaceBinding } from './namespace';
import { resolveEliteDocumentUrl } from './documentUrl';
import type { EliteDocumentMode, EliteHostFrame, EliteHostFramePayload, ElitePageRequest } from './protocol';
import { ELITE_PROTOCOL_CHANNEL, ELITE_PROTOCOL_VERSION, parseElitePageFrame, serializeEliteHostFrame } from './protocol';

const DOCUMENT_ACQUISITION_TIMEOUT_MS = 30_000;
const SDK_STARTUP_TIMEOUT_MS = 30_000;
const TOTAL_STARTUP_TIMEOUT_MS = DOCUMENT_ACQUISITION_TIMEOUT_MS + 2 * SDK_STARTUP_TIMEOUT_MS;
const RUN_SOURCE = 'OwnIDEliteView';
const EMPTY_EVENTS: OwnIDEliteEvents = Object.freeze({});

type EliteOptionsInput = Readonly<{ origin: string }>;
type TerminalRequest = Extract<ElitePageRequest, { method: 'events.onFinish' | 'events.onClose' }>;

export type EliteLaunchSnapshot = Readonly<{
  source: EliteDocumentSource;
  binding: NamespaceBinding;
  events: OwnIDEliteEvents;
  sessionCreate: SessionCreateProvider['create'];
  logging: OwnIdLogRouter;
}>;

export interface EliteRunPort {
  postMessage(message: string): void;
  requestFocus(): void;
  stopLoading(): void;
  settle(): void;
  loadFallback(): void;
  ready(): void;
}

export interface EliteRunController {
  attach(): void;
  detach(): void;
  mounted(documentMode: EliteDocumentMode): void;
  loaded(documentMode: EliteDocumentMode): void;
  receive(message: string): void;
  fail(message: string, code: ErrorCode, source: string, cause?: unknown): void;
  startupFailure(message: string, code: ErrorCode, source: string, cause?: unknown): void;
  dispose(): void;
}

export type EliteRunClock = Readonly<{
  now(): number;
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
}>;

const defaultClock: EliteRunClock = Object.freeze({
  now: () => Date.now(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export function prepareEliteEvents(events: OwnIDEliteEvents | undefined): OwnIDEliteEvents {
  if (events === undefined) {
    return EMPTY_EVENTS;
  }
  assertRecord(events, 'events');

  const onFinish = events.onFinish;
  const onError = events.onError;
  const onClose = events.onClose;
  assertOptionalCallback(onFinish, 'events.onFinish');
  assertOptionalCallback(onError, 'events.onError');
  assertOptionalCallback(onClose, 'events.onClose');

  return Object.freeze({
    ...(onFinish === undefined ? {} : { onFinish }),
    ...(onError === undefined ? {} : { onError }),
    ...(onClose === undefined ? {} : { onClose }),
  });
}

export function prepareEliteLaunch(
  namespace: OwnIDEliteNamespace,
  options: EliteOptionsInput | undefined,
  events: OwnIDEliteEvents,
  providers: OwnIDProviders | undefined,
  defaultDocumentPath: string
): EliteLaunchSnapshot {
  const binding = getEliteNamespaceBinding(namespace);

  if (options === undefined) throw new TypeError('OwnID Elite requires options.origin.');
  assertRecord(options, 'options');
  const documentUrl = resolveEliteDocumentUrl(options.origin, defaultDocumentPath);
  assertNamespaceBindingAvailable(binding);

  const preparedProviders = providers === undefined ? undefined : prepareProviders(providers);
  assertNamespaceBindingAvailable(binding);
  const runScope = preparedProviders === undefined ? binding.scope : createProvidersScope(binding.scope, preparedProviders);
  const sessionProvider = runScope.resolveOptional(SessionCreateProviderToken);
  assertNamespaceBindingAvailable(binding);
  if (sessionProvider === undefined) {
    throw new MissingEliteSessionProviderError();
  }

  const configuration = runScope.resolve(RuntimeConfigurationToken);
  const context = runScope.resolveOptional(ContextToken);
  const languages = runScope.resolve(RuntimeLanguageProviderToken).snapshot();
  const logging = runScope.resolve(OwnIdLogRouterDiToken);
  assertNamespaceBindingAvailable(binding);

  const documentInput = {
    configuration,
    url: documentUrl.url,
    ...(languages?.[0] === undefined ? {} : { language: languages[0] }),
    ...(context?.loginId === undefined ? {} : { loginId: context.loginId }),
  };
  return Object.freeze({
    source: createEliteDocument(documentInput),
    binding,
    events,
    sessionCreate: sessionProvider.create,
    logging,
  });
}

export class MissingEliteSessionProviderError extends Error {
  constructor() {
    super('OwnID Elite requires providers.session.create.');
    this.name = 'MissingEliteSessionProviderError';
  }
}

export function createEliteRun(snapshot: EliteLaunchSnapshot, port: EliteRunPort, clock: EliteRunClock = defaultClock): EliteRunController {
  let state: 'active' | 'terminal' | 'settled' = 'active';
  let documentMode: EliteDocumentMode = 'https';
  let documentReady = false;
  let documentToken: string | undefined;
  let loaded = false;
  let ready = false;
  let startPermissionSent = false;
  let startIssued = false;
  let attached = false;
  let startupTimer: unknown;
  let startupDeadline: number | undefined;
  let totalStartupDeadline: number | undefined;
  const requestIds = new Set<number>();
  const queuedRequests: ElitePageRequest[] = [];
  const queuedMessages: string[] = [];
  let reservedTerminalRequest: TerminalRequest | undefined;
  let settlementPending = false;
  let abortPending = false;
  let terminalReport: Readonly<{ message: string; details: OwnIDEliteErrorDetails }> | undefined;

  const onInstanceAbort = (): void => dispose();

  function attach(): void {
    if (attached) return;
    attached = true;
    if (!isBindingActive()) {
      invalidateBinding();
      return;
    }
    if (state === 'settled') {
      finalize(false);
      return;
    }
    snapshot.binding.signal.addEventListener('abort', onInstanceAbort);
    if (!isBindingActive()) {
      invalidateBinding();
      return;
    }
    if (state === 'terminal') {
      const request = reservedTerminalRequest;
      reservedTerminalRequest = undefined;
      if (request !== undefined) void handleTerminalRequest(request, false);
      return;
    }

    scheduleStartupTimeout();
    flushQueuedMessages();
    flushQueuedRequests();
    grantStartPermissionIfReady();
  }

  function detach(): void {
    if (!attached) return;
    attached = false;
    snapshot.binding.signal.removeEventListener('abort', onInstanceAbort);
    clearStartupTimer();
  }

  function isBindingActive(): boolean {
    try {
      return !snapshot.binding.signal.aborted && snapshot.binding.isCurrent();
    } catch {
      return false;
    }
  }

  function ensureActive(): boolean {
    if (state !== 'active') return false;
    if (isBindingActive()) return true;
    dispose();
    return false;
  }

  function mountedDocument(mountedMode: EliteDocumentMode): void {
    if (mountedMode !== documentMode || !ensureActive() || totalStartupDeadline !== undefined) return;
    totalStartupDeadline = clock.now() + TOTAL_STARTUP_TIMEOUT_MS;
    startupDeadline = clock.now() + DOCUMENT_ACQUISITION_TIMEOUT_MS;
    scheduleStartupTimeout();
  }

  function loadedDocument(loadedMode: EliteDocumentMode): void {
    if (loadedMode !== documentMode || !ensureActive()) return;
    if (failIfStartupExpired()) return;
    loaded = true;
    grantStartPermissionIfReady();
  }

  function receive(message: string): void {
    if (state === 'settled') return;
    const terminal = state === 'terminal';
    let frame;
    try {
      frame = parseElitePageFrame(message);
    } catch (cause) {
      if (terminal || !ensureActive()) return;
      terminalFailure('OwnID Elite received an invalid page message.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.protocol`, cause);
      return;
    }
    if (frame.documentMode !== documentMode || (documentToken !== undefined && frame.documentToken !== documentToken)) return;
    if (terminal) {
      if (!isBindingActive()) invalidateBinding();
      else if (frame.kind === 'failure')
        markTerminalPageUnavailable(
          frame.message,
          frame.details === undefined ? undefined : { code: frame.details.code },
          frame.details?.source ?? `${RUN_SOURCE}.${frame.phase}`
        );
      return;
    }
    if (!ensureActive() || failIfStartupExpired()) return;
    if (documentToken === undefined) {
      if (frame.kind !== 'document-ready' && frame.kind !== 'failure') {
        terminalFailure('OwnID Elite received a message before the document was ready.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.protocol`);
        return;
      }
      documentToken = frame.documentToken;
    }

    switch (frame.kind) {
      case 'document-ready':
        if (documentReady) {
          terminalFailure('OwnID Elite received duplicate document readiness.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.protocol`);
          return;
        }
        documentReady = true;
        if (documentMode === 'https' && totalStartupDeadline !== undefined) {
          startupDeadline = Math.min(clock.now() + SDK_STARTUP_TIMEOUT_MS, totalStartupDeadline);
          scheduleStartupTimeout();
        }
        return;
      case 'ready':
        if (!documentReady || ready) {
          terminalFailure('OwnID Elite received duplicate readiness.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.protocol`);
          return;
        }
        ready = true;
        port.ready();
        grantStartPermissionIfReady();
        return;
      case 'start-issued':
        if (!ready || !loaded || !startPermissionSent || startIssued) {
          terminalFailure('OwnID Elite reported an invalid start transition.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.protocol`);
          return;
        }
        startIssued = true;
        clearStartupTimer();
        return;
      case 'start-settled':
        if (!startIssued) {
          terminalFailure('OwnID Elite settled before starting.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.protocol`);
          return;
        }
        settleSilently();
        return;
      case 'failure': {
        const reportFailure = frame.phase === 'start' ? terminalFailure : startupFailure;
        reportFailure(
          frame.message,
          frame.details?.code ?? ErrorCode.UNKNOWN,
          frame.details?.source ?? `${RUN_SOURCE}.${frame.phase}`,
          frame.details === undefined ? undefined : { code: frame.details.code },
          frame.details
        );
        return;
      }
      case 'request':
        handleRequest(frame);
        return;
    }
  }

  function grantStartPermissionIfReady(): void {
    if (!attached || !ensureActive() || !ready || !loaded || startPermissionSent || documentToken === undefined) return;
    const focusedDocumentMode = documentMode;
    try {
      port.requestFocus();
      if (!ensureActive() || documentMode !== focusedDocumentMode || startPermissionSent) return;
      startPermissionSent = true;
      post({ kind: 'start-permission' });
    } catch (cause) {
      if (documentMode !== focusedDocumentMode) return;
      startupFailure('OwnID Elite could not start its hosted document.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.bridge`, cause);
    }
  }

  function handleRequest(request: ElitePageRequest): void {
    if (!startIssued) {
      terminalFailure('OwnID Elite received a request before starting.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.protocol`);
      return;
    }
    if (request.method === 'events.onFinish' || request.method === 'events.onClose') {
      beginTerminalRequest(request);
      return;
    }
    if (!attached) {
      if (requestIds.has(request.id)) return;
      queuedRequests.push(request);
      return;
    }
    dispatchRequest(request);
  }

  function dispatchRequest(request: ElitePageRequest): void {
    if (request.method === 'events.onFinish' || request.method === 'events.onClose') {
      beginTerminalRequest(request);
      return;
    }
    if (!ensureActive()) return;
    if (requestIds.has(request.id)) {
      return;
    }
    requestIds.add(request.id);

    switch (request.method) {
      case 'events.onError':
        void handleLiveError(request.id, request.params[0], request.params[1]);
        return;
      case 'providers.session.create':
        void handleSessionCreate(request.id, request.params[0]);
        return;
    }
  }

  function beginTerminalRequest(request: TerminalRequest): void {
    if (!ensureActive()) return;
    if (requestIds.has(request.id)) return;
    requestIds.add(request.id);
    state = 'terminal';
    queuedMessages.length = 0;
    queuedRequests.length = 0;
    clearStartupTimer();
    if (!attached) {
      reservedTerminalRequest = request;
      return;
    }
    void handleTerminalRequest(request, true);
  }

  async function handleTerminalRequest(request: TerminalRequest, allowReply: boolean): Promise<void> {
    const callback =
      request.method === 'events.onFinish'
        ? snapshot.events.onFinish === undefined
          ? undefined
          : () => snapshot.events.onFinish?.(copyFinishParams(request.params[0]))
        : snapshot.events.onClose === undefined
          ? undefined
          : () => snapshot.events.onClose?.();

    const result = await invokeApplicationCallback(callback);
    if (state !== 'terminal') return;
    if (!isBindingActive()) {
      invalidateBinding();
      return;
    }
    if (allowReply && attached) {
      try {
        postNow(
          result.ok
            ? { kind: 'response', id: request.id }
            : { kind: 'response', id: request.id, error: { message: 'OwnID Elite application callback failed.' } }
        );
      } catch (cause) {
        finalize(false, undefined, Object.freeze({ message: 'OwnID Elite terminal callback response failed.', cause }));
        return;
      }
    }
    finalize(false);
  }

  async function handleLiveError(id: number, message: string, details: ErrorDetails): Promise<void> {
    const callback = snapshot.events.onError;
    const exposedDetails: OwnIDEliteErrorDetails = Object.freeze({ ...details, terminal: false });
    const result = await invokeApplicationCallback(callback === undefined ? undefined : () => callback(message, exposedDetails));
    if (!ensureActive()) return;
    sendApplicationResponse(id, result.ok);
  }

  async function handleSessionCreate(id: number, payload: Parameters<SessionCreateProvider['create']>[0]): Promise<void> {
    const callback = snapshot.sessionCreate;
    const outcome = await invokeApplicationCallback(() => callback(payload));
    if (!ensureActive()) return;
    if (!outcome.ok) {
      sendApplicationResponse(id, false);
      return;
    }

    let message: string;
    try {
      message = serialize({ kind: 'response', id, result: outcome.value });
    } catch (cause) {
      snapshot.logging.log(OwnIDLogLevel.Error, RUN_SOURCE, 'OwnID Elite session provider returned an invalid result.', cause);
      if (!ensureActive()) return;
      sendApplicationResponse(id, false, 'OwnID Elite session provider failed.');
      return;
    }
    if (!ensureActive()) return;
    try {
      sendMessage(message);
    } catch (cause) {
      terminalFailure('OwnID Elite could not return a session provider result.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.bridge`, cause);
    }
  }

  async function invokeApplicationCallback<Value>(
    callback: (() => Value | PromiseLike<Value>) | undefined
  ): Promise<Readonly<{ ok: true; value: Value | undefined }> | Readonly<{ ok: false }>> {
    if (callback === undefined) return { ok: true, value: undefined };
    try {
      const value = callback();
      return { ok: true, value: await value };
    } catch (failure) {
      snapshot.logging.log(OwnIDLogLevel.Error, RUN_SOURCE, 'OwnID Elite application callback failed.', failure);
      return { ok: false };
    }
  }

  function sendApplicationResponse(id: number, succeeded: boolean, failureMessage = 'OwnID Elite application callback failed.'): void {
    try {
      post(succeeded ? { kind: 'response', id } : { kind: 'response', id, error: { message: failureMessage } });
    } catch (cause) {
      terminalFailure('OwnID Elite could not return an application callback result.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.bridge`, cause);
    }
  }

  function post(frame: EliteHostFramePayload): void {
    sendMessage(serialize(frame));
  }

  function sendMessage(message: string): void {
    if (attached) {
      port.postMessage(message);
    } else {
      queuedMessages.push(message);
    }
  }

  function postNow(frame: EliteHostFramePayload): void {
    port.postMessage(serialize(frame));
  }

  function serialize(frame: EliteHostFramePayload): string {
    if (documentToken === undefined) {
      throw new Error('OwnID Elite document token is unavailable.');
    }
    const value = {
      channel: ELITE_PROTOCOL_CHANNEL,
      version: ELITE_PROTOCOL_VERSION,
      documentMode,
      documentToken,
      ...frame,
    } as EliteHostFrame;
    return serializeEliteHostFrame(value);
  }

  function fail(message: string, code: ErrorCode, source: string, cause?: unknown): void {
    terminalFailure(message, code, source, cause);
  }

  function startupFailure(message: string, code: ErrorCode, source: string, cause?: unknown, webDetails?: ErrorDetails): void {
    if (state === 'terminal') {
      terminalFailure(message, code, source, cause, webDetails);
      return;
    }
    if (!ensureActive()) return;
    if (documentMode !== 'https' || startPermissionSent || totalStartupDeadline === undefined || clock.now() >= totalStartupDeadline) {
      terminalFailure(message, code, source, cause, webDetails);
      return;
    }
    clearStartupTimer();
    documentMode = 'inline';
    documentToken = undefined;
    loaded = ready = documentReady = false;
    startupDeadline = Math.min(clock.now() + SDK_STARTUP_TIMEOUT_MS, totalStartupDeadline);
    try {
      port.loadFallback();
    } catch (failure) {
      terminalFailure('OwnID Elite could not load its inline content.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.fallback`, failure);
      return;
    }
    if (!ensureActive()) return;
    snapshot.logging.log(OwnIDLogLevel.Warn, source, `OwnID Elite HTTPS startup failed; loading inline content. ${message}`, cause);
    if (!ensureActive()) return;
    scheduleStartupTimeout();
  }

  function terminalFailure(message: string, code: ErrorCode, source: string, cause?: unknown, webDetails?: ErrorDetails): void {
    if (state === 'terminal') {
      markTerminalPageUnavailable(message, cause, source);
      return;
    }
    if (state !== 'active') return;

    const callback = snapshot.events.onError;
    const report =
      callback === undefined
        ? undefined
        : Object.freeze({
            message,
            details: Object.freeze({
              ...(webDetails?.additionalDetails === undefined ? {} : { additionalDetails: webDetails.additionalDetails }),
              code,
              source,
              terminal: true,
            }),
          });
    finalize(true, report, Object.freeze({ message, source, ...(cause === undefined ? {} : { cause }) }));
  }

  function settleSilently(): void {
    if (state !== 'active') return;
    finalize(false);
  }

  function dispose(): void {
    finalize(true);
  }

  function invalidateBinding(): void {
    terminalReport = undefined;
    finalize(true);
  }

  function markTerminalPageUnavailable(message: string, cause?: unknown, source = RUN_SOURCE): void {
    queuedMessages.length = 0;
    queuedRequests.length = 0;
    if (reservedTerminalRequest !== undefined) return;
    finalize(false, undefined, Object.freeze({ message, source, ...(cause === undefined ? {} : { cause }) }));
  }

  function finalize(
    sendAbort: boolean,
    report?: Readonly<{ message: string; details: OwnIDEliteErrorDetails }>,
    log?: Readonly<{ message: string; cause?: unknown; source?: string }>
  ): void {
    if (state !== 'settled') {
      state = 'settled';
      clearStartupTimer();
      snapshot.binding.signal.removeEventListener('abort', onInstanceAbort);
      queuedMessages.length = 0;
      queuedRequests.length = 0;
      reservedTerminalRequest = undefined;
      settlementPending = true;
    }
    abortPending ||= sendAbort;
    if (report !== undefined) terminalReport = report;
    if (log !== undefined) snapshot.logging.log(OwnIDLogLevel.Error, log.source ?? RUN_SOURCE, log.message, log.cause);
    if (!settlementPending || !attached) return;

    settlementPending = false;
    if (abortPending && documentToken !== undefined) {
      abortPending = false;
      try {
        postNow({ kind: 'abort' });
      } catch {
        // Teardown is best-effort after the run has become inert.
      }
    }
    try {
      port.stopLoading();
    } catch {
      // Teardown is best-effort after the run has become inert.
    }
    safelySettlePort();
    reportTerminalFailure();
  }

  function flushQueuedMessages(): void {
    while (attached && queuedMessages.length > 0) {
      const message = queuedMessages.shift();
      if (message === undefined) continue;
      try {
        port.postMessage(message);
      } catch (cause) {
        queuedMessages.length = 0;
        terminalFailure('OwnID Elite could not write to its hosted document.', ErrorCode.UNKNOWN, `${RUN_SOURCE}.bridge`, cause);
        return;
      }
    }
  }

  function flushQueuedRequests(): void {
    while (attached && state === 'active' && queuedRequests.length > 0) {
      const request = queuedRequests.shift();
      if (request !== undefined) dispatchRequest(request);
    }
    if (state !== 'active') queuedRequests.length = 0;
  }

  function scheduleStartupTimeout(): void {
    clearStartupTimer();
    if (!attached || state !== 'active' || startIssued) return;
    const deadline = startupDeadline;
    if (deadline === undefined) return;
    const remaining = deadline - clock.now();
    if (remaining <= 0) {
      startupFailure('OwnID Elite did not start before its deadline.', ErrorCode.TIMEOUT, `${RUN_SOURCE}.startup`);
      return;
    }
    const handle = clock.setTimeout(() => {
      if (startupTimer !== handle) return;
      startupTimer = undefined;
      scheduleStartupTimeout();
    }, remaining);
    startupTimer = handle;
  }

  function failIfStartupExpired(): boolean {
    if (startIssued || startupDeadline === undefined || clock.now() < startupDeadline) return false;
    startupFailure('OwnID Elite did not start before its deadline.', ErrorCode.TIMEOUT, `${RUN_SOURCE}.startup`);
    return true;
  }

  function clearStartupTimer(): void {
    if (startupTimer === undefined) return;
    clock.clearTimeout(startupTimer);
    startupTimer = undefined;
  }

  function reportTerminalFailure(): void {
    const report = terminalReport;
    terminalReport = undefined;
    if (report === undefined || !isBindingActive()) return;
    const callback = snapshot.events.onError;
    if (callback === undefined) return;
    try {
      const result = Reflect.apply(callback, undefined, [report.message, report.details]);
      void Promise.resolve(result).catch((failure: unknown) => {
        snapshot.logging.log(OwnIDLogLevel.Error, RUN_SOURCE, 'OwnID Elite error callback failed.', failure);
      });
    } catch (failure) {
      snapshot.logging.log(OwnIDLogLevel.Error, RUN_SOURCE, 'OwnID Elite error callback failed.', failure);
    }
  }

  function safelySettlePort(): void {
    try {
      port.settle();
    } catch (cause) {
      snapshot.logging.log(OwnIDLogLevel.Error, RUN_SOURCE, 'OwnID Elite View cleanup failed.', cause);
    }
  }

  return Object.freeze({ attach, detach, mounted: mountedDocument, loaded: loadedDocument, receive, fail, startupFailure, dispose });
}

function copyFinishParams(params: OwnIDEliteFinishParams): OwnIDEliteFinishParams {
  const copy: OwnIDEliteFinishParams & { context?: unknown } = { ...params };
  delete copy.context;
  return copy;
}

function assertOptionalCallback(value: unknown, name: string): void {
  if (value !== undefined && typeof value !== 'function') {
    throw new TypeError(`OwnID Elite ${name} must be a function or undefined.`);
  }
}

function assertRecord(value: unknown, name: string): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`OwnID Elite ${name} must be an object.`);
  }
}
