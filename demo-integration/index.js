import { AppRegistry } from 'react-native';
import App from './src';

import Auth from './auth.service';
const auth = new Auth("https://node-mongo.custom.demo.dev.ownid.com/api/auth/");

import OwnId from '@ownid/react-native-core';

const appName = "OwnIDReactNativeIntegrationDemo";

AppRegistry.registerRunnable(appName, async (initialProps) => {
    await OwnId.init({ appId: "d1yk6gcngrc0og", env: "dev" }, "OwnIDIntegration/3.1.0");

    AppRegistry.registerComponent(appName, () => App(auth));
    AppRegistry.runApplication(appName, initialProps);
});