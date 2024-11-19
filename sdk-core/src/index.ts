/**
 * OwnID SDK configuration.
 * 
 * @property {string} appId - (mandatory) Unique identifier for your OwnID application, obtained from the [OwnID Console](https://console.ownid.com).
 * @property {string} env - (optional) OwnID App environment. Defaults to production. Possible options include: `uat`, `staging`.
 * @property {string} region - (optional) OwnID App datacenter region. Defaults to `us`. Possible options include: `us`, `eu`.
 * @property {boolean} enableLogging - (optional) Enable OwnID logger. Logging is disabled by default.
 * @property {string} redirectionUri - (optional) Determines the user's destination after interacting with the OwnID Web App in their browser. Required for OwnID Web App flow.
 * @property {string} redirectionUriAndroid - (optional) Redirection URI for Android platform.
 * @property {string} redirectionUriIos - (optional) Redirection URI for iOS platform.
 */
export interface OwnIdConfiguration {
  appId: string;
  env?: string;
  region?: string;
  enableLogging?: boolean;
  redirectionUri?: string;
  redirectionUriAndroid?: string;
  redirectionUriIos?: string;
}

import { NativeModules } from 'react-native';
import { generatePassword } from './internal';
const { OwnIdModule } = NativeModules;

export default {
  /**
   * Creates an OwnID instance without the Integration component.
   * 
   * @param {OwnIdConfiguration} configuration - (mandatory) Configuration for the OwnID SDK.
   * @param {string} productName - (mandatory) Used in network calls as part of the `User Agent` string. Example: "DirectIntegration/3.4.0".
   * @param {string} instanceName - (optional) The name of the OwnID instance.
   * 
   * @returns {Promise<void>} - A promise indicating the completion of the initialization.
   */
  async init(configuration: OwnIdConfiguration, productName: string, instanceName?: string) {
    return OwnIdModule.createInstance(configuration, productName, instanceName);
  },

  /**
   * Sets the locale for the OwnID SDK.
   *
   * Use a valid IETF BCP 47 language tag (e.g., "en-US", "fr") to set a specific locale. 
   * See [IETF BCP 47 language tag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language) for more information.
   *
   * To use the device's default locale settings, pass `null`.
   *
   * @param locale - The locale tag string or `null` to use the platform's locale.
   * 
   * @returns {Promise<void>} A promise that resolves when the locale is set.
   */
  async setLocale(locale?: string): Promise<void> {
    return OwnIdModule.setLocale(locale);
  },

  /**
   * Enrolls a credential with OwnID.
   * 
   * @param {string} loginId - The user's login ID.
   * @param {string} authToken - The user's authentication token.
   * @param {boolean} force - (optional) if set to true, the enrollment will be forced even if the enrollment request timeout (7 days) has not passed. Defaults to false.
   * @param {string} instanceName - (optional) The name of the OwnID instance.
   * 
   * @returns {Promise<string>} - A promise with enrollment result.
   */
  async enrollCredential(loginId: string, authToken: string, force: boolean = false, instanceName?: string) {
    return OwnIdModule.enrollCredential(loginId, authToken, force, instanceName);
  },

  /**
  * Generates a random password with a specified length, containing a mix of
  * lowercase letters, uppercase letters, numbers, and special characters.
  *
  * @param {number} length - The total length of the generated password.
  * @param {number} [numberCapitalised=1] - The number of uppercase letters to include in the password.
  * @param {number} [numberNumbers=1] - The number of numerical digits to include in the password.
  * @param {number} [numberSpecial=1] - The number of special characters to include in the password.
  * 
  * @returns {string} - The generated password.
  */
  generatePassword(
    length: number,
    numberCapitalised = 1,
    numberNumbers = 1,
    numberSpecial = 1,
  ): string {
    return generatePassword(length, numberCapitalised, numberNumbers, numberSpecial);
  }
}

export type { OwnIdResponse, OwnIdPayload } from './common';
export { OwnIdButtonType, OwnIdPayloadType, OwnIdError, _setOwnIdNativeViewManager, _getViewId } from './common';
export * from './button';
export * from './authButton';
