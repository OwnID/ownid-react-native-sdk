# OwnID React Native  SDK - Advanced Configuration

The OwnID React Native SDK offers multiple configuration options.

The configuration options listed here are part of OwnID React Native Core SDK.

## Table of contents

* [Initialization Parameters](#initialization-parameters)
* [Error and Exception Handling](#error-and-exception-handling)
* [Customizing the UI](#customizing-the-ui)
   + [Side-by-side button](#side-by-side-button)
   + [Password replacing button](#password-replacing-button)
* [Tooltip](#tooltip)

## Initialization Parameters

During the initialization of the OwnID instance, you can specify additional parameters as needed:

- `appId` (mandatory): OwnID App Id - a unique identifier for your OwnID application, obtainable from the [OwnID Console](https://console.ownid.com).
- `env` (optional): OwnID App environment - By default, OwnID uses the production environment. You can set a different environment, with possible options being: `uat`, `staging`.
- `enableLogging` (optional): Enable OwnID logger - Logging is disabled by default. To enable logging, set `enableLogging:true`.
- `redirectionUri`, `redirectionUriIos`, `redirectionUriAndroid` (optional): Set Redirection URI - The redirection URI determines the user's destination after interacting with the OwnID Web App in their browser. You can specify a value for both platforms or individually per platform.

> [!NOTE]
> It is highly recommended to disable logging in production builds.
>
> Redirection URI is required only if the OwnID flow involves the OwnID Web App.

All parameters are eventually sent to the native OwnID SDKs. For more details, refer to the native documentation: [OwnID Android SDK](https://github.com/OwnID/ownid-android-sdk) and [OwnID iOS SDK](https://github.com/OwnID/ownid-ios-sdk)

Example:

```ts
await OwnId.init({ appId: "your_app_id", env: "uat", enableLogging: true, redirectUrl: "com.ownid.demo.react://ownid" }, ...)
```

## Error and Exception Handling

The OwnID React Native Core SDK offers a specialized interface for integrating error and exception handling into your application. 

The `OwnIdError` interface is designed to represent errors and exceptions that may occur during the execution of the OwnID SDK. Here is its definition:

```ts
/**
 * Represents an OwnID error.
 * 
 * @property {string} className - The class name where the error occurred.
 * @property {string | null} code - The error code, or null if unavailable.
 * @property {string} message - A user-friendly localized text message describing the error if `code` is present, otherwise the error message.
 * @property {OwnIdError | null} cause - The original exception that is wrapped in, or null if none.
 * @property {string} stackTrace - The stack trace for the error.
 */
export interface OwnIdError {
    className: string;
    code: string | null;
    message: string;
    cause: OwnIdError | null;
    stackTrace: string;
}
```

## Customizing the UI

### Side-by-side button

The following is a complete list of UI customization parameters (except Tooltip) for side-by-side button (`OwnIdButton`):

**Parameters**

* `widgetPosition` - OwnID widget position relative to password input field (default value `OwnIdWidgetPosition.Start`, alternative `OwnIdWidgetPosition.End`)
* `showOr` - controls showing "or" (default value `true`)
* `showSpinner` - controls showing spinner (default value `true`)
* `colorScheme` - controls widget color schema (`light`, `dark`, default - follow system - value from `Appearance.getColorScheme()` is used, see [more](https://reactnative.dev/docs/appearance))
* `iconColor` - icon color (default value `#0070F2`, default value-night: `#2E8FFF`)
* `textColor` - text color (default value `#354A5F`, default value-night: `#CED1CC`)
* `backgroundColor` - background color of the button (default value `#FFFFFF`, default value-night: `#2A3743`)
* `borderColor` - border color of the button (default value `#D0D0D0`, default value-night: `#2A3743`)
* `spinnerColor` - spinner color (default value `#ADADAD`, default value-night: `#BDBDBD`)
* `spinnerBackgroundColor` - spinner background color (default value `#DFDFDF`, default value-night: `#717171`)

Here's an example on how you can change these parameters:

```ts
<OwnIdButton ... 
  widgetPosition={OwnIdWidgetPosition.Start} 
  showOr={true} 
  showSpinner={true} 
  colorScheme="light" 
  style={{ 
    iconColor: "#0070F2", 
    textColor: "#000000", 
    backgroundColor: "#FFFFFF",
    borderColor: "#D0D0D0", 
    spinnerColor: "#ADADAD",  
    spinnerBackgroundColor: "#DFDFDF"
  }}
/>
```

### Password replacing button

The following is a complete list of UI customization parameters for password replacing button (`OwnIdAuthButton`):

**Parameters**

* `showSpinner` - controls showing spinner (default value `true`)
* `colorScheme` - controls widget color schema (`light`, `dark`, default - follow system - value from `Appearance.getColorScheme()` is used, see [more](https://reactnative.dev/docs/appearance))
* `textColor` - text color (default value `#FFFFFF`, default value-night: `#FFFFFF`)
* `backgroundColor` - background color of the button (default value `#0070F2`, default value-night: `#3771DF`)
* `spinnerColor` - spinner color (default value `#FFFFFF`, default value-night: `#FFFFFF`)
* `spinnerBackgroundColor` - spinner background color (default value `#FFFFFF80`, default value-night: `#FFFFFF80`)

Here's an example on how you can change these parameters:

```ts
<OwnIdAuthButton ... 
  showSpinner={true} 
  colorScheme="light" 
  style={{ 
    textColor: "#FFFFFF", 
    backgroundColor: "#0070F2", 
    spinnerColor: "#FFFFFF", 
    spinnerBackgroundColor: "#FFFFFF80"
  }}
/>
```

## Tooltip

The OwnID SDK's `OwnIdButton` can show a Tooltip with text "Sign in with Fingerprint" / "Register with Fingerprint" on Android and "Sign in with FaceID" / "Register with Face ID" on iOS. For Login the Tooltip appears/hides every time the `OwnIdButton` is shown/hides. For Registration the Tooltip appears when login id input contains valid login id, and follows the same `OwnIdButton` shown/hides logic.

![OwnID Tooltip UI Example](tooltip_example.png) ![OwnID Tooltip Dark UI Example](tooltip_example_dark.png)

OwnIdButton has parameters to specify Tooltip parameters:
* `tooltipPosition` - tooltip position `top`/`bottom`/`start`/`end`/`none` (default `none`)
* `tooltipTextColor` - tooltip text color (default value `#354A5F`, default value-night: `#CED1CC`)
* `tooltipBackgroundColor` - tooltip background color (default value `#FFFFFF`, default value-night: `#2A3743`)
* `tooltipBorderColor` - tooltip border color (default value `#D0D0D0`, default value-night: `#2A3743`) 

Here's an example on how you can change these parameters:

```ts
<OwnIdButton ... 
  style={{
    tooltipPosition: OwnIdTooltipPosition.Top, 
    tooltipTextColor: "#000000", 
    tooltipBackgroundColor: "#FFFFFF", 
    tooltipBorderColor: "#D0D0D0"
  }}
/>
```