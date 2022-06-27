# OwnID React Native Core SDK
A library for integrating OwnID into a React Native application.

## Table of contents
* [Installation](#installation)
* [What is OwnID?](#what-is-ownid)
* [License](#license)

---

## Installation
Use the npm CLI to run:
```bash
npm install @ownid/react-native-core
```

## What is OwnID?
OwnID offers a passwordless login alternative to a website by using cryptographic keys to replace the traditional password. The public part of a key is stored in the website's identity platform while the private part is stored on the mobile device. With OwnID, the user’s phone becomes their method of login.
When a user registers for an account on their phone, selecting Skip Password is all that is needed to store the private key on the phone. As a result, as long as they are logging in on their phone, selecting Skip Password logs the user into the site automatically. If the user accesses the website on a desktop, they register and log in by using their mobile device to scan a QR code. Enhanced security is available by incorporating biometrics or other multi-factor authentication methods into the registration and login process.

## License
This project is licensed under the Apache License 2.0. See the LICENSE file for more information.
