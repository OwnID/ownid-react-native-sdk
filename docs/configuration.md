# SDK Configuration

Call [`OwnID.initialize`](../sdk-core/src/runtime/OwnID.ts) once during app startup, before using SDK features. Use your application ID from the OwnID Console:

```ts
import { OwnID } from '@ownid/react-native-core';

OwnID.initialize({ appId: '<OWNID_APP_ID>' });
```

## Environment and Region

Most apps only need the application ID. Set `env` and `region` to match your OwnID application's environment and request region when they differ from the defaults:

```ts
OwnID.initialize({
  appId: '<OWNID_APP_ID>',
  env: 'uat', // Use the UAT environment. Defaults to 'prod' for production.
  region: 'eu', // Send OwnID requests to the EU region. Defaults to 'us'.
});
```

## From JSON

Use [`OwnID.initializeFromJson`](../sdk-core/src/runtime/OwnID.ts) when your app receives its configuration as a JSON string:

```ts
OwnID.initializeFromJson(`{
  "appId": "<OWNID_APP_ID>",
  "env": "prod",
  "region": "us"
}`);
```

Both initialization methods are synchronous. Invalid configuration throws and leaves the current OwnID configuration unchanged.

## Reinitialization and Shutdown

Initializing again replaces the current configuration and stops active SDK operations. After reinitializing, get `OwnID.flows` again before starting a new flow.

Call [`OwnID.destroy()`](../sdk-core/src/runtime/OwnID.ts) when your app needs to shut down OwnID.

## Logging

Logging is disabled by default. Configure it with [`OwnID.configureLogging`](../sdk-core/src/runtime/OwnID.ts) and [`OwnIDLogLevel`](../sdk-core/src/logging/index.ts) before initialization when you need SDK logs:

```ts
import { OwnID, OwnIDLogLevel } from '@ownid/react-native-core';

OwnID.configureLogging({ level: OwnIDLogLevel.Warn });
```

Enabled logs go to the console. To use your app's logging service, supply `onLog`:

```ts
OwnID.configureLogging({
  level: OwnIDLogLevel.Debug,
  label: 'MyApp',
  onLog: (entry) => {
    // Forward the entry to your app's logging service.
  },
});
```

Each entry contains `level`, `label`, `source`, `message`, and an optional `cause`. The callback runs synchronously, so keep it quick. Avoid logging tokens or session payloads.

Call `OwnID.configureLogging()` without arguments to disable logging.
