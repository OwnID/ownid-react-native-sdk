import type { ConfigContext, ExpoConfig } from 'expo/config';

const APPLICATION_ID = 'com.ownid.demo.uat';
const APPLE_TEAM_ID = 'GR7KL5JY22';

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    name: 'OwnID Expo UAT',
    slug: 'demo-expo-latest',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    ios: {
      ...config.ios,
      appleTeamId: APPLE_TEAM_ID,
      associatedDomains: ['webcredentials:brita.fido.fun'],
      bundleIdentifier: APPLICATION_ID,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSCameraUsageDescription: 'Camera access is used to verify your identity during sign-in.',
        NSLocationWhenInUseUsageDescription: 'Location access is used to support identity verification during sign-in.',
      },
      supportsTablet: true,
      userInterfaceStyle: 'automatic',
    },
    android: {
      ...config.android,
      package: APPLICATION_ID,
      permissions: [
        ...(config.android?.permissions ?? []),
        'android.permission.CAMERA',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ],
    },
    plugins: [
      ...(config.plugins ?? []),
      ['expo-build-properties', { ios: { enableSceneSupport: true } }],
      './plugins/withDemoAndroidSigning',
    ],
  }) satisfies ExpoConfig;
