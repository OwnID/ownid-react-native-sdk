/**
 * OwnID SDK configuration.
 * 
 * @property {string} appId - (mandatory) Unique identifier for your OwnID application, obtained from the [OwnID Console](https://console.ownid.com).
 * @property {string} env - (optional) OwnID App environment. Defaults to production. Possible options include: `uat`, `staging`.
 * @property {boolean} enableLogging - (optional) Enable OwnID logger. Logging is disabled by default.
 * @property {string} redirectionUri - (optional) Determines the user's destination after interacting with the OwnID Web App in their browser. Required for OwnID Web App flow.
 * @property {string} redirectionUriAndroid - (optional) Redirection URI for Android platform.
 * @property {string} redirectionUriIos - (optional) Redirection URI for iOS platform.
 */
export interface OwnIdConfiguration {
  appId: string;
  env?: string;
  enableLogging?: boolean;
  redirectionUri?: string;
  redirectionUriAndroid?: string;
  redirectionUriIos?: string;
}

import { NativeModules } from 'react-native';
const { OwnIdModule } = NativeModules;

export default {
  /**
   * Creates an OwnID instance without the Integration component.
   * 
   * @param {OwnIdConfiguration} configuration - (mandatory) Configuration for the OwnID SDK.
   * @param {string} productName - (mandatory) Used in network calls as part of the `User Agent` string. Example: "DirectIntegration/3.1.0".
   * @param {string} instanceName - (optional) The name of the OwnID instance.
   * 
   * @returns {Promise<void>} A promise indicating the completion of the initialization.
   */
  async init(configuration: OwnIdConfiguration, productName: string, instanceName?: string) {
    return await OwnIdModule.createInstance(configuration, productName, instanceName);
  },

  /**
   * Enrolls a credential with OwnID.
   * 
   * @param {string} loginId - The user's login ID.
   * @param {string} authToken - The user's authentication token.
   * @param {boolean} force - (optional) if set to true, the enrollment will be forced even if the enrollment request timeout (7 days) has not passed. Defaults to false.
   * @param {string} instanceName - (optional) The name of the OwnID instance.
   * 
   * @returns {Promise<string>} A promise indicating the completion of the initialization.
   */
  async enrollCredential(loginId: string, authToken: string, force: boolean = false, instanceName?: string) {
    return await OwnIdModule.enrollCredential(loginId, authToken, force, instanceName);
  }
}

export type { OwnIdResponse, OwnIdPayload, OwnIdError } from './common';
export { OwnIdButtonType, OwnIdPayloadType, _setOwnIdNativeViewManager, _getViewId } from './common';
export * from './button';
export * from './authButton';