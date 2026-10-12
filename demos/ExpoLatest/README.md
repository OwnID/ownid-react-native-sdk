# OwnID Expo Demo

An Expo 57 app with React Native 0.86 demonstrating OwnID Elite sign-in with the Brita UAT application. Tap **Start Elite Flow**, complete sign-in, and view your name and email. **Logout** returns to the start screen.

This demo uses a native development build and cannot run in Expo Go.

## Requirements

- Node 22.13+ and npm 11.6.2 through Corepack
- For Android: the Android toolchain with SDK API 36, and an emulator or device running Android 7/API 24 or later
- For iOS: macOS, Xcode 26.4+, and an iOS Simulator running iOS 16.4 or later

## Install

From the repository root:

```sh
cd demos/ExpoLatest
corepack npm@11.6.2 install
```

The demo installs `@ownid/react-native-core` 4.0.1 from npm.

## Run

From `demos/ExpoLatest`, run the UAT demo on your chosen platform.

For the Android emulator:

```sh
corepack npm@11.6.2 run android
```

For the iOS Simulator on macOS:

```sh
corepack npm@11.6.2 run ios
```

These commands generate the native project on the first run, build and install the app, and start Metro. Keep the Metro terminal open.

Add `-- --device` to either command to select an emulator, Simulator, or connected physical device. Physical iOS builds require access to the configured Apple signing team; use the Simulator if you do not have that access.

This demo and BaseCompat UAT use the same app identifier, so installing one replaces the other on the same device.

See [`EliteScreen.tsx`](./src/screens/EliteScreen.tsx) for the integration example.
