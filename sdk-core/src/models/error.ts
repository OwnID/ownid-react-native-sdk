/**
 * Stable error code reported by OwnID.
 *
 * Member values are canonical and case-sensitive. Error details and recovery behavior depend on the API that reports the code.
 */
export enum ErrorCode {
  /** The operation was aborted before completion. */
  ABORTED = 'aborted',
  /** The current operation does not support cancellation. */
  CANCEL_NOT_SUPPORTED = 'cancel_not_supported',
  /** The current device cannot perform the requested operation. */
  DEVICE_NOT_SUPPORTED = 'device_not_supported',
  /** A required browser document element could not be found. */
  DOM_ELEMENT_NOT_FOUND = 'dom_element_not_found',
  /** A required login identifier was empty. */
  EMPTY_LOGIN_ID = 'empty_login_id',
  /** The server refused the requested action. */
  FORBIDDEN = 'forbidden',
  /** The host application integration is invalid or incomplete. */
  INTEGRATION_ERROR = 'integration_error',
  /** A supplied argument was invalid. */
  INVALID_ARGUMENT = 'invalid_argument',
  /** The authentication challenge was invalid. */
  INVALID_CHALLENGE = 'invalid_challenge',
  /** The supplied login identifier type is unsupported. */
  LOGIN_ID_TYPE_NOT_SUPPORTED = 'login_id_type_not_supported',
  /** The supplied login identifier failed validation. */
  LOGIN_ID_VALIDATION_FAILED = 'login_id_validation_failed',
  /** Password authentication failed. */
  LOGIN_WITH_PASSWORD_FAILED = 'login_with_password_failed',
  /** The operation exhausted its allowed attempts. */
  MAXIMUM_ATTEMPTS_REACHED = 'maximum_attempts_reached',
  /** The flow exhausted its allowed challenges. */
  MAXIMUM_CHALLENGES_REACHED = 'maximum_challenges_reached',
  /** Verification exhausted its allowed resend attempts. */
  MAXIMUM_RESEND_ATTEMPTS_REACHED = 'maximum_resend_attempts_reached',
  /** A required capability provider is missing. */
  MISSING_CAPABILITY_PROVIDER = 'missing_capability_provider',
  /** No required delivery channel was supplied. */
  MISSING_CHANNEL = 'missing_channel',
  /** A network request failed. */
  NETWORK = 'network',
  /** No registered passkey can satisfy the request. */
  NO_APPLICABLE_PASSKEYS = 'no_applicable_passkeys',
  /** A notification or offer is currently suppressed. */
  NOTIFICATION_BLOCKED = 'notification_blocked',
  /** OIDC authentication failed. */
  OIDC_FAILED = 'oidc_failed',
  /** The passkey is already registered. */
  PASSKEY_ALREADY_REGISTERED = 'passkey_already_registered',
  /** A requested passkey could not be created. */
  PASSKEY_NOT_CREATED = 'passkey_not_created',
  /** Passkeys are unavailable in the current environment. */
  PASSKEYS_NOT_SUPPORTED = 'passkeys_not_supported',
  /** Required UI screens are not ready. */
  SCREENS_NOT_READY = 'screens_not_ready',
  /** The application session could not be established. */
  SESSION_NOT_ESTABLISHED = 'session_not_established',
  /** The operation did not complete before its deadline. */
  TIMEOUT = 'timeout',
  /** The request lacks valid authorization. */
  UNAUTHORIZED = 'unauthorized',
  /** The SDK could not classify the error. */
  UNKNOWN = 'unknown',
  /** The user account is blocked. */
  USER_BLOCKED = 'user_blocked',
  /** The active user changed during the operation. */
  USER_CHANGED = 'user_changed',
  /** The requested user account was not found. */
  USER_NOT_FOUND = 'user_not_found',
  /** The supplied verification code was incorrect. */
  VERIFICATION_CODE_WRONG = 'verification_code_wrong',
  /** A widget already exists for the requested target. */
  WIDGET_ALREADY_EXISTS = 'widget_already_exists',
}

Object.freeze(ErrorCode);

/** Structured details reported with an OwnID error. */
export interface ErrorDetails {
  /** Stable code identifying the error category. */
  readonly code: ErrorCode;
  /** Source identifier associated with the error. */
  readonly source: string;
  /** Optional structured or textual detail whose shape depends on `code`. */
  readonly additionalDetails?: object | string;
}
