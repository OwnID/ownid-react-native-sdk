import OwnIDCoreSDK
import React

extension OwnID {
    struct GenericError: Error {
        static let genericErrorCode = "configurationError"
    }
    
    public static func createInstanceReact(_ config: [String: Any],
                                           productName: String,
                                           instanceName: String?,
                                           resolve: @escaping RCTPromiseResolveBlock,
                                           reject: @escaping RCTPromiseRejectBlock) {
        CreationInformation.shared.hasIntegration = instanceName != nil
        CreationInformation.shared.authIntegration = CoreAuthIntegration()
        
        if let isLoggingEnabled = config["enableLogging"] as? Bool {
            OwnID.CoreSDK.logger.isEnabled = isLoggingEnabled
        }
        if let appId = config["appId"] as? String {
            let redirectionURL = (config["redirectUrlIos"] ?? config["redirectUrl"]) as? String
            let environment = config["env"] as? String
            
            let sdkName = productName.components(separatedBy: "/").first ?? productName
            let sdkVersion = productName.components(separatedBy: "/").last ?? ""
            OwnID.CoreSDK.shared.configure(appID: appId,
                                           redirectionURL: redirectionURL,
                                           userFacingSDK: (sdkName, sdkVersion),
                                           environment: environment,
                                           supportedLanguages: .init(rawValue: Locale.preferredLanguages))
            resolve(nil)
        } else {
            reject(GenericError.genericErrorCode, "appId has not been provided", GenericError())
        }
    }
}
