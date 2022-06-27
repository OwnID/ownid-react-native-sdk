import Foundation
import OwnIDGigyaSDK
import Gigya
import SwiftUI

extension OwnID.ReactGigyaSDK {
  static let sdkName = "React"
  static let version = "0.0.1"
}

extension OwnID {
  final class ReactGigyaSDK {
    // MARK: Setup
    
    public static func info() -> OwnID.CoreSDK.SDKInformation {
      (sdkName, version)
    }
    
    public static func underlying() -> [OwnID.CoreSDK.SDKInformation] {
      [GigyaSDK.info()]
    }
    
    /// Standart configuration, searches for default .plist file
    public static func configure() {
      OwnID.CoreSDK.shared.configure(userFacingSDK: info(), underlyingSDKs: underlying())
    }
    
    /// Configures SDK from URL
    /// - Parameter plistUrl: Config plist URL
    public static func configure(plistUrl: URL) {
      OwnID.CoreSDK.shared.configureFor(plistUrl: plistUrl, userFacingSDK: info(), underlyingSDKs: underlying())
    }
    
    /// Configures SDK from parameters
    /// - Parameters:
    ///   - serverURL: ServerURL
    ///   - redirectionURL: RedirectionURL
    public static func configure(appID: String, redirectionURL: String, environment: String? = .none) {
      OwnID.CoreSDK.shared.configure(appID: appID,
                                     redirectionURL: redirectionURL,
                                     userFacingSDK: info(),
                                     underlyingSDKs: underlying(),
                                     environment: environment)
    }
    
    /// Used to handle the redirects from browser after webapp is finished
    /// - Parameter url: URL returned from webapp after it has finished
    public static func handle(url: URL) {
      OwnID.CoreSDK.shared.handle(url: url, sdkConfigurationName: sdkName)
    }
    
    // MARK: View Model Flows
    
    /// Creates view model for register flow in Gigya and manages ``OwnID.FlowsSDK.RegisterView``
    /// - Parameters:
    ///   - instance: Instance of Gigya SDK (with custom schema if needed)
    ///   - webLanguages: Languages for web view. List of well-formed [IETF BCP 47 language tag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language) .
    /// - Returns: View model for register flow
    public static func registrationViewModel<T: GigyaAccountProtocol>(instance: GigyaCore<T>,
                                                                      webLanguages: OwnID.CoreSDK.Languages = .init(rawValue: Locale.preferredLanguages)) -> OwnID.FlowsSDK.RegisterView.ViewModel {
      return GigyaSDK.registrationViewModel(instance: instance, webLanguages: webLanguages, sdkName: sdkName)
    }
    
    /// View that encapsulates management of ``OwnID.SkipPasswordView`` state
    /// - Parameter viewModel: ``OwnID.FlowsSDK.RegisterView.ViewModel``
    /// - Parameter email: email to be used in link on login and displayed when loggin in
    /// - Returns: View to display
    public static func createRegisterView(viewModel: OwnID.FlowsSDK.RegisterView.ViewModel,
                                          email: Binding<String>,
                                          visualConfig: OwnID.UISDK.VisualLookConfig = .init()) -> OwnID.FlowsSDK.RegisterView {
        OwnID.FlowsSDK.RegisterView(viewModel: viewModel, usersEmail: email, visualConfig: visualConfig)
    }
    
    /// Creates view model for log in flow in Gigya and manages ``OwnID.FlowsSDK.RegisterView``
    /// - Parameters:
    ///   - instance: Instance of Gigya SDK (with custom schema if needed)
    ///   - webLanguages: Languages for web view. List of well-formed [IETF BCP 47 language tag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language) .
    /// - Returns: View model for log in
    public static func loginViewModel<T: GigyaAccountProtocol>(instance: GigyaCore<T>,
                                                               webLanguages: OwnID.CoreSDK.Languages = .init(rawValue: Locale.preferredLanguages)) -> OwnID.FlowsSDK.LoginView.ViewModel {
      return GigyaSDK.loginViewModel(instance: instance, sdkName: sdkName)
    }
    
    /// View that encapsulates management of ``OwnID.SkipPasswordView`` state
    /// - Parameter viewModel: ``OwnID.LoginView.ViewModel``
    /// - Parameter usersEmail: Email to be used in link on login and displayed when loggin in
    /// - Returns: View to display
    public static func createLoginView(viewModel: OwnID.FlowsSDK.LoginView.ViewModel,
                                       usersEmail: Binding<String>,
                                       visualConfig: OwnID.UISDK.VisualLookConfig = .init()) -> OwnID.FlowsSDK.LoginView {
        OwnID.FlowsSDK.LoginView(viewModel: viewModel,
                                 usersEmail: usersEmail,
                                 visualConfig: visualConfig)
    }
  }
}
