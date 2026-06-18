import { NativeModules, requireNativeComponent, UIManager, Platform } from "react-native";
import { OwnIdConfiguration, _setOwnIdNativeViewManager, _getViewId, OwnIdButtonType, OwnIdError } from "@ownid/react-native-core";

import NativeOwnIdGigyaModule from './specs/NativeOwnIdGigyaModule';
import NativeGigyaButton from './specs/NativeOwnIdGigyaButtonNativeComponent';

const OwnIdGigyaModule = NativeOwnIdGigyaModule ?? (NativeModules as any).OwnIdGigyaModule;

function isFabric(): boolean {
    try { return !!(global as any)?.nativeFabricUIManager; } catch { return false; }
}

if (Platform.OS === 'android') {
    if (isFabric()) {
        _setOwnIdNativeViewManager(NativeGigyaButton as any);
    } else {
        _setOwnIdNativeViewManager(requireNativeComponent('OwnIdGigyaButtonManager'));
    }
}

/**
 * Represents Gigya session info.
 */
export interface SessionInfo {
    sessionToken: string;
    sessionSecret: string;
    expirationTime: number;
}

/**
 * Class wrapper for GigyaError - [message] contains error json data.
 */
export class GigyaException extends OwnIdError {
    constructor({ className, code, message, cause, stackTrace }: OwnIdError) {
        super({ className, code, message, cause, stackTrace });
    }
}

export default {
    /**
     * Creates OwnID instance with Gigya as Integration component.
     * 
     * Use it if you use default Gigya account model (`GigyaAccount` class / `GigyaAccount` struct ).
     * 
     * Must be called after Android/iOS native Gigya instance is initialized.
     * 
     * @param {OwnIdConfiguration} configuration - (mandatory) OwnID SDK configuration.
     * 
     * @returns {Promise<void>} - A promise indicating the completion of the initialization.
     */
    async init(configuration: OwnIdConfiguration) {
        return OwnIdGigyaModule.createInstance(configuration);
    },
}

export * from "@ownid/react-native-core";

export type RegistrationParameters = any;

export const OwnIdRegister = (loginId: string, registrationParameters?: RegistrationParameters) => {
    if (Platform.OS === 'android') {
        if (isFabric()) {
            OwnIdGigyaModule.registerAtViewTag(_getViewId(OwnIdButtonType.Register), loginId, registrationParameters);
        } else {
            // @ts-ignore
            UIManager.dispatchViewManagerCommand(_getViewId(OwnIdButtonType.Register), UIManager.OwnIdGigyaButtonManager.Commands.register.toString(), [loginId, registrationParameters]);
        }
    }
    if (Platform.OS === 'ios') {
        if (isFabric()) {
            OwnIdGigyaModule.register(loginId, registrationParameters);
        } else {
            OwnIdGigyaModule.register(loginId, registrationParameters);
        }
    }
};
