import Combine
import OwnIDCoreSDK

final class CustomAuthSystem {
  private var bag = Set<AnyCancellable>()
  
  public static var customUser: CustomUser?
  private static var token = ""
  
  static private let baseURL = "SET_YOUR_URL_HERE"
  
  static func isLoggedIn() -> Bool {
    customUser != nil
  }
  
  static func login(ownIdData: Any?,
                    password: String? = .none,
                    email: String) -> AnyPublisher<OwnID.LoginResult, OwnID.CoreSDK.Error> {
    if let ownIdData = ownIdData as? [String: String], let token = ownIdData["token"] {
      return Just(OwnID.LoginResult(operationResult: token, authType: "login"))
        .setFailureType(to: OwnID.CoreSDK.Error.self)
        .eraseToAnyPublisher()
    }
    let payloadDict = ["email": email, "password": password]
    return Just(payloadDict)
      .setFailureType(to: OwnID.CoreSDK.Error.self)
      .eraseToAnyPublisher()
      .tryMap { try JSONSerialization.data(withJSONObject: $0) }
      .map { payloadData -> URLRequest in
        var request = URLRequest(url: URL(string: "\(baseURL)/login")!)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpMethod = "POST"
        request.httpBody = payloadData
        return request
      }
      .flatMap {
        URLSession.shared.dataTaskPublisher(for: $0)
          .mapError { OwnID.CoreSDK.Error.plugin(error: CustomIntegrationError.generalError(error: $0)) }
          .eraseToAnyPublisher()
      }
      .eraseToAnyPublisher()
      .map { $0.data }
      .decode(type: LoginResponse.self, decoder: JSONDecoder())
      .mapError { OwnID.CoreSDK.Error.plugin(error: CustomIntegrationError.generalError(error: $0)) }
      .map { model in
        token = model.token
        return OwnID.LoginResult(operationResult: model.token, authType: "login")
      }
      .receive(on: DispatchQueue.main)
      .mapError { OwnID.CoreSDK.Error.plugin(error: CustomIntegrationError.generalError(error: $0)) }
      .eraseToAnyPublisher()
  }
  
  static func register(ownIdData: String?,
                       password: String,
                       email: String,
                       name: String) -> AnyPublisher<OwnID.RegisterResult, OwnID.CoreSDK.Error> {
    var payloadDict = ["email": email, "password": password, "name": name]
    if let ownIdData {
      payloadDict["ownIdData"] = ownIdData
    }
    return urlSessionRequest(for: payloadDict)
      .eraseToAnyPublisher()
      .flatMap { (data, response) -> AnyPublisher<OwnID.RegisterResult, OwnID.CoreSDK.Error> in
        guard !data.isEmpty else {
          let error = OwnID.CoreSDK.Error.plugin(error: CustomIntegrationError.responseIsEmpty)
          
          return Fail(error: error).eraseToAnyPublisher()
        }
        
        let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String : Any]
        if let errors = json?["errors"] as? [String], let errorMessage = errors.first {
          let error = CustomIntegrationError.registrationDataError(message: errorMessage)
          return Fail(error: OwnID.CoreSDK.Error.plugin(error: error))
            .eraseToAnyPublisher()
        } else {
          return login(ownIdData: ownIdData, password: password, email: email)
            .map { loginResult -> OwnID.RegisterResult in
              OwnID.RegisterResult(operationResult: token, authType: "register")
            }
            .eraseToAnyPublisher()
        }
      }
      .eraseToAnyPublisher()
      .receive(on: DispatchQueue.main)
      .eraseToAnyPublisher()
  }
  
  private static func urlSessionRequest(for payloadDict: [String: Any]) -> AnyPublisher<URLSession.DataTaskPublisher.Output, OwnID.CoreSDK.Error> {
    return Just(payloadDict)
      .setFailureType(to: OwnID.CoreSDK.Error.self)
      .eraseToAnyPublisher()
      .tryMap { try JSONSerialization.data(withJSONObject: $0) }
      .mapError { OwnID.CoreSDK.Error.plugin(error: CustomIntegrationError.generalError(error: $0)) }
      .map { payloadData -> URLRequest in
        var request = URLRequest(url: URL(string: "\(baseURL)/register")!)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpMethod = "POST"
        request.httpBody = payloadData
        return request
      }
      .eraseToAnyPublisher()
      .flatMap {
        URLSession.shared.dataTaskPublisher(for: $0)
          .mapError { OwnID.CoreSDK.Error.plugin(error: CustomIntegrationError.generalError(error: $0)) }
          .eraseToAnyPublisher()
      }
      .mapError { OwnID.CoreSDK.Error.plugin(error: CustomIntegrationError.generalError(error: $0)) }
      .eraseToAnyPublisher()
  }
  
  static func fetchUserData() -> AnyPublisher<CustomUser, OwnID.CoreSDK.Error> {
    return Just(token)
      .setFailureType(to: OwnID.CoreSDK.Error.self)
      .eraseToAnyPublisher()
      .map { previousResult -> URLRequest in
        var request = URLRequest(url: URL(string: "\(baseURL)/profile")!)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(previousResult)", forHTTPHeaderField: "Authorization")
        request.httpMethod = "GET"
        return request
      }
      .flatMap {
        URLSession.shared.dataTaskPublisher(for: $0)
          .mapError { OwnID.CoreSDK.Error.plugin(error: CustomIntegrationError.generalError(error: $0)) }
          .eraseToAnyPublisher()
      }
      .eraseToAnyPublisher()
      .map { $0.data }
      .decode(type: CustomUser.self, decoder: JSONDecoder())
      .receive(on: DispatchQueue.main)
      .mapError { OwnID.CoreSDK.Error.plugin(error: CustomIntegrationError.generalError(error: $0)) }
      .eraseToAnyPublisher()
  }
  
  static func logOut() {
    print("logOut action in LoggedIn")
  }
}

struct LoginResponse: Decodable {
  let token: String
}

extension String: OperationResult { }

enum CustomIntegrationError: PluginError {
  case generalError(error: Error)
  case responseIsEmpty
  case registrationDataError(message: String)
  
  var errorDescription: String? {
    switch self {
    case .registrationDataError(let message):
      return message
    default:
      return "Something went wrong"
    }
  }
}

struct CustomUser: Decodable {
  public init(email: String, name: String) {
    self.email = email
    self.name = name
  }
  
  let email: String
  let name: String
}
