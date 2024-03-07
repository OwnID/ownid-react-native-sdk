import { AppRegistry } from 'react-native';
import App from './src';

import GigyaAuth from './auth.service';
import OwnIdGigya from '@ownid/react-native-gigya';

const appName = "OwnIDReactNativeGigyaDemo";

AppRegistry.registerRunnable(appName, async (initialProps) => {
    await GigyaAuth.initialize("3_O4QE0Kk7QstG4VGDPED5omrr8mgbTuf_Gim8V_Y19YDP75m_msuGtNGQz89X0KWP", "us1.gigya.com");
    await OwnIdGigya.init({ appId: "l16tzgmvvyf5qn" });

    AppRegistry.registerComponent(appName, () => App(GigyaAuth));
    AppRegistry.runApplication(appName, initialProps);
});