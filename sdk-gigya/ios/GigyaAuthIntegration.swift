import Foundation
import Gigya
import OwnIDCoreSDK
import SwiftUI

class GigyaAuthIntegration<T: GigyaAccountProtocol>: AuthIntegration {
    func createOwnIDRegisterButton(for viewModel: OwnID.FlowsSDK.RegisterView.ViewModel) -> AutoSizingHostingController<OwnID.FlowsSDK.RegisterView> {
        let headerView = OwnID.ReactGigyaSDK.createRegisterView(viewModel: viewModel)
        let headerVC = AutoSizingHostingController(rootView: headerView)
        headerVC.view.backgroundColor = .clear
        return headerVC
    }
    
    func createOwnIDLoginButton(for viewModel: OwnID.FlowsSDK.LoginView.ViewModel) -> AutoSizingHostingController<OwnID.FlowsSDK.LoginView> {
        let headerView = OwnID.ReactGigyaSDK.createLoginView(viewModel: viewModel)
        let headerVC = AutoSizingHostingController(rootView: headerView)
        headerVC.view.backgroundColor = .clear
        return headerVC
    }
    
    func createRegisterViewModel(loginIdPublisher: OwnIDCoreSDK.OwnID.CoreSDK.LoginIdPublisher) -> OwnID.FlowsSDK.RegisterView.ViewModel {
        OwnID.ReactGigyaSDK.registrationViewModel(instance: Gigya.sharedInstance(T.self), loginIdPublisher: loginIdPublisher)
    }
    
    func createLoginViewModel(loginIdPublisher: OwnIDCoreSDK.OwnID.CoreSDK.LoginIdPublisher) -> OwnID.FlowsSDK.LoginView.ViewModel {
        OwnID.ReactGigyaSDK.loginViewModel(instance: Gigya.sharedInstance(T.self), loginIdPublisher: loginIdPublisher)
    }
    
    func errorDictionary(_ error: OwnID.CoreSDK.Error) -> [String: Any] {
        var code = ""
        var callId = ""
        let gigyaDataString = ""
        var errorCode = ""
        var localizedMessage = ""
        switch error {
        case .userError(let errorModel):
            code = errorModel.code.rawValue
        case .integrationError(let error):
            if let error = error as? NetworkError {
                switch error {
                case .gigyaError(let model):
                    callId = model.callId
                    errorCode = "\(model.errorCode)"
                    localizedMessage = model.errorMessage ?? ""
                default:
                    break
                }
            }
        default:
            break
        }
        
        var errorDictionary: [String: Any] = ["className": String(describing: Self.self),
                                              "code": code,
                                              "message": error.localizedDescription,
                                              "stackTrace": ""]
        if !callId.isEmpty, !gigyaDataString.isEmpty, !errorCode.isEmpty, !localizedMessage.isEmpty {
            errorDictionary["gigyaError"] = ["callId": callId,
                                             "data": gigyaDataString,
                                             "erorCode": errorCode,
                                             "localizedMessage": localizedMessage]
        }
        return errorDictionary
    }
}
