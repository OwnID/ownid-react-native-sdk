# Elite Flow

Elite Flow presents OwnID's passkey-first authentication UI inside a WebView. Your app owns the surrounding screen, creates its session, and handles navigation or dismissal.

## Prerequisites

Follow the SDK's [installation](../README.md#install) and [requirements](../README.md#requirements), [initialize OwnID](configuration.md), and complete [Passkey Setup](https://docs.ownid.com/mobile-sdks/setup/passkeys).

## Add the View

Render [`OwnIDEliteView`](../sdk-core/src/flows/elite/OwnIDEliteView.tsx) in a screen or modal with dimensions. The View fills its parent; your app handles safe areas and navigation. Both `options` and `options.origin` are required.

```tsx
import { View } from "react-native";
import { OwnIDEliteView } from "@ownid/react-native-core";
import type { AuthResult, LoginPayload, OwnIDEliteErrorDetails, OwnIDEliteFinishParams } from "@ownid/react-native-core";
import { appAuth } from "./auth";

export function LoginScreen() {
  return (
    <View style={{ flex: 1 }}>
      <OwnIDEliteView
        options={{ origin: "https://example.com" }}
        events={{
          onFinish: async (_params: OwnIDEliteFinishParams) => {
            // Open your signed-in screen.
          },
          onError: async (_message: string, details: OwnIDEliteErrorDetails) => {
            if (details.terminal) {
              // Show an error and dismiss or replace this screen.
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
                await appAuth.createSession(payload);
                return { status: "logged-in" };
              } catch {
                return { status: "fail", reason: "Unable to create the app session." };
              }
            },
          },
        }}
      />
    </View>
  );
}
```

`appAuth` represents your app's authentication service. Replace it and the event comments with your app's session and navigation actions.

The SDK loads the HTTPS page and replaces its content with its built-in Elite UI, using your OwnID configuration and app callbacks.

One mounted View runs one authentication attempt. Its inputs are captured at mount; changing props does not update or restart it. Unmount and mount a new View to retry or change inputs. Reinitializing or destroying OwnID also ends the attempt.

## Bootstrap URL

`options.origin` is a required HTTPS origin or page URL. A non-root path or a query string on the root path loads that URL directly. A bare host or root path without a query string loads `/.well-known/assetlinks.json` on Android or `/.well-known/apple-app-site-association` on iOS. Use an ASCII DNS hostname and optional port; fragments, user information, and IP addresses are rejected. The page must load directly without redirects. Replace the example URL with your integration's URL.

The page **must not contain an existing OwnID Web SDK**. An empty HTML page or one containing only plain text, without complex styles or JavaScript, is recommended. The page's document policies must permit the configured OwnID scripts, styles, and network requests.

The bootstrap URL's hostname must equal your configured relying party ID (RP ID) or be a subdomain of it. Passkeys are associated with that RP ID. This URL does not change the OwnID environment or region.

Available authentication methods depend on whether the HTTPS page can load securely, platform support, and your OwnID configuration.

## Session Provider

Elite requires an effective `providers.session.create` callback, registered with `OwnID.setProviders` or supplied through the View's `providers` prop. It receives [`LoginPayload`](../sdk-core/src/models/authentication.ts) when your app needs to create or restore its session.

- Return `{ status: 'logged-in' }` only after your app session is ready. Elite accepts only `logged-in` as successful session creation.
- For an expected failure, return `{ status: 'fail', reason?: string }` with an optional concise explanation.

Return only JSON-compatible data.

An uncaught throw or rejection reports a provider failure back to Elite and logs the original error when logging is enabled; it does not directly invoke the React Native `onError` callback. SDK teardown does not cancel pending app work, and its later result is ignored.

See [Providers](providers.md) for registration and shared payload and result types.

## Events

All callbacks are optional and return `Promise<void>`. The public types are defined in [`OwnIDEliteEvents`](../sdk-core/src/flows/elite/events.ts).

| Callback                                                    | When it runs and arguments                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onFinish(params: OwnIDEliteFinishParams)`                  | Successful hosted authentication. `params` contains `loginId: string`, `authType: AuthMethod`, `source: 'mobile' \| 'desktop'`, and optional `authToken: string`. Update app state and navigate or dismiss the screen.                                                    |
| `onError(message: string, details: OwnIDEliteErrorDetails)` | Hosted errors and setup, loading, or runtime failures. `message` describes the failure; `details` contains `code: ErrorCode`, `source: string`, optional `additionalDetails: object \| string`, and `terminal: boolean`. Use `code` to choose app behavior or error copy. |
| `onClose()`                                                 | The hosted flow requests closure without successful completion. Clear transient authentication state and dismiss the screen.                                                                                                                                              |

`onFinish` and `onClose` end the attempt. During normal completion or closure, the SDK waits for their promises before clearing the View, even if they reject. Callback failures do not invoke `onError`. Closing the View does not cancel app work already in progress.

With `terminal: true`, the attempt has ended or could not start. Show an error and dismiss or replace the screen; mount a new View to retry. With `terminal: false`, the error alone does not end the attempt or guarantee recovery. The hosted flow may handle it, so keep the screen open unless your app has another reason to close it.

## Unico Human-Token Integration

When your OwnID journey uses Unico Human-Token, see Unico's [Web App Integration](https://developer.unico.io/developers/sdks-and-tools/web/web-integration/index.html). For journeys that use the camera or foreground location, declare the capabilities they use. These examples cover both.

### Bare React Native

Add the Android permissions inside `<manifest>` in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

Add purpose strings in your iOS app's `Info.plist`, describing your app's use:

```xml
<key>NSCameraUsageDescription</key>
<string>Use the camera during the Unico Human-Token flow.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Use your location during the Unico Human-Token flow.</string>
```

### Expo

Add the equivalent settings in `app.json` or `app.config.ts`:

```json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION"
      ]
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

See [Expo permissions](https://docs.expo.dev/guides/permissions/). Rebuild your native app after changing these declarations.
