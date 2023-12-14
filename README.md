![logo](docs/logo.svg)
<br>
<br>
[![React Native Core SDK version](https://img.shields.io/npm/v/@ownid/react-native-core?label=React%20Native%20Core%20SDK)](https://www.npmjs.com/package/@ownid/react-native-core) [![React Native Gigya SDK version](https://img.shields.io/npm/v/@ownid/react-native-gigya?label=React%20Native%20Gigya%20SDK)](https://www.npmjs.com/package/@ownid/react-native-gigya)

## OwnID React Native SDK

The [OwnID](https://ownid.com/) React Native SDK is a client library that provides a passwordless login alternative for your React Native application by using cryptographic keys to replace the traditional password. The SDK allows the user to perform Registration and Login flows in a React Native application.

The OwnID React Native SDK consists of a Core module along with modules that are specific to an identity platform.

The React Native Core module wraps native  [Android Core](https://github.com/OwnID/ownid-android-sdk) and [iOS Core](https://github.com/OwnID/ownid-ios-sdk) modules that provide core functionality like setting up an OwnID configuration, performing network calls to the OwnID server, interacting with a browser, handling a redirect URI, and checking and returning results to the  application.

- **[OwnID Gigya React Native SDK](docs/sdk-react-navive-gigya-doc.md)** - Extends Native Core SDK functionality by providing integration with Email/Password-based Gigya Authentication. Gigya React Native module is based on native [Android Gigya SDK](https://github.com/OwnID/ownid-android-sdk/blob/master/docs/sdk-gigya-doc.md) and [iOS Gigya SDK](https://github.com/OwnID/ownid-ios-sdk/blob/master/Docs/sdk-gigya-doc.md) modules.

## Custom Integration

You can use **[OwnID Core React Native SDK](docs/sdk-react-navive-core-doc.md)** to gain all of the benefits of OwnID with custom identity platform. Check **[OwnID React Native Core SDK - Custom Integration](docs/sdk-react-navive-core-doc.md)** for detailed steps.

## Demo applications

This repository contains OwnID Demo application sources for different types of integrations:
 - Custom integration demo - `demo-custom`.
 - Gigya integration demo - `demo-gigya`.

You can run these demo apps on a physical Android/iOS device or an emulator.

## Supported Languages
The OwnID SDK has built-in support for multiple languages. The SDK loads translations in runtime and selects the best language available. The list of currently supported languages can be found [here](https://i18n.prod.ownid.com/langs.json).

The SDK will also make the RTL adjustments if needed. If the user's mobile device uses a language that is not supported, the SDK displays the Skip Password feature in English.

## Data Safety
The OwnID SDK does not store any user data on the user's device.

The OwnID SDK collects data and information about events inside the SDK using Log Data. This Log Data does not include any personal data that can be used to identify the user such as username, email, and password. It does include general information like the device Internet Protocol (“IP”) address, device model, operating system version, time and date of events, and other statistics.

Log Data is sent to the OwnID server using an encrypted process so it can be used to collect OwnID service statistics and improve service quality. OwnID does not share Log Data with any third party services.

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