import { NativeModules, requireNativeComponent, UIManager, Platform } from "react-native";
import { OwnIdConfiguration, _setOwnIdNativeViewManager, _getViewId, OwnIdButtonType } from "@ownid/react-native-core";

const { OwnIdGigyaModule } = NativeModules;

if (Platform.OS === 'android') {
    _setOwnIdNativeViewManager(requireNativeComponent('OwnIdGigyaButtonManager'));
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
     * @returns {Promise<void>} A promise indicating the completion of the initialization.
     */
    async init(configuration: OwnIdConfiguration) {
        return await OwnIdGigyaModule.createInstance(configuration);
    }
}

export * from "@ownid/react-native-core";

export type RegistrationParameters = any;

export const OwnIdRegister = (loginId: string, registrationParameters?: RegistrationParameters) => {
    if (Platform.OS === 'android') {
        // @ts-ignore
        UIManager.dispatchViewManagerCommand(_getViewId(OwnIdButtonType.Register), UIManager.OwnIdGigyaButtonManager.Commands.register.toString(), [loginId, registrationParameters]);
    }
    if (Platform.OS === 'ios') {
        OwnIdGigyaModule.register(loginId, registrationParameters);
    }
};