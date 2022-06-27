# OwnID React Native Gigya SDK
A library for integrating OwnID into a React Native application.

## Table of contents
* [Installation](#installation)
* [Configure Android](#configure-android)
* [Configure iOS](#configure-ios)
* [Integrate OwnID with your React Native App](#implement-the-registration-screen)
   + [Registration](#registration)
   + [Login](#login)
   + [Customizing the UI](#customizing-the-ui)
* [What is OwnID?](#what-is-ownid)
* [License](#license)

---

## Installation
Use the npm CLI to run:
```bash
npm install @ownid/react-native-gigya
```

### Configure Android

**Enable Java 8 Compatibility in Your Project**

The OwnID SDK requires [Java 8 bytecode](https://developer.android.com/studio/write/java8-support). To enable this feature, add the following to your application `build.gradle` file:

```groovy
android {
   compileOptions {
      sourceCompatibility JavaVersion.VERSION_1_8
      targetCompatibility JavaVersion.VERSION_1_8
   }
   kotlinOptions {
      jvmTarget = "1.8"
   }
}
```

**Add React Native Dependencies**

In your applicaltion `build.gradle` add a dependency to `ownid-react-native-gigya` project:

```groovy
implementation project(":ownid-react-native-gigya")
```

Set the correct path to `ownid-react-native-core` and `ownid-react-native-gigya` projects in your `settings.gradle` file:

```groovy
include ":ownid-react-native-core"
project(":ownid-react-native-core").projectDir = new File("../node_modules/@ownid/react-native-core/android")
include ":ownid-react-native-gigya"
project(":ownid-react-native-gigya").projectDir = new File("../node_modules/@ownid/react-native-gigya/android")
```

**Create Configuration File**

The OwnID SDK uses a configuration file in your `assets` folder to configure itself.  At a minimum, this JSON configuration file defines the OwnID App Id - the unique identifier of your OwnID application, which you can obtain from the [OwnID Console](https://console.ownid.com). Create `assets/ownIdGigyaSdkConfig.json` and define the `app_id` parameter:

```json
{
   "app_id": "47tb9nt6iaur0zv" // Use your app id
}
```

**Create Default OwnID CDC Instance**

Before adding OwnID UI to your app screens, you need to use an Android Context and instance of CDC to create a default instance of OwnID CDC. Most commonly, you create this OwnID CDC instance using the Android  [Application class](https://developer.android.com/reference/kotlin/android/app/Application). For information on initializing and creating an instance of CDC, refer to the [SAP CDC documentation](https://github.com/SAP/gigya-android-sdk).


```kotlin
class MyApplication : Application() {
   override fun onCreate() {
      super.onCreate()
      // Create Gigya instance
      Gigya.setApplication(this)
      val gigya = Gigya.getInstance(MyAccount::class.java)
      // Create OwnID Gigya instance
      OwnId.createGigyaInstance(this /* Context */, gigya)
   }
}
```

The OwnID SDK automatically reads the `ownIdGigyaSdkConfig.json` configuration file from your `assets` folder and creates a default instance that is accessible as `OwnId.gigya`.

Finally, locate ReactNativeHost’s getPackages() method and add the `com.ownid.sdk.OwnIdPackage` package to the packages list getPackages():

```kotlin
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
        add(OwnIdPackage())
    }
```

### Configure iOS

**Add Package Dependency**

The OwnID iOS SDK is distributed as an SPM package. Use the Swift Package Manager to add the following package dependency to your project:

```
https://github.com/OwnID/ownid-ios-sdk
```

When prompted, select the **OwnIDGigyaSDK** product.

**Add Property List File to Project**

When the application starts, the OwnID SDK automatically reads `OwnIDConfiguration.plist` from the file system to configure the default instance that is created. In this PLIST file, you must define a redirection URI and the OwnID App Id. Create `OwnIDConfiguration.plist` and define the following mandatory parameters:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>OwnIDRedirectionURL</key>
	<string>com.myapp.demo://bazco</string>
	<key>OwnIDAppID</key>
	<string>47tb9nt6iaur0zv</string> // Use your app id
</dict>
</plist>
```

Where:

- The `OwnIDAppID` is the unique AppID, which you can obtain from the [OwnID Console](https://console.ownid.com).
- The `OwnIDRedirectionURL` is the full redirection URL, including its custom scheme. This URL custom scheme must match the one that you defined in your target.

**Create URL Type (Custom URL Scheme)**

You need to open your project and create a new URL type that corresponds to the redirection URL specified in `OwnIDConfiguration.plist`. In Xcode, go to **Info > URL Types**, and then use the **URL Schemes** field to specify the redirection URL. For example, if the value of the `OwnIDRedirectionURL` key is `com.myapp.demo://bazco`, then you could copy `com.myapp.demo` and paste it into the **URL Schemes** field.

**Add Source Files**

`OwnIDReactCoreSDK` : add folder to the target OwnIDReactCoreSDK from sdk-core/ios  
`OwnIDReactGigyaSDK`: add folder to the target OwnIDReactGigyaSDK from sdk-gigya/ios

:::note

When performing the actions described above, on the dialog, we recommend you to do the following:

- uncheck "Copy items if needed" checkbox
- make sure "Create groups" is selected. 
- add files to your target in order to make it work properly

:::

**Initialize the SDK**

Now that you have added the OwnID package dependency, you need to import the OwnID module so you can access the SDK features. Add the following import to your source files:

```swift
import OwnIDGigyaSDK
```

The OwnID React SDK must be initialized properly using the `configure()` function, preferably in the main entry point of your app (in the `@main` `App` struct).

Also, when react creates the OwnID button, the viewCreationClosure needs to receive the [custom account schema](https://sap.github.io/gigya-swift-sdk/GigyaSwift/#initialization) you use to communicate with Gigya (example: MyAccount.self).
Place the function `createViewClosure()` in the same main entry point of your app: 

```swift
@main
struct ExampleApp: App {

    init() {
        //Init Gigya SDK
        Gigya.sharedInstance(MyAccount.self)
        
        //Init OwnID React SDK
        OwnID.ReactGigyaSDK.configure()

        //create view closure
        createViewClosure()
    }

    private func createViewClosure() {
      CreationInformation.shared.viewCreationClosure = { type in
      let vc = OwnIDGigyaButtonViewController<MyAccount>()
      vc.type = type
      return vc
    }
  }
}
```

## Integrate OwnID with your React Native App

### Registration

Import OwnIdButton and OwnIdRegister functions:

```js
import { OwnIdButton, OwnIdRegister } from '@ownid/react-native-gigya';
```

Add the passwordless authentication to your application's Registration screen by including the OwnIdButton view with type `register`

```js
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
const onOwnIdEvent = (event) => {
  switch (event.eventType) {
      // Event when OwnID is busy processing request
      case 'OwnIdRegisterEvent.Busy':
        /* Show busy status 'event.isBusy' according to your application UI */
        break;
      // Event when user successfully finishes Skip Password in OwnID Web App  
      case 'OwnIdRegisterEvent.ReadyToRegister':
        setOwnIdReadyToRegister(true);
        setEmail(event.loginId); // OwnID Web App may ask user to enter his login id (like email)
        break;
      
      // Event when user select "Undo" option in ready-to-register state
      case 'OwnIdRegisterEvent.Undo':
        setOwnIdReadyToRegister(false);
        break;
      // Event when OwnID creates Gigya account and logs in user  
      case 'OwnIdRegisterEvent.LoggedIn':
        setOwnIdReadyToRegister(false);
        /* User is logged in with OwnID */
        break;
      
      // Event when OwnID returns an error
      case 'OwnIdRegisterEvent.Error':
        /* Handle 'event.cause' according to your application flow  */
        break;
  }
};
return (
  <View>
    <TextInput value={name} onChangeText={setName} placeholder="First Name"/>
    <TextInput value={email} onChangeText={setEmail} placeholder="Email"/>
    <View>
      <TextInput placeholder="Password" secureTextEntry={true}/>
      <OwnIdButton type="register" loginId={email} onOwnIdEvent={onOwnIdEvent} />
    </View>
    <TouchableOpacity onPress={onSubmit}><Text>Create Account</Text></TouchableOpacity>
  </View>
);
```

The OwnID `OwnIdRegister()` function must be called in response to the `ReadyToRegister` event. This function calls the standard Gigya SDK function `register(String email, String password, Map<String, Object> params, GigyaLoginCallback<T> callback)` to register the user in Gigya, so you do not need to call this Gigya function yourself. You can define custom parameters for the registration request and pass it to `OwnIdRegister().` These parameters are passed to the [Gigya registration call](https://github.com/SAP/gigya-android-sdk/tree/main/sdk-core#register-via-email--password).

### Login

The process of implementing your Login screen is very similar to the one used to implement the Registration screen - add an OwnIdButton view to your Login screen. Your app then waits for events while the user interacts with OwnID.

Import OwnIdButton function:

```js
import { OwnIdButton } from '@ownid/react-native-gigya';
```

Similar to the Registration screen, add the passwordless authentication to your application's Login screen by including the OwnIdButton view with type `login`:

```js
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const onOwnIdEvent = (event) => {
  switch (event.eventType) {
    // Event when OwnID is busy processing request
    case 'OwnIdLoginEvent.Busy':
      /* Show busy status 'event.isBusy' according to your application UI */
      break;
    
    //Event when user who previously set up OwnID logs in with Skip Password
    case 'OwnIdLoginEvent.LoggedIn':
      /* User is logged in with OwnID */
      break;
    
    // Event when OwnID returns an error
    case 'OwnIdLoginEvent.Error':
      /* Handle 'event.cause' according to your application flow  */
      break;
    }
};
return (
  <View>
    <TextInput value={email} onChangeText={setEmail} placeholder="Email"/>
    <View>
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={true} />
      <OwnIdButton type="login" loginId={email} onOwnIdEvent={onOwnIdEvent} />
    </View>
    ...
  </View>
);
```

## Customizing the UI

The following is a complete list of UI customization parameters:

**Parameters**

* `backgroundColor` - background color of the button (default value `#FFFFFF`, default value-night: `#2A3743`)
* `borderColor` - border color of the button (default value `#D0D0D0`, default value-night: `#2A3743`) 
* `biometryIconColor` - icon or text color (default value `#0070F2`, default value-night: `#2E8FFF`)

Here's an example on how you can change these parameters:

```js
<OwnIdButton ... showOr={true} style={{ backgroundColor: "#FFFFFF", biometryIconColor: "#0070F2", borderColor: "#D0D0D0" }}/>
```

## What is OwnID?
OwnID offers a passwordless login alternative to a website by using cryptographic keys to replace the traditional password. The public part of a key is stored in the website's identity platform while the private part is stored on the mobile device. With OwnID, the user’s phone becomes their method of login.
When a user registers for an account on their phone, selecting Skip Password is all that is needed to store the private key on the phone. As a result, as long as they are logging in on their phone, selecting Skip Password logs the user into the site automatically. If the user accesses the website on a desktop, they register and log in by using their mobile device to scan a QR code. Enhanced security is available by incorporating biometrics or other multi-factor authentication methods into the registration and login process.

## License
This project is licensed under the Apache License 2.0. See the LICENSE file for more information.
