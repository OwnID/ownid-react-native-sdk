# OwnID Compat Demo

A React Native 0.83 app demonstrating OwnID Elite sign-in with the Demo Identity service. Tap **Start Elite Flow**, complete sign-in, and view your user profile. **Logout** returns to the start screen.

## Requirements

- Node 20.x (20.19.4+), 22.x (22.13+), or 24+; npm 11.6.2 through Corepack
- For Android: the React Native Android toolchain with SDK API 36, and an emulator or device running Android 7/API 24 or later
- For iOS: macOS, Xcode 26, an iOS Simulator runtime, Ruby 3.2+, and Bundler 2.7.2

Use an iOS 26 or earlier Simulator runtime (minimum iOS 15.1). This demo does not support iOS 27/Xcode 27.

## Install

From the repository root:

```sh
cd demos/BaseCompat
corepack npm@11.6.2 install
```

For iOS only, install the native dependencies on macOS:

```sh
bundle install
cd ios
bundle exec pod install
cd ..
```

The demo installs `@ownid/react-native-core` 4.0.1 from npm.

## Run

From `demos/BaseCompat`, start Metro and keep the terminal open:

```sh
corepack npm@11.6.2 run start
```

In another terminal, also in `demos/BaseCompat`, run the UAT demo on your chosen platform.

For Android, start an emulator or connect a device with USB debugging enabled:

```sh
corepack npm@11.6.2 run android:uat
```

For the iOS Simulator on macOS:

```sh
corepack npm@11.6.2 run ios:uat
```

Use `android:dev` or `ios:dev` instead for the DEV environment. Physical iOS builds require access to the configured Apple signing team; use the Simulator if you do not have that access.

See [`EliteScreen.tsx`](./src/screens/EliteScreen.tsx) for the integration example.
