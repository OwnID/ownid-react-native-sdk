import { AppRegistry } from 'react-native';
import App from './src';

import Auth from './auth.service';
const auth = new Auth("...");

import OwnId from '@ownid/react-native-core';

const appName = "OwnIDReactNativeIntegrationDemo";

AppRegistry.registerRunnable(appName, async (initialProps) => {
    await OwnId.init({ appId: "..." }, "OwnIDIntegration/3.1.0");

    AppRegistry.registerComponent(appName, () => App(auth));
    AppRegistry.runApplication(appName, initialProps);
});