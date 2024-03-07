class Auth {

  baseAppUrl: string;

  constructor(baseAppUrl: string) {
    this.baseAppUrl = baseAppUrl;
  }

  currentUser: User | null = null;

  isLoggedIn() {
    return this.currentUser != null;
  }

  profile(): User {
    return this.currentUser!;
  }

  async getProfile(token: string): Promise<User> {
    return fetch(this.baseAppUrl + "profile", { headers: { "Authorization": "Bearer " + token } })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          throw new Error(response.url + " : " + response.status.toString());
        }
      }).then((responseJson) => {
        this.currentUser = new User(responseJson.name, responseJson.email, token);
        return this.currentUser;
      })
  }

  async register(email: string, password: string, name: string, ownIdData: string): Promise<string> {
    return fetch(this.baseAppUrl + "register", {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', },
      body: JSON.stringify({ name, email, password, ownIdData })
    })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          throw new Error(response.url + " : " + response.status.toString());
        }
      })
      .then((responseJson) => {
        return responseJson.token;
      })
  }

  async login(email: string, password: string): Promise<string> {
    return fetch(this.baseAppUrl + "login", {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', },
      body: JSON.stringify({ email, password })
    }).then((response) => {
      if (response.status === 200) {
        return response.json();
      } else {
        throw new Error(response.url + " : " + response.status.toString());
      }
    }).then((responseJson) => {
      return responseJson.token;
    })
  }

  logout() {
    this.currentUser = null;
  }
}

export class User {
  name: string;
  email: string;
  token: string;
  constructor(name: string, email: string, token: string) {
    this.name = name;
    this.email = email;
    this.token = token;
  }
}

export default Auth;