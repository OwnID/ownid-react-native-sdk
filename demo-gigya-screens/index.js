import { AppRegistry } from 'react-native';
import App from './src';

import { Gigya } from '@sap_oss/gigya-react-native-plugin-for-sap-customer-data-cloud';

Gigya.initFor("...");

import OwnIdGigya from '@ownid/react-native-gigya';

OwnIdGigya.init({ appId: "..." });

const appName = "OwnIDReactNativeGigyaScreenSetDemo";
AppRegistry.registerComponent(appName, () => App);