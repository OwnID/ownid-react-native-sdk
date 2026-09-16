# OwnID Expo Demo

OwnID Expo Demo is an Expo development-build app that demonstrates the OwnID SDK Elite flow with the Brita UAT application. A successful OwnID login creates a Brita session, verifies it through Brita's current-user API, and shows the authenticated user's name and email until local logout.

The demo uses Expo 57.0.23 with React Native 0.86.3. Expo Go cannot load the SDK's Android native module, so run a local native development build.

At app startup, [`App.tsx`](./App.tsx) enables optional debug logging and initializes OwnID for the application lifetime. Reinitialization replaces the current SDK instance, so ordinary screen cleanup does not destroy it.

## Code map

- [`App.tsx`](./App.tsx) initializes OwnID and coordinates the Home, Elite, and User screens.
- [`HomeScreen.tsx`](./src/screens/HomeScreen.tsx) renders initialization status and starts Elite.
- [`EliteScreen.tsx`](./src/screens/EliteScreen.tsx) owns `OwnIDEliteView`, its callbacks, and the Brita session provider.
- [`UserScreen.tsx`](./src/screens/UserScreen.tsx) displays the authenticated Brita user and provides local logout.
- [`configuration.ts`](./src/configuration.ts) contains the fixed Brita UAT application, origin, and current-user endpoint.
- [`britaSession.ts`](./src/identity/britaSession.ts) validates the OwnID token and creates the Brita session through `/api/auth/me`.
- [`withDemoAndroidSigning.js`](./plugins/withDemoAndroidSigning.js) keeps the generated Android debug build on the registered demo signing key.

## Requirements

- Node 22.13 or later and npm 11.6.2
- Android 7/API 24 or later with compile/target API 36
- iOS 16.4 or later with Xcode 26.4 or later
- A local checkout containing the SDK source in `../../sdk-core`

The demo's [`app.config.ts`](./app.config.ts) already declares Android camera, coarse-location, and fine-location permissions and supplies iOS camera and foreground-location purpose text for its configured Unico flow. Applications using that flow need equivalent native declarations with truthful, application-specific iOS text, followed by a native rebuild.

From this demo directory, build and pack the SDK, then install the demo from that archive:

```sh
cd ../..
mkdir -p .artifacts
cd sdk-core
corepack npm@11.6.2 run build
corepack npm@11.6.2 pack --pack-destination ../.artifacts

cd ../demos/ExpoLatest
corepack npm@11.6.2 install
```

The demo depends on `../../.artifacts/ownid-react-native-core-4.0.0.tgz`. Repack and reinstall it after changing the SDK. JavaScript or TypeScript changes then need only a Metro reload. Rebuild the target app after changing native SDK code. Regenerate the target native project first after changing native dependencies, Expo app configuration, a config plugin, or the Expo SDK version.

## Run the demo

Build, install, and run the UAT app on a connected physical device:

```sh
corepack npm run android -- --device
corepack npm run ios -- --device
```

Omit `--device` to use the default Android emulator or iOS Simulator. Each run command starts Metro on the demo's reserved port 8082 when needed and reuses an existing Metro server for this project. Keep that Metro terminal running while building the other platform in a separate terminal.

Once the development build is installed, the daily JavaScript and TypeScript development loop needs only Metro:

```sh
corepack npm run start
```

Open the installed development build and scan Metro's QR code on each physical phone, or select the discovered server from the development launcher. Both platforms use the same Metro server, and Fast Refresh applies source edits automatically. Reload the app when validating startup behavior or when Fast Refresh preserves state that the change depends on.

When native regeneration is required, run the matching clean prebuild before the platform run command:

```sh
corepack npm run prebuild:android
corepack npm run prebuild:ios
```

Both platforms use `com.ownid.demo.uat`, so installing this app replaces the UAT BaseCompat demo on the same device. Android debug builds use the registered demo keystore outside the generated `android/` directory. iOS uses automatic signing with team `GR7KL5JY22` and the `webcredentials:brita.fido.fun` associated domain.

The demo-root [`assetlinks.json`](./assetlinks.json) and [`apple-app-site-association`](./apple-app-site-association) are website artifacts for Brita's `.well-known/` paths; native builds do not bundle them.

The Home and User screens follow the system light or dark appearance. Elite opens on a white full-screen safe-area surface without an app header or Back button.

## Development checks

```sh
corepack npm run config
corepack npm run dependencies:check
corepack npm run format:check
corepack npm run lint
corepack npm run typecheck
```

The demo keeps `react-native-webview` 16.0.0 because it is the SDK-required peer.
