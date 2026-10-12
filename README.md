<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/images/logo-dark.svg">
  <img alt="OwnID" src="docs/images/logo-dark.svg" width="260">
</picture>

# OwnID React Native SDK

[![OwnID React Native Core SDK version](https://img.shields.io/npm/v/@ownid/react-native-core?label=OwnID%20React%20Native%20Core%20SDK)](https://www.npmjs.com/package/@ownid/react-native-core)

OwnID React Native SDK adds passkey-first authentication to React Native apps.

OwnID provides the authentication UI, while your app manages its session and navigation.

## Install

Install the SDK and React Native WebView in your app:

```sh
npm install @ownid/react-native-core@next react-native-webview@^16.0.0
```

## Requirements

Use React Native 0.83 or newer with the New Architecture, React 19 (19.2 or newer), and React Native WebView 16.x. The SDK supports Android API 24 or newer and iOS 15.1 or newer.

## Start Here

1. [Configure OwnID](docs/configuration.md) with your application ID.
2. [Enable passkeys](https://docs.ownid.com/mobile-sdks/setup/passkeys) for your Android and iOS apps.
3. [Configure shared providers (optional)](docs/providers.md).
4. [Add Elite Flow](docs/elite-flow.md) to your authentication screen.

## Example

[Demo Compat](demos/BaseCompat) shows a complete React Native integration.

## Support

For integration help, contact [support@ownid.com](mailto:support@ownid.com).

## License

This SDK is distributed under the [Apache 2.0 license](LICENSE).
