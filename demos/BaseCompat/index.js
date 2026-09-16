/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { configurations } from './src/configuration';

const DevApp = () => <App configuration={configurations.dev} />;
const UatApp = () => <App configuration={configurations.uat} />;

AppRegistry.registerComponent('OwnIDCompactDemoDev', () => DevApp);
AppRegistry.registerComponent('OwnIDCompactDemoUat', () => UatApp);
