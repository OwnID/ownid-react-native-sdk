import OwnIDCoreSDK
import SwiftUI
import SDKCore
import Combine

final class OwnIDCustomButtonViewController: OwnIDButtonViewController {
  private let sdkName = "OwnIDCustom"
  
  override func createRegisterViewModel() -> OwnID.FlowsSDK.RegisterView.ViewModel {
    OwnID.FlowsSDK.RegisterView.ViewModel(registrationPerformer: CustomRegistration(),
                                          loginPerformer: CustomLogin(),
                                          sdkConfigurationName: sdkName,
                                          webLanguages: .init(rawValue: Locale.preferredLanguages))
  }
  
  override func createLoginViewModel() -> OwnID.FlowsSDK.LoginView.ViewModel {
    OwnID.FlowsSDK.LoginView.ViewModel(loginPerformer: CustomLogin(),
                                       sdkConfigurationName: sdkName,
                                       webLanguages: .init(rawValue: Locale.preferredLanguages))
  }
  
  override func createOwnIDRegisterButton(for viewModel: OwnID.FlowsSDK.RegisterView.ViewModel) -> UIHostingController<OwnID.FlowsSDK.RegisterView> {
    let headerView = OwnID.FlowsSDK.RegisterView(viewModel: viewModel,
                                                 usersEmail: .init(get: { self.loginId }, set: { _ in }),
                                                 visualConfig: .init())
    let headerVC = UIHostingController(rootView: headerView)
    headerVC.view.backgroundColor = .clear
    return headerVC
  }
  
  override func createOwnIDLoginButton(for viewModel: OwnID.FlowsSDK.LoginView.ViewModel) -> UIHostingController<OwnID.FlowsSDK.LoginView> {
    let headerView = OwnID.FlowsSDK.LoginView(viewModel: viewModel,
                                              usersEmail: .init(get: { self.loginId }, set: { _ in }),
                                              visualConfig: .init())
    let headerVC = UIHostingController(rootView: headerView)
    headerVC.view.backgroundColor = .clear
    return headerVC
  }
  
  override func register(_ loginId: String, registrationParameters: [String: Any]) {
    do {
      let jsonData = try JSONSerialization.data(withJSONObject: registrationParameters)
      let params = try JSONDecoder().decode(CustomParameters.self, from: jsonData)
      ownIDRegisterModel?.register(with: loginId, registerParameters: params)
    } catch {
      print(error)
    }
  }
}

final class CustomLogin: LoginPerformer {
  func login(payload: OwnID.CoreSDK.Payload, email: String) -> AnyPublisher<OwnID.LoginResult, OwnID.CoreSDK.Error> {
    CustomAuthSystem.login(ownIdData: payload.dataContainer, email: email)
  }
}

final class CustomRegistration: RegistrationPerformer {
  func register(configuration: OwnID.FlowsSDK.RegistrationConfiguration,
                parameters: RegisterParameters) -> AnyPublisher<OwnID.RegisterResult, OwnID.CoreSDK.Error> {
    let ownIdData = configuration.payload.dataContainer
    return CustomAuthSystem.register(ownIdData: ownIdData as? String,
                                     password: OwnID.FlowsSDK.Password.generatePassword().passwordString,
                                     email: configuration.email.rawValue,
                                     name: (parameters as? CustomParameters)?.name ?? "no name in CustomRegistration class")
  }
}

struct CustomParameters: RegisterParameters, Decodable {
  let name: String
}

