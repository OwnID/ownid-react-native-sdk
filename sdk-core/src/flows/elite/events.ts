import type { AuthMethod } from '../../models/authentication';
import type { ErrorDetails } from '../../models/error';

/** Parameters reported when the hosted Elite flow finishes authentication. */
export interface OwnIDEliteFinishParams {
  /** Login identifier used for the authentication. */
  readonly loginId: string;
  /** Authentication method reported by the hosted flow. */
  readonly authType: AuthMethod;
  /** Device category selected by the Web SDK. */
  readonly source: 'mobile' | 'desktop';
  /** OwnID authentication token, when the hosted flow issued one. */
  readonly authToken?: string;
}

/** Error details reported by an Elite View error callback. */
export interface OwnIDEliteErrorDetails extends ErrorDetails {
  /**
   * Whether the current authentication attempt has ended when the callback runs.
   *
   * `true` includes failures before the hosted flow starts. `false` does not by itself end the attempt or guarantee recovery.
   */
  readonly terminal: boolean;
}

/**
 * Optional application callbacks for one mounted Elite flow.
 *
 * The application owns navigation and dismissal of the surrounding screen or modal. Reinitializing or destroying OwnID, or losing the WebView,
 * may end the attempt without cancelling an application callback already in progress.
 */
export interface OwnIDEliteEvents {
  /**
   * Called after successful hosted authentication. Update application state or navigate as needed.
   *
   * During normal completion, the SDK waits for this promise before clearing the View, even if it rejects. Callback failures are logged when
   * enabled and do not invoke `onError`.
   */
  readonly onFinish?: (params: OwnIDEliteFinishParams) => Promise<void>;
  /**
   * Reports hosted authentication, preparation, and native WebView errors.
   *
   * With `terminal: true`, the attempt has ended; dismiss the surrounding UI or mount a new View to retry. With `terminal: false`, the error
   * alone does not end the attempt or guarantee recovery. A terminal error callback does not delay cleanup. Callback failures are logged when
   * enabled and never invoke `onError` recursively.
   */
  readonly onError?: (message: string, details: OwnIDEliteErrorDetails) => Promise<void>;
  /**
   * Called when the hosted flow requests to close without successful completion. Dismiss the surrounding UI.
   *
   * During normal closure, the SDK waits for this promise before clearing the View, even if it rejects. Callback failures are logged when
   * enabled and do not invoke `onError`.
   */
  readonly onClose?: () => Promise<void>;
}
