import Foundation
import SwiftUI
import OwnIDCoreSDK

class CoreAuthIntegration: AuthIntegration {
    func createOwnIDRegisterButton(for viewModel: OwnID.FlowsSDK.RegisterView.ViewModel) -> UIHostingController<OwnID.FlowsSDK.RegisterView> {
        let headerView = OwnID.FlowsSDK.RegisterView(viewModel: viewModel, visualConfig: .init())
        let headerVC = UIHostingController(rootView: headerView)
        headerVC.view.backgroundColor = .clear
        return headerVC
    }
    
    func createOwnIDLoginButton(for viewModel: OwnID.FlowsSDK.LoginView.ViewModel) -> UIHostingController<OwnID.FlowsSDK.LoginView> {
        let headerView = OwnID.FlowsSDK.LoginView(viewModel: viewModel, visualConfig: .init())
        let headerVC = UIHostingController(rootView: headerView)
        headerVC.view.backgroundColor = .clear
        return headerVC
    }
    
    func createRegisterViewModel(loginIdPublisher: OwnID.CoreSDK.LoginIdPublisher) -> OwnID.FlowsSDK.RegisterView.ViewModel {
        OwnID.FlowsSDK.RegisterView.ViewModel(loginIdPublisher: loginIdPublisher)
    }
    
    func createLoginViewModel(loginIdPublisher: OwnID.CoreSDK.LoginIdPublisher) -> OwnID.FlowsSDK.LoginView.ViewModel {
        OwnID.FlowsSDK.LoginView.ViewModel(loginIdPublisher: loginIdPublisher)
    }
    
    func errorDictionary(_ error: OwnID.CoreSDK.Error) -> [String: Any] {
        let code: String
        switch error {
        case .userError(let errorModel):
            code = errorModel.code.rawValue
        default:
            code = ""
        }
        
        let errorDictionary = ["className": String(describing: Self.self),
                               "code": code,
                               "message": error.localizedDescription,
                               "stackTrace": ""]
        return errorDictionary
    }
}
