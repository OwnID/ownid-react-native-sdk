import { NativeModules } from 'react-native';
const { GigyaModule } = NativeModules;

class GigyaAuth {

  async isLoggedIn() {
    return await GigyaModule.isLoggedIn();
  }

  async getProfile() {
    const profile = await GigyaModule.getProfile();
    return { name: profile.name, email: profile.email };
  }

  async register(email: string, password: string, name: string) {
    try {
      return result = await GigyaModule.register(email, password, name);
    } catch (error) {
      return { error };
    }
  }

  async login(loginId: string, password: string) {
    try {
      return result = await GigyaModule.login(loginId, password);
    } catch (error) {
      return { error };
    }
  }

  async logout() {
    return await GigyaModule.logout();
  }
}

export default new GigyaAuth();
