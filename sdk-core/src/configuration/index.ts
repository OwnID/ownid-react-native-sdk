/** OwnID service environment. Defaults to production. */
export type OwnIDEnv = 'prod' | 'uat';

/** Region used for OwnID requests. Choose where your OwnID application is provisioned; defaults to the United States. */
export type OwnIDRegion = 'us' | 'eu';

/**
 * Configuration for `OwnID.initialize`.
 *
 * Invalid values throw a `TypeError` without changing the current SDK configuration.
 */
export type OwnIDConfigurationOptions = Readonly<{
  /** OwnID application ID from the OwnID Console. Required, non-empty, ASCII alphanumeric, and not trimmed. */
  appId: string;
  /** OwnID service environment. Defaults to `'prod'`. */
  env?: OwnIDEnv;
  /** Region used for OwnID requests. Defaults to `'us'`. */
  region?: OwnIDRegion;
  /**
   * Ordered SDK language preferences. Omission or `null` preserves the current setting, an empty list restores automatic selection, and a
   * non-empty list replaces the override. The current authentication UI uses the first preference. Values are copied without locale
   * validation. Calling `OwnID.destroy()` does not reset this setting.
   */
  languages?: readonly string[] | null;
}>;
