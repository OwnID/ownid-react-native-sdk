import { Platform, requireNativeComponent } from 'react-native';
import type { WebViewProps } from 'react-native-webview';

type WebViewNativeConfig = NonNullable<WebViewProps['nativeConfig']>;
type WebViewNativeComponent = NonNullable<WebViewNativeConfig['component']>;

const webAuthenticationComponent =
  Platform.OS === 'android' ? (requireNativeComponent('OwnIDWebAuthenticationWebView') as WebViewNativeComponent) : undefined;

export const webAuthenticationNativeConfig: WebViewNativeConfig | undefined =
  webAuthenticationComponent === undefined ? undefined : { component: webAuthenticationComponent };
