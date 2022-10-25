![logo](logo.svg)
<br>
<br>
[![React Native Core SDK version](https://img.shields.io/npm/v/@ownid/react-native-core?label=React%20Native%20Core%20SDK)](https://www.npmjs.com/package/@ownid/react-native-core) [![React Native Gigya SDK version](https://img.shields.io/npm/v/@ownid/react-native-gigya?label=React%20Native%20Gigya%20SDK)](https://www.npmjs.com/package/@ownid/react-native-gigya)

## OwnID React Native SDK

The [OwnID](https://ownid.com/) React Native SDK is a client library that provides a passwordless login alternative for your React Native application by using cryptographic keys to replace the traditional password. The SDK allows the user to perform Registration and Login flows in a React Native application.

The OwnID React Native SDK consists of a Core module along with modules that are specific to an identity platform.

The React Native Core module wraps native [Android Core](https://github.com/OwnID/ownid-android-sdk) and [iOS Core](https://github.com/OwnID/ownid-ios-sdk) modules that provide core functionality like setting up an OwnID configuration, performing network calls to the OwnID server, interacting with a browser, handling a redirect URI, and checking and returning results to the application.

The following modules extend the React Native Core Core module for a specific identify management system:
 - [OwnID SAP CDC React Native SDK](https://docs.ownid.com/Integrations/sap-cdc-react)

## Demo applications

This repository contains OwnID Demo application sources for different types of identity platforms:
 - Gigya integration demo - `demo-gigya`.

You can run these demo apps on a physical Android/iOS device or an emulator.

## Feedback
We'd love to hear from you! If you have any questions or suggestions, feel free to reach out by creating a GitHub issue.

## License

```
Copyright 2022 OwnID INC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```