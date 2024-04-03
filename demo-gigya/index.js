import { AppRegistry } from 'react-native';
import App from './src';

import { Gigya } from '@sap_oss/gigya-react-native-plugin-for-sap-customer-data-cloud';
Gigya.initFor("3_O4QE0Kk7QstG4VGDPED5omrr8mgbTuf_Gim8V_Y19YDP75m_msuGtNGQz89X0KWP", "us1.gigya.com");

import OwnIdGigya from '@ownid/react-native-gigya';

const appName = "OwnIDReactNativeGigyaDemo";
AppRegistry.registerRunnable(appName, async (initialProps) => {
    await OwnIdGigya.init({ appId: "l16tzgmvvyf5qn" });

    AppRegistry.registerComponent(appName, () => App());
    AppRegistry.runApplication(appName, initialProps);
});