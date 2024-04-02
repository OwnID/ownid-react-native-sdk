import Foundation
import Gigya
import SwiftUI
@_exported import OwnIDGigyaSDK
@_exported import SDKCore

extension OwnID.ReactGigyaSDK {
    static let sdkName = "React"
    static let version = "3.1.0"
}

public extension OwnID {
    final class ReactGigyaSDK {
        // MARK: Setup
        
        public static func info() -> OwnID.CoreSDK.SDKInformation { (sdkName, version) }
        
        public static func underlying() -> [OwnID.CoreSDK.SDKInformation] { [GigyaSDK.info()] }
        
        /// Standard configuration, searches for default .plist file
        public static func configure<T: GigyaAccountProtocol>(_ dataType: T.Type, supportedLanguages: [String] = Locale.preferredLanguages) {
            OwnID.CoreSDK.configure(userFacingSDK: info(), underlyingSDKs: underlying(), supportedLanguages: supportedLanguages)
            CreationInformation.shared.authIntegration = GigyaAuthIntegration<T>()
        }
        
        /// Configures SDK from plist path URL
        public static func configure<T: GigyaAccountProtocol>(_ dataType: T.Type, 
                                                              plistUrl: URL,
                                                              supportedLanguages: [String] = Locale.preferredLanguages) {
            OwnID.CoreSDK.configure(plistUrl: plistUrl, userFacingSDK: info(), underlyingSDKs: underlying(), supportedLanguages: supportedLanguages)
            CreationInformation.shared.authIntegration = GigyaAuthIntegration<T>()
        }
        
        public static func configure<T: GigyaAccountProtocol>(_ dataType: T.Type,
                                                              appID: OwnID.CoreSDK.AppID,
                                                              redirectionURL: OwnID.CoreSDK.RedirectionURLString? = nil,
                                                              environment: String? = nil,
                                                              supportedLanguages: [String] = Locale.preferredLanguages) {
            OwnID.CoreSDK.configure(appID: appID,
                                    redirectionURL: redirectionURL,
                                    userFacingSDK: info(),
                                    underlyingSDKs: underlying(),
                                    environment: environment,
                                    supportedLanguages: supportedLanguages)
            CreationInformation.shared.authIntegration = GigyaAuthIntegration<T>()
        }
        
        /// Standard configuration, searches for default .plist file
        public static func configure(supportedLanguages: [String] = Locale.preferredLanguages) {
            OwnID.CoreSDK.configure(userFacingSDK: info(),
                                    underlyingSDKs: underlying(),
                                    supportedLanguages: supportedLanguages)
            CreationInformation.shared.authIntegration = GigyaAuthIntegration<GigyaAccount>()
        }
        
        /// Configures SDK from plist path URL
        public static func configure(plistUrl: URL, supportedLanguages: [String] = Locale.preferredLanguages) {
            OwnID.CoreSDK.configure(plistUrl: plistUrl,
                                    userFacingSDK: info(),
                                    underlyingSDKs: underlying(),
                                    supportedLanguages: supportedLanguages)
            CreationInformation.shared.authIntegration = GigyaAuthIntegration<GigyaAccount>()
        }
        
        public static func configure(appID: OwnID.CoreSDK.AppID,
                                     redirectionURL: OwnID.CoreSDK.RedirectionURLString? = nil,
                                     environment: String? = nil,
                                     supportedLanguages: [String] = Locale.preferredLanguages) {
            OwnID.CoreSDK.configure(appID: appID,
                                    redirectionURL: redirectionURL,
                                    userFacingSDK: info(),
                                    underlyingSDKs: underlying(),
                                    environment: environment,
                                    supportedLanguages: supportedLanguages)
            CreationInformation.shared.authIntegration = GigyaAuthIntegration<GigyaAccount>()
        }
        
        /// Handles redirects from other flows back to the app
        public static func handle(url: URL) {
            OwnID.GigyaSDK.handle(url: url)
        }
        
        // MARK: View Model Flows
        
        /// Creates view model for register flow to manage `OwnID.FlowsSDK.RegisterView`
        /// - Parameters:
        ///   - instance: Instance of Gigya SDK (with custom schema if needed)
        public static func registrationViewModel<T: GigyaAccountProtocol>(instance: GigyaCore<T>,
                                                                          loginIdPublisher: OwnID.CoreSDK.LoginIdPublisher) -> OwnID.FlowsSDK.RegisterView.ViewModel {
            GigyaSDK.registrationViewModel(instance: instance, loginIdPublisher: loginIdPublisher)
        }
        
        public static func createRegisterView(viewModel: OwnID.FlowsSDK.RegisterView.ViewModel,
                                              visualConfig: OwnID.UISDK.VisualLookConfig = .init()) -> OwnID.FlowsSDK.RegisterView {
            OwnID.FlowsSDK.RegisterView(viewModel: viewModel, visualConfig: visualConfig)
        }
        
        /// Creates view model for login flow to manage `OwnID.FlowsSDK.LoginView`
        /// - Parameters:
        ///   - instance: Instance of Gigya SDK (with custom schema if needed)
        public static func loginViewModel<T: GigyaAccountProtocol>(instance: GigyaCore<T>,
                                                                   loginIdPublisher: OwnID.CoreSDK.LoginIdPublisher) -> OwnID.FlowsSDK.LoginView.ViewModel {
            GigyaSDK.loginViewModel(instance: instance, loginIdPublisher: loginIdPublisher)
        }
        
        public static func createLoginView(viewModel: OwnID.FlowsSDK.LoginView.ViewModel,
                                           visualConfig: OwnID.UISDK.VisualLookConfig = .init()) -> OwnID.FlowsSDK.LoginView {
            OwnID.FlowsSDK.LoginView(viewModel: viewModel, visualConfig: visualConfig)
        }
    }
}
