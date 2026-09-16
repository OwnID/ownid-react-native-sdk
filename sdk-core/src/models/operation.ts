/**
 * Kind of OwnID authentication, enrollment, account, or integration operation.
 *
 * Each member's value is a canonical, case-sensitive identifier used in OwnID data.
 */
export enum OperationType {
  /** Collects a login identifier. */
  LOGIN_ID_COLLECT = 'LoginIdCollect',
  /** Verifies an email address. */
  EMAIL_VERIFICATION = 'EmailVerification',
  /** Enrolls an email address. */
  EMAIL_ENROLLMENT = 'EmailEnrollment',
  /** Verifies a phone number. */
  PHONE_NUMBER_VERIFICATION = 'PhoneNumberVerification',
  /** Enrolls a phone number. */
  PHONE_NUMBER_ENROLLMENT = 'PhoneNumberEnrollment',
  /** Creates a passkey. */
  PASSKEY_CREATION = 'PasskeyCreation',
  /** Authenticates with a passkey. */
  PASSKEY_AUTH = 'PasskeyAuth',
  /** Enrolls a passkey for an authenticated user. */
  PASSKEY_ENROLLMENT = 'PasskeyEnrollment',
  /** Establishes an application session. */
  SESSION_CREATION = 'SessionCreation',
  /** Completes authentication asynchronously. */
  DEFERRED_AUTHENTICATION = 'DeferredAuthentication',
  /** Authenticates through an external provider. */
  EXTERNAL_AUTHENTICATION = 'ExternalAuthentication',
  /** Collects profile information. */
  PROFILE_COLLECTION = 'ProfileCollection',
  /** Authenticates with a password. */
  PASSWORD_AUTHENTICATION = 'PasswordAuthentication',
  /** Authenticates with Apple through OIDC. */
  OIDC_AUTHENTICATION_APPLE = 'OidcAuthenticationApple',
  /** Authenticates with Google through OIDC. */
  OIDC_AUTHENTICATION_GOOGLE = 'OidcAuthenticationGoogle',
  /** Registers a user. */
  REGISTRATION = 'Registration',
  /** Updates a user profile. */
  PROFILE_UPDATE = 'ProfileUpdate',
  /** Manages an application session. */
  SESSION_MANAGEMENT = 'SessionManagement',
  /** Represents hosted Web integration work. */
  WEB_BRIDGE = 'WebBridge',
  /** Verifies a user with FaceKey. */
  FACE_KEY_VERIFICATION = 'FaceKeyVerification',
  /** Creates a FaceKey identity. */
  FACE_KEY_CREATION = 'FaceKeyCreation',
  /** Enrolls FaceKey for an authenticated user. */
  FACE_KEY_ENROLLMENT = 'FaceKeyEnrollment',
  /** Verifies an identity document. */
  ID_DOCUMENT_VERIFICATION = 'IdDocumentVerification',
}

Object.freeze(OperationType);
