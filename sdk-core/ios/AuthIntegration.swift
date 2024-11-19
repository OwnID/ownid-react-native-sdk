import Foundation
import SwiftUI
import OwnIDCoreSDK

public protocol AuthIntegration {
    func createOwnIDRegisterButton(for viewModel: OwnID.FlowsSDK.RegisterView.ViewModel) -> AutoSizingHostingController<OwnID.FlowsSDK.RegisterView>
    func createOwnIDLoginButton(for viewModel: OwnID.FlowsSDK.LoginView.ViewModel) -> AutoSizingHostingController<OwnID.FlowsSDK.LoginView>
    func createRegisterViewModel(loginIdPublisher: OwnID.CoreSDK.LoginIdPublisher) -> OwnID.FlowsSDK.RegisterView.ViewModel
    func createLoginViewModel(loginIdPublisher: OwnID.CoreSDK.LoginIdPublisher) -> OwnID.FlowsSDK.LoginView.ViewModel
    func errorDictionary(_ error: OwnID.CoreSDK.Error) -> [String: Any]
}
