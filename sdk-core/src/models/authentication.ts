import type { OperationType } from './operation';

/**
 * Authentication method reported by OwnID.
 *
 * Each member's value is the canonical, case-sensitive value reported in authentication results.
 */
export enum AuthMethod {
  /** Authentication with a one-time passcode. */
  OTP = 'otp',
  /** Authentication with a passkey. */
  PASSKEY = 'passkey',
  /** Authentication through a magic link. */
  MAGIC_LINK = 'magic-link',
  /** Authentication with a password. */
  PASSWORD = 'password',
  /** Authentication completed through deferred verification. */
  DEFERRED = 'deferred',
  /** Authentication accepted without an additional authentication challenge. */
  IMMEDIATE = 'immediate',
  /** Authentication method was not recognized. */
  UNKNOWN = 'unknown',
  /** Google was reported as the authentication method. */
  SOCIAL_GOOGLE = 'social-google',
  /** Apple was reported as the authentication method. */
  SOCIAL_APPLE = 'social-apple',
  /** Authentication with FaceKey. */
  FACEKEY = 'facekey',
}

Object.freeze(AuthMethod);

/**
 * Login data supplied to an application session provider.
 *
 * OwnID supplies authentication metadata alongside application-defined session fields.
 */
export interface LoginPayload {
  /** OwnID authentication metadata. */
  readonly metadata: {
    /** Login identifier used for the authentication. */
    readonly loginId: string;
    /** OwnID authentication token, when one was issued. */
    readonly authToken?: string;
    /** Authentication method reported by OwnID. */
    readonly authType: AuthMethod;
    /** Proof tokens keyed by the operation that produced each token. */
    readonly proofTokens?: Partial<Record<OperationType, string>>;
  };
  /** Additional opaque application-session fields. A consumer must narrow each field before using it. */
  readonly [key: string]: unknown;
}

/**
 * Outcome returned by an application authentication or session provider.
 *
 * Each consuming API defines which status represents success.
 */
export type AuthResult =
  | {
      /** The application session was established. */
      readonly status: 'logged-in';
      /** Optional application-defined result. */
      readonly result?: unknown;
    }
  | {
      /** Authentication completed and produced an application-defined session payload. */
      readonly status: 'auth-completed';
      /** Application-defined data produced by authentication. */
      readonly sessionPayload: unknown;
    }
  | {
      /** The provider operation completed successfully. */
      readonly status: 'success';
      /** Optional application-defined result. */
      readonly result?: unknown;
    }
  | {
      /** The provider operation failed. */
      readonly status: 'fail';
      /** Optional human-readable failure reason. */
      readonly reason?: string;
    };
