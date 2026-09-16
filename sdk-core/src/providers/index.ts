import type { AuthResult, LoginPayload } from '../models/authentication';

/**
 * Application callbacks used by the SDK to integrate with the application's services.
 *
 * Register callbacks with `OwnID.setProviders`, or supply overrides through `OwnID.withProviders`. Groups and members are optional so
 * selected callbacks can be overridden. Omitted callbacks remain available through inherited providers or stay unchanged when updating
 * providers. SDK work that requires a callback checks for it before starting.
 */
export interface OwnIDProviders {
  /** Callbacks for creating or restoring the application's session. */
  readonly session?: {
    /**
     * Creates or restores the application's session after OwnID authentication.
     *
     * OwnID supplies a {@link LoginPayload} containing the login identifier, authentication method, optional tokens, and application session
     * data. Use it to create or restore the application's session, including any service calls and persistence your app requires. Resolve
     * with an {@link AuthResult} after that work finishes; return `{ status: 'fail', reason }` if the session cannot be established. Throwing
     * or rejecting reports failure to the requesting SDK operation. Once invoked, SDK teardown does not cancel the application's promise.
     */
    readonly create?: (payload: LoginPayload) => Promise<AuthResult>;
  };
}
