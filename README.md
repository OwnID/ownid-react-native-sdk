![logo](docs/logo.svg)
<br>
<br>
[![React Native Core SDK version](https://img.shields.io/npm/v/@ownid/react-native-core?label=React%20Native%20Core%20SDK)](https://www.npmjs.com/package/@ownid/react-native-core) [![React Native Gigya SDK version](https://img.shields.io/npm/v/@ownid/react-native-gigya?label=React%20Native%20Gigya%20SDK)](https://www.npmjs.com/package/@ownid/react-native-gigya)
## OwnID React Native SDK

The [OwnID](https://ownid.com/) React Native SDK is a client library offering a secure and passwordless login alternative for your React Native applications. It leverages [Passkeys](https://www.passkeys.com/) to replace conventional passwords, fostering enhanced authentication methods and empowers users to seamlessly execute Registration and Login flows within their React Native applications.

### Key components of the OwnID React Native SDK:

- **OwnID React Native Core** - Wraps native [Android Core](https://github.com/OwnID/ownid-android-sdk) and [iOS Core](https://github.com/OwnID/ownid-ios-sdk) modules and facilitates fundamental functionality such as SDK configuration, UI widgets, interaction with the Android or iOS system, and the return of OwnID flow results to the React Native application.

- **OwnID React Native Integration Component** - An optional extension of the React Native Core SDK, designed for seamless integration with identity platforms on the native side. When present, it executes the actual registration and login processes into the identity platform.

### To integrate OwnID with your identity platform, you have two pathways:

- **[Direct Integration](docs/sdk-react-navive-integration.md)** - Handle OwnID Response data directly in React Native without using the Integration component.

- **Prebuilt Integration** - Utilize the existing OwnID SDK with a prebuilt Integration component. Options include:

   - **[OwnID Gigya](docs/sdk-react-navive-gigya.md)** - Expands React Native Core SDK functionality by offering a prebuilt Gigya Integration, supporting Email/Password-based [Gigya Android Authentication](https://github.com/SAP/gigya-android-sdk) and [Gigya iOS Authentication](https://github.com/SAP/gigya-swift-sdk). SDK is based on native [OwnID Android Gigya SDK](https://github.com/OwnID/ownid-android-sdk) and [OwnID iOS Gigya SDK](https://github.com/OwnID/ownid-ios-sdk) modules.

### Advanced Configuration

Explore advanced configuration options in OwnID React Native Core SDK by referring to the [Advanced Configuration](docs/sdk-advanced-configuration.md) documentation.

## Demo applications

This repository hosts various OwnID Demo applications, each showcasing integration scenarios:

- **Direct Integration**: `demo-integration` module exemplifies the integration process by directly handling OwnID Response in React Native application.

- **Gigya Prebuilt Integration**: `demo-gigya` module exemplifies the integration process of Gigya Email/Password-based Authentication.

You can run these demo apps on a physical Android/iOS device or an emulator.

## Supported Languages

The OwnID SDK has built-in support for multiple languages. The SDK loads translations in runtime and selects the best language available. The list of currently supported languages can be found [here](https://i18n.prod.ownid.com/langs.json).

The SDK will also make the RTL adjustments if needed. If the user's mobile device uses a language that is not supported, the SDK displays the Skip Password feature in English.

## Data Safety
The OwnID SDK collects data and information about events inside the SDK using Log Data. This Log Data does not include any personal data that can be used to identify the user such as username, email, and password. It does include general information like the device Internet Protocol (“IP”) address, device model, operating system version, time and date of events, and other statistics.

Log Data is sent to the OwnID server using an encrypted process so it can be used to collect OwnID service statistics and improve service quality. OwnID does not share Log Data with any third party services.

## Feedback

We'd love to hear from you! If you have any questions or suggestions, feel free to reach out by creating a GitHub issue.

## License

```
Copyright 2023 OwnID INC.

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
