import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { UnsafeObject, Int32 } from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  createInstance(configuration: UnsafeObject): Promise<void>;
  registerUser(loginId: string, params?: UnsafeObject): Promise<void>;
  registerAtViewTag(viewTag: Int32, loginId: string, params?: UnsafeObject): void;
}

export default (TurboModuleRegistry.get<Spec>('OwnIdGigyaModule',) as Spec | null);
