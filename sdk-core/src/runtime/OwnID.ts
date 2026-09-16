import type { OwnIDConfigurationOptions } from '../configuration';
import type { OwnIDContext } from '../context';
import type { OwnIDProviders } from '../providers';
import type { OwnIDFlows } from '../namespace/FlowsNamespace';
import type { OwnIDInstance } from '../namespace/InstanceNamespace';
import type { OwnIDLoggingOptions } from '../logging';
import { RuntimeRoot } from './RuntimeRoot';

const DEFAULT_INSTANCE_NAME = 'DEFAULT';
const runtimeRoot = RuntimeRoot.create();

/** Entry point for configuring OwnID and accessing its authentication flows. */
export const OwnID = Object.freeze({
  /**
   * Authentication flows for the current OwnID configuration.
   *
   * Read this property again after reinitializing OwnID to start new work.
   *
   * @throws Error when OwnID has not been initialized.
   */
  get flows(): OwnIDFlows {
    return runtimeRoot.getInstanceNamespace(DEFAULT_INSTANCE_NAME).flows;
  },

  /**
   * Initializes OwnID synchronously with the supplied configuration.
   *
   * Calling this method again replaces the configuration and stops active SDK operations. Validation and copying complete before the current
   * configuration or language setting changes.
   *
   * @throws TypeError when the configuration or one of its known options is invalid.
   */
  initialize(configuration: OwnIDConfigurationOptions): void {
    runtimeRoot.initialize(DEFAULT_INSTANCE_NAME, configuration);
  },

  /**
   * Initializes OwnID synchronously from a JSON string.
   *
   * The object accepts `appId` (or `appID` when `appId` is missing or `null`), `env`, `region`, and `languages`. Environment and region are
   * case-insensitive. Missing or `null` environment and region use their defaults; unknown keys are ignored. Calling this method again
   * replaces the configuration and stops active SDK operations. Validation completes before the current configuration or language setting
   * changes.
   *
   * @throws SyntaxError when `json` is not valid JSON.
   * @throws TypeError when the parsed value is not an object or a known option is invalid.
   */
  initializeFromJson(json: string): void {
    runtimeRoot.initializeFromJson(DEFAULT_INSTANCE_NAME, json);
  },

  /**
   * Shuts down OwnID and stops active SDK operations.
   *
   * Calling this method when OwnID is not initialized has no effect. Logging and language settings remain configured. Application callbacks
   * already in progress are not cancelled.
   */
  destroy(): void {
    runtimeRoot.destroy(DEFAULT_INSTANCE_NAME);
  },

  /**
   * Configures local SDK logging. Call before initialization to capture initialization failures.
   *
   * Calling this method without options resets logging to `OwnIDLogLevel.Off` and releases the current callback. Invalid options throw a
   * `TypeError` and preserve the previous logging configuration.
   *
   * @throws TypeError when `options` or one of its known members is invalid.
   */
  configureLogging(options?: OwnIDLoggingOptions): void {
    runtimeRoot.configureLogging(options);
  },

  /**
   * Returns an `OwnIDInstance` with the complete supplied Context.
   *
   * The Context used directly through OwnID remains unchanged. An empty Context masks inherited values in the returned instance.
   *
   * @throws Error when OwnID has not been initialized.
   * @throws TypeError when `context` is invalid.
   */
  withContext(context: OwnIDContext): OwnIDInstance {
    return runtimeRoot.getInstanceNamespace(DEFAULT_INSTANCE_NAME).withContext(context);
  },

  /**
   * Updates the Context configured on OwnID and returns the current `OwnIDInstance`.
   *
   * Omitted fields retain their visible values. A `null` field clears that value.
   *
   * @throws Error when OwnID has not been initialized.
   * @throws TypeError when `patch` is invalid. A failed patch leaves Context unchanged.
   */
  setContext(patch: OwnIDContext): OwnIDInstance {
    return runtimeRoot.getInstanceNamespace(DEFAULT_INSTANCE_NAME).setContext(patch);
  },

  /**
   * Clears the Context set through OwnID and returns the current `OwnIDInstance`.
   *
   * @throws Error when OwnID has not been initialized.
   */
  clearContext(): OwnIDInstance {
    return runtimeRoot.getInstanceNamespace(DEFAULT_INSTANCE_NAME).clearContext();
  },

  /**
   * Returns an `OwnIDInstance` with the supplied provider callbacks.
   *
   * Providers used directly through OwnID remain unchanged. Omitted callbacks remain inherited, and an input with no callbacks returns the
   * current instance unchanged.
   *
   * @throws Error when OwnID has not been initialized.
   * @throws TypeError when `providers` contains an invalid group or callback.
   */
  withProviders(providers: OwnIDProviders): OwnIDInstance {
    return runtimeRoot.getInstanceNamespace(DEFAULT_INSTANCE_NAME).withProviders(providers);
  },

  /**
   * Updates the provider callbacks configured on OwnID and returns the current `OwnIDInstance`.
   *
   * Omitted members remain unchanged and cannot be cleared with `undefined`. An input with no callbacks has no effect.
   *
   * @throws Error when OwnID has not been initialized.
   * @throws TypeError when `providers` contains an invalid group or callback. Failure leaves existing providers unchanged.
   */
  setProviders(providers: OwnIDProviders): OwnIDInstance {
    return runtimeRoot.getInstanceNamespace(DEFAULT_INSTANCE_NAME).setProviders(providers);
  },
});
