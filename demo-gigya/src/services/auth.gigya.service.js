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

  async register({ email, password, name }) {
    try {
      const result = await GigyaModule.register(email, password, name);
      console.log('register', result);
      return result;
    } catch (error) {
      return { error };
    }
  }

  async login(loginId, password, params) {
    try {
      const result = await GigyaModule.login(loginId, password, params);
      console.log('login', result);
      return result;
    } catch (error) {
      return { error };
    }
  }

  async logout() {
    return await GigyaModule.logout();
  }
}

export default new GigyaAuth();
