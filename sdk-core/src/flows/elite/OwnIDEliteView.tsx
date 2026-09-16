import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';

import { OwnID } from '../../runtime/OwnID';
import type { OwnIDProviders } from '../../providers';
import { ErrorCode } from '../../models/error';
import type { EliteDocumentSource } from './document';
import type { OwnIDEliteErrorDetails, OwnIDEliteEvents } from './events';
import type { OwnIDEliteNamespace } from './namespace';
import { webAuthenticationNativeConfig } from './nativeWebView';
import { decideEliteNavigation, isEliteDocumentUrl } from './origin';
import { createEliteRun, MissingEliteSessionProviderError, prepareEliteEvents, prepareEliteLaunch } from './run';
import type { EliteRunController, EliteRunPort } from './run';

const ORIGIN_WHITELIST = ['*'];

/** Options captured when one mounted Elite flow starts. */
export interface OwnIDEliteOptions {
  /**
   * Security origin assigned to the generated Elite document. It does not change the configured OwnID environment or service endpoints.
   *
   * Defaults to `https://webview.ownid.com`. The value must be HTTPS with an ASCII DNS host and optional port. A trailing slash is accepted;
   * other paths, queries, fragments, user information, and IP addresses are rejected.
   *
   * For passkeys, align this host with the relying-party domain and deployed app-to-site associations. This option does not configure Android
   * Digital Asset Links, iOS Associated Domains, or the site's association files.
   */
  readonly origin?: string;
}

/** Inputs captured when {@link OwnIDEliteView} first mounts. Later rerenders do not restart or retarget the run. */
export interface OwnIDEliteViewProps {
  /** Elite flow selection supplying Context and providers. Defaults to `OwnID.flows.elite`. */
  readonly namespace?: OwnIDEliteNamespace;
  /** Optional launch settings for this run. */
  readonly options?: OwnIDEliteOptions;
  /** Optional application callbacks for this run. */
  readonly events?: OwnIDEliteEvents;
  /** Optional provider callbacks for this run; omitted callbacks remain inherited from the selected Elite flow. */
  readonly providers?: OwnIDProviders;
}

type MountedRun = Readonly<{
  controller: EliteRunController;
  source: EliteDocumentSource;
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
 * data must be JSON-compatible: unsupported JavaScript values, cycles, non-finite numbers, and missing array entries fail the request;
 * `undefined` object fields are omitted.
 * Applications must add camera and foreground-location permission declarations, including iOS purpose strings, when hosted steps use those
 * capabilities.
 *
 * Reinitializing or destroying OwnID stops the run, as does a startup failure or native WebView loss. Setup errors are
 * reported through a valid `onError` when possible; otherwise the View remains empty instead of throwing the error from render.
 */
export function OwnIDEliteView(props: OwnIDEliteViewProps): ReactElement {
  const webViewRef = useRef<WebView>(null);
  const setupRef = useRef<Setup | undefined>(undefined);
  const [mountedRun, setMountedRun] = useState<MountedRun | null>(null);

  useLayoutEffect(() => {
    let setup = setupRef.current;
    if (setup === undefined) {
      setup = prepareMountedRun(props, webViewRef, setMountedRun);
      setupRef.current = setup;
      if (setup.kind === 'run') setMountedRun(setup.value);
    }

    if (setup.kind === 'failed') return undefined;
    const controller = setup.value.controller;
    controller.attach();
    return () => controller.detach();
  }, []);

  if (mountedRun === null) {
    return <View style={styles.root} />;
  }

  return (
    <WebView
      ref={webViewRef}
      style={styles.root}
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
      onLoad={mountedRun.onLoad}
      onMessage={mountedRun.onMessage}
      onError={mountedRun.onError}
      onHttpError={mountedRun.onHttpError}
      onRenderProcessGone={mountedRun.onRenderProcessGone}
      onContentProcessDidTerminate={mountedRun.onContentProcessDidTerminate}
      onOpenWindow={mountedRun.onOpenWindow}
      onShouldStartLoadWithRequest={mountedRun.onShouldStartLoadWithRequest}
    />
  );
}

function prepareMountedRun(
  props: OwnIDEliteViewProps,
  webViewRef: Readonly<{ current: WebView | null }>,
  setMountedRun: (update: (current: MountedRun | null) => MountedRun | null) => void
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
    const launch = prepareEliteLaunch(namespace, props.options, events, props.providers);
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
      settle() {
        setMountedRun((current) => (current === mountedRun ? null : current));
      },
    });
    const controller = createEliteRun(launch, port);
    let initialNavigationPending = true;
    const mountedRun: MountedRun = Object.freeze({
      controller,
      source: launch.source,
      onLoad(event) {
        if (!isEliteDocumentUrl(event.nativeEvent.url, launch.source.baseUrl)) {
          controller.fail('OwnID Elite loaded an unexpected document.', ErrorCode.UNKNOWN, 'OwnIDEliteView.navigation', event.nativeEvent);
          return;
        }
        initialNavigationPending = false;
        controller.loaded();
      },
      onMessage(event) {
        if (!isEliteDocumentUrl(event.nativeEvent.url, launch.source.baseUrl)) {
          controller.fail('OwnID Elite received a message from an unexpected document.', ErrorCode.UNKNOWN, 'OwnIDEliteView.message');
          return;
        }
        controller.receive(event.nativeEvent.data);
      },
      onError(event) {
        controller.fail('OwnID Elite could not load its hosted content.', ErrorCode.NETWORK, 'OwnIDEliteView.load', event.nativeEvent);
      },
      onHttpError(event) {
        controller.fail('OwnID Elite received an HTTP loading error.', ErrorCode.UNKNOWN, 'OwnIDEliteView.http', event.nativeEvent);
      },
      onRenderProcessGone(event) {
        controller.fail('OwnID Elite WebView process stopped.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process', event.nativeEvent);
      },
      onContentProcessDidTerminate(event) {
        controller.fail('OwnID Elite WebView process stopped.', ErrorCode.UNKNOWN, 'OwnIDEliteView.process', event.nativeEvent);
      },
      onOpenWindow(event) {
        controller.fail('OwnID Elite blocked a new browser window.', ErrorCode.UNKNOWN, 'OwnIDEliteView.navigation', event.nativeEvent);
      },
      onShouldStartLoadWithRequest(request) {
        const decision = decideEliteNavigation(request, launch.source.baseUrl, initialNavigationPending);
        initialNavigationPending = decision.initialNavigationPending;
        if (decision.allowed) return true;
        controller.fail('OwnID Elite blocked document navigation.', ErrorCode.UNKNOWN, 'OwnIDEliteView.navigation');
        return false;
      },
    });
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
});
