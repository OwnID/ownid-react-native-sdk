import type { ReactElement } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import type { WebViewProps } from 'react-native-webview';
import { WebView } from 'react-native-webview';

import { OwnID } from '../../runtime/OwnID';
import type { OwnIDProviders } from '../../providers';
import { ErrorCode } from '../../models/error';
import type { OwnIDEliteErrorDetails, OwnIDEliteEvents } from './events';
import type { OwnIDEliteNamespace } from './namespace';
import { webAuthenticationNativeConfig } from './nativeWebView';
import { decideEliteNavigation, isEliteDocumentOrigin, isEliteDocumentUrl } from './documentUrl';
import type { EliteRunController, EliteRunPort } from './run';
import { createEliteRun, MissingEliteSessionProviderError, prepareEliteEvents, prepareEliteLaunch } from './run';
import type { EliteDocumentMode } from './protocol';

const ORIGIN_WHITELIST = ['*'];
const DEFAULT_DOCUMENT_PATH = Platform.select({
  android: '/.well-known/assetlinks.json',
  ios: '/.well-known/apple-app-site-association',
  default: '/.well-known/assetlinks.json',
});

/** Options captured when one mounted Elite flow starts. */
export interface OwnIDEliteOptions {
  /**
   * Required HTTPS origin or page URL. A non-root path or a root URL with a query loads that page directly.
   * A host or root URL without a query loads `/.well-known/assetlinks.json` on Android or `/.well-known/apple-app-site-association` on iOS.
   * Use an ASCII DNS hostname and optional port; fragments, user information, and IP addresses are rejected. The page must load without redirects.
   *
   * The SDK replaces the page's content with Elite. An empty or plain page without complex styles or JavaScript is recommended.
   * The page MUST NOT contain an existing OwnID Web SDK. The page's document policies must permit the configured OwnID resources.
   *
   * Available authentication methods depend on whether the HTTPS page can load securely, platform support, and your OwnID configuration.
   *
   * The HTTPS origin is used for passkey operations; its hostname must be valid for the configured relying party ID (RP ID).
   * This URL does not change the configured OwnID environment or service endpoints.
   */
  readonly origin: string;
}

/** Inputs captured when {@link OwnIDEliteView} first mounts. Later rerenders do not restart or retarget the run. */
export interface OwnIDEliteViewProps {
  /** Elite flow selection supplying Context and providers. Defaults to `OwnID.flows.elite`. */
  readonly namespace?: OwnIDEliteNamespace;
  /** Required launch settings for this run. */
  readonly options: OwnIDEliteOptions;
  /** Optional application callbacks for this run. */
  readonly events?: OwnIDEliteEvents;
  /** Optional provider callbacks for this run; omitted callbacks remain inherited from the selected Elite flow. */
  readonly providers?: OwnIDProviders;
}

type MountedRun = Readonly<{
  controller: EliteRunController;
  documentMode: EliteDocumentMode;
  source: NonNullable<WebViewProps['source']>;
  ref(webView: WebView | null): void;
  onLoadStart: NonNullable<WebViewProps['onLoadStart']>;
  onLoad: NonNullable<WebViewProps['onLoad']>;
  onMessage: NonNullable<WebViewProps['onMessage']>;
  onError: NonNullable<WebViewProps['onError']>;
  onHttpError: NonNullable<WebViewProps['onHttpError']>;
  onRenderProcessGone: NonNullable<WebViewProps['onRenderProcessGone']>;
  onContentProcessDidTerminate: NonNullable<WebViewProps['onContentProcessDidTerminate']>;
  onOpenWindow: NonNullable<WebViewProps['onOpenWindow']>;
  onShouldStartLoadWithRequest: NonNullable<WebViewProps['onShouldStartLoadWithRequest']>;
}>;

type Setup = Readonly<{ kind: 'run'; value: MountedRun }> | Readonly<{ kind: 'failed' }>;

/**
 * Renders one hosted OwnID Elite authentication run inside its assigned bounds.
 *
 * The View uses `flex: 1`, so its parent must provide dimensions. The application owns the surrounding screen, modal, safe-area layout, and
 * navigation. Props are captured once; unmount and remount to start a new run with different inputs. A valid effective
 * `providers.session.create` callback is required. Successful session creation requires an `AuthResult` with `status: 'logged-in'`. Its return
 * data must be JSON-compatible.
 * Applications must add camera and foreground-location permission declarations, including iOS purpose strings, when hosted steps use those
 * capabilities.
 *
 * Reinitializing or destroying OwnID, or losing the native WebView, ends the attempt. If setup fails, the View remains empty and reports
 * the failure through a valid `onError` callback when available.
 */
export function OwnIDEliteView(props: OwnIDEliteViewProps): ReactElement {
  const webViewRef = useRef<WebView>(null);
  const setupRef = useRef<Setup | undefined>(undefined);
  const [mountedRun, setMountedRun] = useState<MountedRun | null>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    let setup = setupRef.current;
    if (setup === undefined) {
      setup = prepareMountedRun(props, webViewRef, setMountedRun, setVisible);
      setupRef.current = setup;
      if (setup.kind === 'run') setMountedRun(setup.value);
    }

    if (setup.kind === 'failed') return undefined;
    const run = setup.value;
    run.controller.attach();
    return () => run.controller.detach();
  }, []);

  if (mountedRun === null) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <WebView
        key={mountedRun.documentMode}
        ref={mountedRun.ref}
        style={[styles.root, !visible && styles.hidden]}
        source={mountedRun.source}
        originWhitelist={ORIGIN_WHITELIST}
        nativeConfig={webAuthenticationNativeConfig}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        setSupportMultipleWindows
        allowsInlineMediaPlayback
        geolocationEnabled
        onLoadStart={mountedRun.onLoadStart}
        onLoad={mountedRun.onLoad}
        onMessage={mountedRun.onMessage}
        onError={mountedRun.onError}
        onHttpError={mountedRun.onHttpError}
        onRenderProcessGone={mountedRun.onRenderProcessGone}
        onContentProcessDidTerminate={mountedRun.onContentProcessDidTerminate}
        onOpenWindow={mountedRun.onOpenWindow}
        onShouldStartLoadWithRequest={mountedRun.onShouldStartLoadWithRequest}
      />
      {!visible && <ActivityIndicator style={StyleSheet.absoluteFill} color="#858585" size="large" />}
    </View>
  );
}

function prepareMountedRun(
  props: OwnIDEliteViewProps,
  webViewRef: { current: WebView | null },
  setMountedRun: (update: (current: MountedRun | null) => MountedRun | null) => void,
  setVisible: (visible: boolean) => void
): Setup {
  let events: OwnIDEliteEvents;
  try {
    events = prepareEliteEvents(props.events);
  } catch (cause) {
    reportPreparationFailure(Object.freeze({}), cause);
    return Object.freeze({ kind: 'failed' });
  }

  try {
    const namespace = props.namespace ?? OwnID.flows.elite;
    const launch = prepareEliteLaunch(namespace, props.options, events, props.providers, DEFAULT_DOCUMENT_PATH);
    let activeDocumentMode: EliteDocumentMode = 'https';
    let finished = false;
    const port: EliteRunPort = Object.freeze({
      postMessage(message: string) {
        const webView = webViewRef.current;
        if (webView === null) throw new Error('OwnID Elite WebView is unavailable.');
        webView.postMessage(message);
      },
      requestFocus() {
        const webView = webViewRef.current;
        if (webView === null) throw new Error('OwnID Elite WebView is unavailable.');
        webView.requestFocus();
      },
      stopLoading() {
        webViewRef.current?.stopLoading();
      },
      ready() {
        if (!finished) setVisible(true);
      },
      loadFallback() {
        activeDocumentMode = 'inline';
        webViewRef.current?.stopLoading();
        setVisible(false);
        const fallback = createMountedDocument('inline');
        setMountedRun((current) => (current?.controller === controller ? fallback : current));
      },
      settle() {
        finished = true;
        setMountedRun((current) => (current?.controller === controller ? null : current));
      },
    });
    const controller = createEliteRun(launch, port);
    function createMountedDocument(documentMode: EliteDocumentMode): MountedRun {
      const document = launch.source;
      const documentUrl = documentMode === 'https' ? document.url : document.baseUrl;
      let initialNavigationPending = true;
      let documentLoaded = false;
      const isCurrent = (): boolean => !finished && activeDocumentMode === documentMode;
      function blockedNavigation(cause?: unknown): void {
        if (documentMode === 'https' && !documentLoaded) {
          controller.startupFailure(
            'OwnID Elite blocked initial document navigation.',
            ErrorCode.UNKNOWN,
            'OwnIDEliteView.navigation',
            cause
          );
        } else {
          controller.fail('OwnID Elite blocked document navigation.', ErrorCode.UNKNOWN, 'OwnIDEliteView.navigation', cause);
        }
      }
      return Object.freeze({
        controller,
        documentMode,
        source:
          documentMode === 'https'
            ? Object.freeze({ uri: document.url })
            : Object.freeze({ html: document.html, baseUrl: document.baseUrl }),
        ref(webView) {
          if (!isCurrent()) return;
          webViewRef.current = webView;
          if (webView !== null) controller.mounted(documentMode);
        },
        onLoadStart(event) {
          if (!isCurrent()) return;
          initialNavigationPending = false;
          if (!isEliteDocumentUrl(event.nativeEvent.url, documentUrl)) blockedNavigation(event.nativeEvent);
        },
        onLoad(event) {
          if (!isCurrent() || documentLoaded) return;
          if (!isEliteDocumentUrl(event.nativeEvent.url, documentUrl)) {
            blockedNavigation(event.nativeEvent);
            return;
          }
          if (documentMode === 'inline') {
            documentLoaded = true;
            initialNavigationPending = false;
            controller.loaded(documentMode);
            return;
          }
          const webView = webViewRef.current;
          if (webView === null) return;
          documentLoaded = true;
          initialNavigationPending = false;
          try {
            webView.injectJavaScript(document.installEliteScript);
            controller.loaded(documentMode);
          } catch (cause) {
            if (!isCurrent()) return;
            controller.startupFailure('OwnID Elite could not install its content.', ErrorCode.UNKNOWN, 'OwnIDEliteView.bootstrap', cause);
          }
        },
        onMessage(event) {
          if (!isCurrent() || (documentMode === 'https' && !documentLoaded)) return;
          // Android reports sourceOrigin; iOS reports the document URL. Document modes and tokens also constrain the sender.
          if (!isEliteDocumentOrigin(event.nativeEvent.url, documentUrl)) {
            controller.fail('OwnID Elite received a message from an unexpected origin.', ErrorCode.UNKNOWN, 'OwnIDEliteView.message', {
              url: event.nativeEvent.url,
            });
            return;
          }
          controller.receive(event.nativeEvent.data);
        },
        onError(event) {
          if (!isCurrent()) return;
          const cause = event.nativeEvent.url ? event.nativeEvent : { ...event.nativeEvent, url: documentUrl };
          controller.startupFailure('OwnID Elite could not load its hosted content.', ErrorCode.NETWORK, 'OwnIDEliteView.load', cause);
        },
        onHttpError(event) {
          if (!isCurrent() || !isEliteDocumentUrl(event.nativeEvent.url, documentUrl)) return;
          controller.startupFailure(
            'OwnID Elite received an HTTP loading error.',
            ErrorCode.UNKNOWN,
            'OwnIDEliteView.http',
            event.nativeEvent
          );
        },
        onRenderProcessGone(event) {
          if (!isCurrent()) return;
          controller.fail('OwnID Elite WebView process stopped.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process', event.nativeEvent);
        },
        onContentProcessDidTerminate(event) {
          if (!isCurrent()) return;
          controller.fail('OwnID Elite WebView process stopped.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process', event.nativeEvent);
        },
        onOpenWindow(event) {
          if (!isCurrent()) return;
          controller.fail('OwnID Elite blocked a new browser window.', ErrorCode.UNKNOWN, 'OwnIDEliteView.navigation', event.nativeEvent);
        },
        onShouldStartLoadWithRequest(request) {
          if (!isCurrent()) return false;
          const decision = decideEliteNavigation(request, documentUrl, initialNavigationPending);
          initialNavigationPending = decision.initialNavigationPending;
          if (decision.allowed) return true;
          blockedNavigation(request);
          return false;
        },
      });
    }
    const mountedRun = createMountedDocument('https');
    return Object.freeze({ kind: 'run', value: mountedRun });
  } catch (cause) {
    reportPreparationFailure(events, cause);
    return Object.freeze({ kind: 'failed' });
  }
}

function reportPreparationFailure(events: OwnIDEliteEvents, cause: unknown): void {
  const callback = events.onError;
  if (callback === undefined) return;
  const message = cause instanceof Error ? cause.message : 'OwnID Elite could not prepare its hosted flow.';
  const details: OwnIDEliteErrorDetails = Object.freeze({
    code:
      cause instanceof MissingEliteSessionProviderError
        ? ErrorCode.MISSING_CAPABILITY_PROVIDER
        : cause instanceof TypeError
          ? ErrorCode.INVALID_ARGUMENT
          : ErrorCode.UNKNOWN,
    source: 'OwnIDEliteView.prepare',
    terminal: true,
  });
  try {
    const result = Reflect.apply(callback, undefined, [message, details]);
    void Promise.resolve(result).catch(() => undefined);
  } catch {
    // Preparation may fail before a scoped logger exists; callback failures are intentionally non-recursive.
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { opacity: 0 },
});
