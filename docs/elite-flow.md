# Elite Flow

Elite Flow presents OwnID's hosted passkey-first authentication experience inside a WebView. Use it when OwnID should provide the authentication UI while your app owns the surrounding screen, creates the app session, and handles navigation or dismissal.

Before adding the screen, [initialize OwnID](configuration.md) and complete [Passkey Setup](https://docs.ownid.com/mobile-sdks/setup/passkeys).

## Add the View

Render [`OwnIDEliteView`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/flows/elite/OwnIDEliteView.tsx) in a screen or modal that provides its dimensions. The View fills that area; your app handles safe areas and navigation.

```tsx
import { OwnIDEliteView } from '@ownid/react-native-core';
import type { AuthResult, LoginPayload, OwnIDEliteErrorDetails, OwnIDEliteFinishParams } from '@ownid/react-native-core';
import { appAuth } from './auth';

export function LoginScreen() {
  return (
    <OwnIDEliteView
      options={{ origin: 'https://login.example.com' }}
      events={{
        onFinish: async (params: OwnIDEliteFinishParams) => {
          // Open your signed-in screen.
        },
        onError: async (message: string, details: OwnIDEliteErrorDetails) => {
          if (details.terminal) {
            // Show an error in your app and dismiss or replace this screen.
          }
        },
        onClose: async () => {
          // Dismiss the login screen.
        },
      }}
      providers={{
        session: {
          create: async (payload: LoginPayload): Promise<AuthResult> => {
            try {
              // Create or restore your app session.
              await appAuth.createSession(payload);
              return { status: 'logged-in' };
            } catch {
              return { status: 'fail', reason: 'Unable to create the app session.' };
            }
          },
        },
      }}
    />
  );
}
```

One mounted View runs one flow. To retry or change its inputs, unmount it and mount a new View.

## Origin

[`options.origin`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/flows/elite/OwnIDEliteView.tsx) sets the WebView document's origin. It defaults to `https://webview.ownid.com`; use the origin configured for your integration and align its host with your passkey relying-party domain.

Use an HTTPS URL with an ASCII DNS host and optional port. A trailing slash is allowed; other paths, queries, fragments, IP addresses, and Unicode hostnames are not. This setting does not change the OwnID environment or region.

Replace the example origin with your integration's domain.

## Session Provider

The hosted experience authenticates with OwnID, but your app still needs to create or restore its own session. When authentication reaches that handoff, Elite calls the effective [`providers.session.create`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/providers/index.ts) callback with [`LoginPayload`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/models/authentication.ts).

The callback can be configured with `OwnID.setProviders` or supplied through the View's `providers` prop shown above. Elite requires an effective callback.

- After your app's authentication service creates or restores the session and securely stores its session material, return `{ status: 'logged-in' }`. Elite accepts only `logged-in` as successful session creation.
- When the app session cannot be created as an expected failure, return `{ status: 'fail', reason?: string }`. Use `reason` for a concise explanation when it helps the hosted experience.

Return only JSON-compatible data from this callback. Unsupported JavaScript values, cycles, non-finite numbers, and missing array entries fail the request; `undefined` object fields are omitted.

`appAuth` in the example represents your app's authentication service. An uncaught throw or rejection reports a provider failure to the hosted experience and records the original error when logging is enabled. The React Native SDK does not call `onError` just for that callback failure. If the View is unmounted while the provider promise is pending, the SDK does not cancel the app's work and ignores its later result.

See [Providers](providers.md) for provider registration and the shared payload and result types.

## Events

All event callbacks are optional and asynchronous. Replace the example comments with your app's actions.

### `onFinish`

`onFinish` has type [`(params: OwnIDEliteFinishParams) => Promise<void>`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/flows/elite/events.ts) and runs when hosted authentication completes successfully.

Its `params` contain:

- `loginId: string`: the login identifier used for authentication.
- [`authType: AuthMethod`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/models/authentication.ts): the authentication method reported by OwnID.
- `source: 'mobile' | 'desktop'`: the device category selected by the hosted flow.

Update app state and navigate to the signed-in screen or dismiss the surrounding UI. This event ends the attempt. During normal completion, OwnID waits for the callback promise before clearing the View, even if it rejects. Callback failures are logged when enabled and do not call `onError`.

### `onError`

`onError` has type [`(message: string, details: OwnIDEliteErrorDetails) => Promise<void>`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/flows/elite/events.ts) and reports hosted errors plus setup, loading, and runtime failures.

`message` describes the failure for diagnostics. Its `details` contain:

- [`code: ErrorCode`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/models/error.ts): the stable error category to use when choosing app behavior or error copy.
- `source: string`: the SDK or hosted source that reported the failure.
- `additionalDetails?: object | string`: optional diagnostic information.
- `terminal: boolean`: whether the current authentication attempt can no longer continue.

When `terminal` is `true`, this attempt has ended or could not start, and it cannot continue. Show an error in your app and dismiss or replace the Elite screen. To retry, mount a new `OwnIDEliteView`.

When `terminal` is `false`, the hosted experience reported an error while this attempt was active. Do not close the screen solely because this callback ran; the hosted flow may handle the error. A value of `false` does not guarantee that the error is recoverable or that the attempt will remain active.

### `onClose`

`onClose` has type `() => Promise<void>` and runs when the hosted flow asks to close without successful completion. Clear transient authentication state and dismiss the surrounding screen or modal.

This event ends the attempt. During normal closure, OwnID waits for the callback promise before clearing the View, even if it rejects. Callback failures are logged when enabled and do not call `onError`.

## Unico Human-Token Integration

When your OwnID journey uses Unico Human-Token, the hosted flow presents Unico's browser experience. See Unico's [Web App Integration](https://developer.unico.io/developers/sdks-and-tools/web/web-integration/index.html) guide for the underlying browser product.

For journeys that use the camera and foreground location, add the following permissions to your app.

### Bare React Native

In `android/app/src/main/AndroidManifest.xml`, add these entries inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

In your iOS app's `Info.plist`, add purpose strings describing how your app uses these capabilities:

```xml
<key>NSCameraUsageDescription</key>
<string>Use the camera during the Unico Human-Token flow.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Use your location during the Unico Human-Token flow.</string>
```

See the platform guides for [Android permissions](https://developer.android.com/training/permissions/requesting), [iOS camera access](https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription), and [iOS location access](https://developer.apple.com/documentation/bundleresources/information-property-list/nslocationwheninuseusagedescription).

### Expo

Add the equivalent settings to your app configuration:

```json
{
  "expo": {
    "android": {
      "permissions": ["android.permission.CAMERA", "android.permission.ACCESS_COARSE_LOCATION", "android.permission.ACCESS_FINE_LOCATION"]
    },
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Use the camera during the Unico Human-Token flow.",
        "NSLocationWhenInUseUsageDescription": "Use your location during the Unico Human-Token flow."
      }
    }
  }
}
```

See [Expo permissions](https://docs.expo.dev/guides/permissions/). Rebuild your native app after changing these settings.
