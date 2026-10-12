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
   * `true` means the attempt has ended or could not start; dismiss the screen or mount a new View to try again.
   * `false` means the error alone does not end the attempt or guarantee recovery; keep the screen open unless your app needs to close it.
   */
  readonly terminal: boolean;
}

/**
 * Optional application callbacks for one mounted Elite flow.
 *
 * The application owns navigation and dismissal of the surrounding screen or modal. Closing the View does not cancel application work
 * already in progress.
 */
export interface OwnIDEliteEvents {
  /**
   * Called after successful hosted authentication. Update application state or navigate as needed.
   *
   * During normal completion, the SDK waits for this promise before clearing the View, even if it rejects.
   */
  readonly onFinish?: (params: OwnIDEliteFinishParams) => Promise<void>;
  /**
   * Called for hosted authentication errors and unrecovered preparation, loading, or runtime failures.
   * Use `details.terminal` to decide whether to keep the screen open or dismiss it.
   */
  readonly onError?: (message: string, details: OwnIDEliteErrorDetails) => Promise<void>;
  /**
   * Called when the hosted flow requests to close without successful completion. Dismiss the surrounding UI.
   *
   * During normal closure, the SDK waits for this promise before clearing the View, even if it rejects.
   */
  readonly onClose?: () => Promise<void>;
}
