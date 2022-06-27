import Foundation
import Gigya
import OwnIDGigyaSDK
import SwiftUI

final class OwnIDGigyaButtonViewController<T: GigyaAccountProtocol>: OwnIDButtonViewController {
  override func createRegisterViewModel() -> OwnID.FlowsSDK.RegisterView.ViewModel {
    OwnID.ReactGigyaSDK.registrationViewModel(instance: Gigya.sharedInstance(T.self))
  }
  
  override func createLoginViewModel() -> OwnID.FlowsSDK.LoginView.ViewModel {
    OwnID.ReactGigyaSDK.loginViewModel(instance: Gigya.sharedInstance(T.self))
  }
  
  override func createOwnIDRegisterButton(for viewModel: OwnID.FlowsSDK.RegisterView.ViewModel) -> UIHostingController<OwnID.FlowsSDK.RegisterView> {
    let headerView = OwnID.ReactGigyaSDK.createRegisterView(viewModel: viewModel, email: .init(get: { self.loginId }, set: { _ in }))
    let headerVC = UIHostingController(rootView: headerView)
    return headerVC
  }
  
  override func createOwnIDLoginButton(for viewModel: OwnID.FlowsSDK.LoginView.ViewModel) -> UIHostingController<OwnID.FlowsSDK.LoginView> {
    let headerView = OwnID.ReactGigyaSDK.createLoginView(viewModel: viewModel, usersEmail: .init(get: { self.loginId }, set: { _ in }))
    let headerVC = UIHostingController(rootView: headerView)
    return headerVC
  }
  
  override func register(_ loginId: String, registrationParameters: [String: Any]) {
    let params = OwnID.GigyaSDK.Registration.Parameters(parameters: registrationParameters)
    ownIDVRegisteriewModel?.register(with: loginId, registerParameters: params)
  }
}
