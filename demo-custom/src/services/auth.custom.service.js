import { NativeModules } from 'react-native';
const { CustomAuthModule } = NativeModules;

class CustomAuth {

  async isLoggedIn() {
    return await CustomAuthModule.isLoggedIn();
  }

  async getProfile() {
    const profile = await CustomAuthModule.getProfile();
    return { name: profile.name, email: profile.email };
  }

  async register(name, email, password) {
    try {
      return await CustomAuthModule.register(email, password, name);
    } catch (error) {
      return { error };
    }
  }

  async login(email, password) {
    try {
      return await CustomAuthModule.login(email, password);
    } catch (error) {
      return { error };
    }
  }

  async logout() {
    return await CustomAuthModule.logout();
  }
}

export default new CustomAuth();
