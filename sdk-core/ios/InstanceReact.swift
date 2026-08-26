import OwnIDCoreSDK
import React

extension OwnID {
    struct GenericError: Error {
        static let genericErrorCode = "configurationError"
        static let unsupportedInstanceNameCode = "unsupportedInstanceName"
        static let unsupportedInstanceNameMessage = "Named OwnID instances are not supported"
    }

    private struct ReactConfiguration {
        let appID: String?
        let environment: String?
        let region: String?
        let enableLogging: Bool?
        let redirectionURL: String?

        init(_ config: [String: Any]) {
            appID = config["appId"] as? String
            environment = config["env"] as? String
            region = config["region"] as? String
            enableLogging = config["enableLogging"] as? Bool

            // iOS deliberately ignores the Android-specific key.
            // The platform-specific value takes precedence over the shared value.
            redirectionURL = (config["redirectionUriIos"] as? String)
                ?? (config["redirectionUri"] as? String)
        }
    }

    static func runOnMainThread(_ block: @escaping () -> Void) {
        if Thread.isMainThread {
            block()
        } else {
            DispatchQueue.main.async(execute: block)
        }
    }

    public static func createInstanceReact(
        _ config: [String: Any],
        productName: String,
        instanceName: String?,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        runOnMainThread {
            guard instanceName == nil else {
                reject(
                    GenericError.unsupportedInstanceNameCode,
                    GenericError.unsupportedInstanceNameMessage,
                    GenericError()
                )
                return
            }

            CreationInformation.shared.hasIntegration = false
            CreationInformation.shared.authIntegration = CoreAuthIntegration()

            let configuration = ReactConfiguration(config)
            if let isLoggingEnabled = configuration.enableLogging {
                OwnID.CoreSDK.logger.isEnabled = isLoggingEnabled
            }
            if let appId = configuration.appID {
                let sdkName = productName.components(separatedBy: "/").first ?? productName
                let sdkVersion = productName.components(separatedBy: "/").last ?? ""
                OwnID.CoreSDK.configure(
                    appID: appId,
                    redirectionURL: configuration.redirectionURL,
                    userFacingSDK: (sdkName, sdkVersion),
                    environment: configuration.environment,
                    region: configuration.region,
                    enableLogging: configuration.enableLogging
                )
                resolve(nil)
            } else {
                reject(GenericError.genericErrorCode, "appId has not been provided", GenericError())
            }
        }
    }
}
