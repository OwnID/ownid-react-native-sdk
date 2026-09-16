# OwnID Compat Demo

OwnID Compat Demo is a plain React Native 0.83 app that demonstrates `@ownid/react-native-core` at the SDK's minimum supported React Native version. It initializes OwnID, presents the hosted Elite flow, creates a real Demo Identity session, and loads the user's Demo Identity profile.

The app has separate DEV and UAT native build environments. Each environment supplies its OwnID app ID, Elite document origin, and Demo Identity backend from [`configuration.ts`](./src/configuration.ts).

At app startup, [`App.tsx`](./App.tsx) enables optional debug logging and initializes OwnID for the app lifetime.

## Code map

- [`App.tsx`](./App.tsx) initializes OwnID and owns the current screen and session.
- [`HomeScreen.tsx`](./src/screens/HomeScreen.tsx) renders the demo controls and actionable errors.
- [`EliteScreen.tsx`](./src/screens/EliteScreen.tsx) contains the complete `OwnIDEliteView` integration, including events and the session provider.
- [`UserScreen.tsx`](./src/screens/UserScreen.tsx) loads and displays the signed-in user's Demo Identity profile and provides logout.
- [`configuration.ts`](./src/configuration.ts) defines the DEV and UAT settings.
- [`demoIdentity.ts`](./src/identity/demoIdentity.ts) validates sessions and loads profiles from Demo Identity.

## Requirements

- A Node version accepted by `^20.19.4 || ^22.13.0 || >=24.0.0`
- npm 11.6.2 through Corepack
- The Android toolchain for React Native 0.83, with API 24 or later
- Xcode, Ruby 3.2 or later, and Bundler 2.7.2 for iOS 15.1 or later

This demo does not yet support running on iOS 27 when built with the iOS 27 SDK (Xcode 27), because its React Native 0.83 host does not use the scene lifecycle.

## Install

From this demo directory, build and pack the SDK, then install the demo from that archive just as a published package consumer would:

```sh
cd ../..
mkdir -p .artifacts
cd sdk-core
corepack npm@11.6.2 run build
corepack npm@11.6.2 pack --pack-destination ../.artifacts

cd ../demos/BaseCompat
corepack npm@11.6.2 install
bundle install
cd ios && bundle exec pod install && cd ..
```

The demo depends on `../../.artifacts/ownid-react-native-core-4.0.0.tgz`. Repack and reinstall it after changing the SDK, then refresh the iOS pods.

## Run

Start Metro in one terminal:

```sh
corepack npm@11.6.2 run start
```

Run the DEV or UAT debug app from another terminal:

```sh
corepack npm@11.6.2 run android:dev
corepack npm@11.6.2 run android:uat

corepack npm@11.6.2 run ios:dev
corepack npm@11.6.2 run ios:uat
```

The included Android keystore and iOS signing configuration are only for OwnID demo environments. Do not use them in a production app.

On Android, the demo uses React Native's standard edge-to-edge mode across its supported API 24+ range. The app keeps controls inside the safe area and adjusts status-bar icons for each screen; Android may use a contrast scrim for older releases or button navigation, while gesture navigation stays transparent.

## Check the project

```sh
corepack npm@11.6.2 run check
```
