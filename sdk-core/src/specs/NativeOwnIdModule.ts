import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type OwnIdConfiguration = {
  appId: string;
  env?: string;
  region?: string;
  enableLogging?: boolean;
  redirectionUri?: string;
  redirectionUriAndroid?: string;
  redirectionUriIos?: string;
};

export interface Spec extends TurboModule {
  createInstance(
    configuration: OwnIdConfiguration,
    productName: string,
    instanceName?: string | null,
  ): Promise<void>;

  setLocale(locale?: string | null): Promise<void>;

  enrollCredential(
    loginId: string,
    authToken: string,
    force: boolean,
    instanceName?: string | null,
  ): Promise<void>;
}

export default (TurboModuleRegistry.get<Spec>(
  'OwnIdModule',
) as Spec | null);
