# Providers

Providers connect OwnID SDK operations to services owned by your app. The React Native SDK currently exposes [`session.create`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/providers/index.ts), an asynchronous callback for creating or restoring the app session from OwnID login data.

## Register Providers

Initialize OwnID, then register providers with [`OwnID.setProviders`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/runtime/OwnID.ts) before starting SDK work that uses them:

```ts
import { OwnID } from "@ownid/react-native-core";
import type { AuthResult, LoginPayload, OwnIDProviders, } from "@ownid/react-native-core";
import { appAuth } from "./auth";

OwnID.initialize({ appId: "<OWNID_APP_ID>" });

const providers: OwnIDProviders = {
  session: {
    create: async (payload: LoginPayload): Promise<AuthResult> => {
      // Create or restore your app session and wait until it is ready.
      await appAuth.createSession(payload);
      return { status: "logged-in" };
    },
  },
};

OwnID.setProviders(providers);
```

`appAuth` represents your app's authentication service. Replace the example import and call with your own session logic.

The [`OwnIDProviders`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/providers/index.ts) type defines the provider groups and callbacks.

`OwnID.setProviders` updates the callbacks configured on OwnID. Omitted callbacks keep their current values. Register providers again after reinitializing OwnID.

## Use Different Providers for Selected SDK Work

Use [`OwnID.withProviders`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/runtime/OwnID.ts) to obtain an [`OwnIDInstance`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/namespace/InstanceNamespace.ts) with different callbacks while leaving those configured directly on OwnID unchanged:

```ts
const customOwnID = OwnID.withProviders({
  session: {
    create: async (payload: LoginPayload): Promise<AuthResult> => {
      await appAuth.createAlternateSession(payload);
      return { status: "logged-in" };
    },
  },
});
```

Use `customOwnID` for SDK work that needs these callbacks. Omitted callbacks remain inherited from OwnID.

## Login Payload

[`LoginPayload`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/models/authentication.ts) contains OwnID authentication metadata alongside application-defined session fields:

`metadata.authType` uses the [`AuthMethod`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/models/authentication.ts) enum.

| Field                  | Meaning                                             |
| ---------------------- | --------------------------------------------------- |
| `metadata.loginId`     | Login identifier used for authentication.           |
| `metadata.authType`    | Authentication method, represented by `AuthMethod`. |
| Other top-level fields | Application-defined session data.                   |

Application-defined fields have type `unknown`; check them against the shape your app expects before using them.

## Return a Result

The provider returns a promise of [`AuthResult`](https://github.com/OwnID/ownid-react-native-sdk/blob/HEAD/sdk-core/src/models/authentication.ts). Each provider contract defines which result status it accepts, so do not treat the statuses as interchangeable.

| Result                                         | Meaning                                                       |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `{ status: 'logged-in', result? }`             | The app session was established.                              |
| `{ status: 'auth-completed', sessionPayload }` | Authentication completed with an app-defined session payload. |
| `{ status: 'success', result? }`               | The provider operation completed successfully.                |
| `{ status: 'fail', reason? }`                  | The provider operation failed.                                |

For an expected application-session failure, return `{ status: 'fail', reason: 'Unable to create the session' }`. Throwing or rejecting reports a provider failure to the requesting SDK work, and OwnID records the original failure when logging is enabled.

Once a callback starts, its promise belongs to the app. Stopping the SDK work does not cancel it, and a later result may be ignored. Treat login payloads and tokens as sensitive data and avoid logging or persistently storing the complete payload.
