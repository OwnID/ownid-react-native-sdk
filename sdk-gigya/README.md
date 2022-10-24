# OwnID React Native Gigya SDK
The OwnID React Native Gigya SDK integrates with Email/Password-based [Gigya Authentication](https://github.com/SAP/gigya-android-sdk).

The [OwnID](https://ownid.com/) React Native Gigya SDK is a client library that provides a passwordless login alternative for your React Native application by using cryptographic keys to replace the traditional password. The SDK allows the user to perform Registration and Login flows in a React Native application. The SDK is available from the npm repository. For more general information about OwnID SDKs, see [OwnID React Native SDK](../README.md).

## Table of contents
* [Add Dependency to your project](#add-dependency-to-your-project)
* [Configure](#configure)
* [Integrate OwnID with your React Native App](#integrate-ownid-with-your-react-native-app)
   + [Create OwnID Gigya instance](#create-ownid-gigya-instance)
   + [Registration](#registration)
   + [Login](#login)
* [Tooltip](#tooltip)   
* [Customizing the UI](#customizing-the-ui)
* [Advanced Configuration](#advanced-configuration)
   + [Initialization Alternative](#initialization-alternative)

---

## Add Dependency to your project
The OwnID React Native Core & Gigya SDKs are available from the [npm repository](https://www.npmjs.com/search?q=%40ownid%2Freact-native-):
```bash
npm install @ownid/react-native-core @ownid/react-native-gigya
cd ios && pod install && cd .. # CocoaPods on iOS needs this extra step
```
The OwnID React Native Gigya SDK supports [autolinking](https://github.com/react-native-community/cli/blob/main/docs/autolinking.md) and is built with Android API version 33 (minimum API version 23) and Java 8. The OwnID React Native Gigya iOS SDK supports iOS 13 and higher.

## Configure

If you [create OwnID Gigya instance](#create-ownid-gigya-instance) from React Native there is no need for any additional configuration. Alternatively, you can create OwnID Gigya SDK instance from native side. See [Initialization Alternative](#initialization-alternative).


## Integrate OwnID with your React Native App

### Create OwnID Gigya instance

Before using OwnID Button on your screens, you have to create OwnID Gigya instance. If you use default Gigya account model (`GigyaAccount` class / `GigyaAccount` struct ) then you can do this from React Native. To do so, call `OwnIdGigya.init` function with OwnID configuration. At a minimum, this configuration object defines the OwnID App Id - the unique identifier of your OwnID application, which you can obtain from the [OwnID Console](https://console.ownid.com), and `redirection_uri_ios` to set redirection Uri value for iOS:

```ts
import OwnIdGigya from '@ownid/react-native-gigya';

OwnIdGigya.init({ app_id: "47tb9nt6iaur0zv", redirection_uri_ios: "com.myapp.demo://bazco" });
```

**Important:** The `OwnIdGigya.init` function must be called after Android/iOS native Gigya instance is initialized.
See details for [Android](https://github.com/SAP/gigya-android-sdk/tree/main/sdk-core#initialization) and [iOS](https://github.com/SAP/gigya-swift-sdk/tree/main/GigyaSwift#initialization). It's also recommended to create OwnID instance as early as possible in the application lifecycle, as OwnID Button will only be shown after creation completes.

If you use custom Gigya account model you have to create OwnID Gigya instance in native code, see [Initialization Alternative](#initialization-alternative).

### Registration

Add the passwordless authentication to your application's Registration screen by including the OwnIdButton view with type `OwnIdButtonType.Register`. Call `OwnIdRegister` function once user finishes OwnID flow in OwnID WebApp and tap "Create Account" on registration form (check [complete example](https://github.com/OwnID/ownid-react-native-sdk/blob/master/demo-gigya/src/screens/Registration.js)):

```ts
import { OwnIdButton, OwnIdButtonType, OwnIdEvent, OwnIdRegister, OwnIdRegisterEvent } from '@ownid/react-native-gigya';

const [name, setName] = useState('');
const [email, setEmail] = useState('');

const [ownIdReadyToRegister, setOwnIdReadyToRegister] = useState(false);

const onSubmit = async (event) => {
  event.preventDefault();
  ...
  
  if (ownIdReadyToRegister) {
    const profile = JSON.stringify({ firstName: name });
    OwnIdRegister(email, { profile });
    return;
  }
  
  ...
}

const onOwnIdEvent = (event: OwnIdEvent) => {
  switch (event.eventType) {
      // Event when OwnID is busy processing request
      case OwnIdRegisterEvent.Busy:
        /* Show busy status 'event.isBusy' according to your application UI */
        break;

      // Event when user successfully finishes Skip Password in OwnID Web App  
      case OwnIdRegisterEvent.ReadyToRegister:
        setOwnIdReadyToRegister(true);
        setEmail(event.loginId); // OwnID Web App may ask user to enter his login id (like email)
        break;
      
      // Event when user select "Undo" option in ready-to-register state
      case OwnIdRegisterEvent.Undo:
        setOwnIdReadyToRegister(false);
        break;

      // Event when OwnID creates Gigya account and logs in user  
      case OwnIdRegisterEvent.LoggedIn:
        setOwnIdReadyToRegister(false);
        /* User is logged in with OwnID */
        break;
      
      // Event when OwnID returns an error
      case OwnIdRegisterEvent.Error:
        /* Handle 'event.cause' according to your application flow */
        break;
  }
};

return (
  <View>
    <TextInput value={name} onChangeText={setName} placeholder="First Name"/>
    <TextInput value={email} onChangeText={setEmail} placeholder="Email"/>

    <View>
      <TextInput placeholder="Password"/>
      <OwnIdButton type={OwnIdButtonType.Register} loginId={email} onOwnIdEvent={onOwnIdEvent} />
    </View>

    <TouchableOpacity onPress={onSubmit}><Text>Create Account</Text></TouchableOpacity>
  </View>
);
```

The OwnID `OwnIdRegister()` function must be called in response to the `ReadyToRegister` event. This function calls the standard Gigya SDK function `register(String email, String password, Map<String, Object> params, GigyaLoginCallback<T> callback)` to register the user in Gigya, so you do not need to call this Gigya function yourself. You can define custom parameters for the registration request and pass it to `OwnIdRegister().` These parameters are passed to the [Gigya registration call](https://github.com/SAP/gigya-android-sdk/tree/main/sdk-core#register-via-email--password).

### Login
Similar to the Registration screen, add the passwordless authentication to your application's Login screen by including the OwnIdButton view with type `OwnIdButtonType.Login`. Your app then waits for events while the user interacts with OwnID. (check [complete example](https://github.com/OwnID/ownid-react-native-sdk/blob/master/demo-gigya/src/screens/Login.js)):

```ts
import { OwnIdButton, OwnIdButtonType, OwnIdEvent, OwnIdLoginEvent } from '@ownid/react-native-gigya';

const [email, setEmail] = useState('');

const onOwnIdEvent = (event: OwnIdEvent) => {
  switch (event.eventType) {
    // Event when OwnID is busy processing request
    case OwnIdLoginEvent.Busy:
      /* Show busy status 'event.isBusy' according to your application UI */
      break;
    
    //Event when user who previously set up OwnID logs in with Skip Password
    case OwnIdLoginEvent.LoggedIn:
      /* User is logged in with OwnID */
      break;
    
    // Event when OwnID returns an error
    case OwnIdLoginEvent.Error:
      /* Handle 'event.cause' according to your application flow  */
      break;
    }
};

return (
  <View>
    <TextInput value={email} placeholder="Email"/>

    <View>
      <TextInput placeholder="Password"/>
      <OwnIdButton type={OwnIdButtonType.Login} loginId={email} onOwnIdEvent={onOwnIdEvent} />
    </View>
    ...
  </View>
);
```

## Tooltip
The OwnID SDK by default shows a Tooltip with text "Login with Fingerprint" on Android and "Login with FaceID / TouchID" on iOS. For Login the Tooltip appears/hides every time the OwnIdButton is shown/hides. For Registration the Tooltip appears when email input contains valid email address, and follows the same OwnIdButton shown/hides logic.

![OwnID Tooltip UI Example](tooltip_example.png) ![OwnID Tooltip Dark UI Example](tooltip_example_dark.png)

OwnIdButton has parameters to specify Tooltip parameters:
* `tooltipPosition` - tooltip position `top`/`bottom`/`start`/`end`/`none` (default `top`)
* `tooltipBackgroundColor` - tooltip background color (default value `#FFFFFF`, default value-night: `#2A3743`)
* `tooltipBorderColor` - tooltip border color (default value `#D0D0D0`, default value-night: `#2A3743`) 

Here's an example on how you can change these parameters:

```ts
<OwnIdButton ... onOwnIdEvent={onOwnIdEvent} style={{tooltipPosition: OwnIdTooltipPosition.Top, tooltipBackgroundColor: "#FFFFFF", tooltipBorderColor: "#D0D0D0"}}/>
```

## Customizing the UI

![OwnIdButton UI Example](button_view_example.jpg) ![OwnIdButton Dark UI Example](button_view_example_dark.jpg)

The following is a complete list of UI customization parameters:

**Parameters**

* `variant` - button icon variant (default value `OwnIdButtonVariant.Fingerprint`, alternative `OwnIdButtonVariant.FaceId`)
* `showOr` - controls showing "or" (default value `true`)
* `backgroundColor` - background color of the button (default value `#FFFFFF`, default value-night: `#2A3743`)
* `borderColor` - border color of the button (default value `#D0D0D0`, default value-night: `#2A3743`) 
* `biometryIconColor` - icon or text color (default value `#0070F2`, default value-night: `#2E8FFF`)

Here's an example on how you can change these parameters:

```ts
<OwnIdButton ... variant={OwnIdButtonVariant.Fingerprint} showOr={true} style={{ backgroundColor: "#FFFFFF", biometryIconColor: "#0070F2", borderColor: "#D0D0D0" }}/>
```

## Advanced Configuration

### Initialization Alternative

In case you don't want to create an instance of OwnID Gigya SDK from React Native or you use custom Gigya account model, you can create OwnID Gigya SDK instance from native Android and iOS code.

**Android - Create Configuration File**

The OwnID SDK uses a configuration file in your `assets` folder to configure itself.  At a minimum, this JSON configuration file defines the OwnID App Id - the unique identifier of your OwnID application, which you can obtain from the [OwnID Console](https://console.ownid.com). Create `assets/ownIdGigyaSdkConfig.json` and define the `app_id` parameter:

```json
{
   "app_id": "47tb9nt6iaur0zv"
}
```

**Android - Create OwnID Gigya Instance**

 Most commonly, you create OwnID CDC instance using the Android [Application class](https://developer.android.com/reference/kotlin/android/app/Application). For information on initializing and creating an instance of CDC, refer to the [SAP CDC documentation](https://github.com/SAP/gigya-android-sdk). The `MyAccount` is an optional class that extends `GigyaAccount`. More details in [SAP CDC documentation](https://github.com/SAP/gigya-android-sdk/tree/main/sdk-core#explicit-initialization).


<details open>
<summary>Kotlin</summary>

```kotlin
class MyApplication : Application() {
   override fun onCreate() {
      super.onCreate()
      // Create Gigya instance
      Gigya.setApplication(this)

      // Create OwnID Gigya instance
      OwnId.createGigyaInstance(this /* Context */)

      // If you use custom account class
      // OwnId.createGigyaInstance(this, gigya = Gigya.getInstance(MyAccount::class.java))
   }
}
```
</details>

<details>
<summary>Java</summary>

```java
class MyApplication extends Application {
   @Override
   public void onCreate() {
      super.onCreate();
      // Create Gigya instance
      Gigya.setApplication(this);
      
      // Create OwnID Gigya instance
      OwnIdGigyaFactory.createInstance(this /* Context */);

      // If you use custom account class set Gigya Account type first
      // Gigya.getInstance(MyAccount.class);
      // Then create OwnID Gigya instance
      // OwnIdGigyaFactory.createInstance(this /* Context */);
   }
}
```
</details>

The OwnID SDK automatically reads the `ownIdGigyaSdkConfig.json` configuration file from your `assets` folder and creates a default instance that is accessible as `OwnId.gigya`.

For additional configuration options, check [OwnID Gigya SDK documentation](https://github.com/OwnID/android-sdk/blob/develop/docs/sdk-gigya-doc.md).

**iOS - Add Property List File to Project**

When the application starts, the OwnID SDK automatically reads `OwnIDConfiguration.plist` from the file system to configure the default instance that is created. In this PLIST file, you must define a redirection URI and the OwnID App Id. Create `OwnIDConfiguration.plist` and define the following mandatory parameters:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>OwnIDRedirectionURL</key>
	<string>com.myapp.demo://bazco</string>
	<key>OwnIDAppID</key>
	<string>47tb9nt6iaur0zv</string>
</dict>
</plist>
```

Where:

- The `OwnIDAppID` is the unique AppID, which you can obtain from the [OwnID Console](https://console.ownid.com).
- The `OwnIDRedirectionURL` is the full redirection URL, including its custom scheme. This URL custom scheme must match the one that you defined in your target.

**Create URL Type (Custom URL Scheme)**

You need to open your project and create a new URL type that corresponds to the redirection URL specified in `OwnIDConfiguration.plist`. In Xcode, go to **Info > URL Types**, and then use the **URL Schemes** field to specify the redirection URL. For example, if the value of the `OwnIDRedirectionURL` key is `com.myapp.demo://bazco`, then you could copy `com.myapp.demo` and paste it into the **URL Schemes** field.

**iOS - Initialize the SDK**

Import the OwnID module so you can access the SDK features. Add the following import to your native source files:

```swift
import OwnIDGigyaSDK
```

The OwnID React SDK must be initialized properly using the `configure()` function, preferably in the main entry point of your app (in the `@main` `App` struct).

Main entry point of your app: 

```swift
@main
struct ExampleApp: App {

    init() {
        //Init Gigya SDK
        Gigya.sharedInstance(MyAccount.self)
        
        //Init OwnID React SDK
        OwnID.ReactGigyaSDK.configure(MyAccount.self)
    }
  }
}
```

For additional options, check [OwnID Gigya SDK documentation](https://github.com/OwnID/ownid-gigya-ios-sdk).
