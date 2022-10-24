import Foundation
import React
import SDKCore
import Gigya
import OwnIDGigyaSDK

struct GenericError: Error {
    static let genericErrorCode = "323332323232323"
}

@objc(OwnIdGigyaModule)
final class OwnIdGigyaModule: NSObject {
    
    @objc func createInstance(_ params: [String: Any],
                              resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {
        if let isLoggingEnabled = params["enable_logging"] as? Int, isLoggingEnabled == 1 {
            OwnID.startDebugConsoleLogger()
        }
        let redirect = params["redirection_uri_ios"] ?? params["redirection_uri"]
        if let appId = params["app_id"] as? String, let redirectionUrl = redirect as? String {
            let env = params["env"] as? String
            OwnID.ReactGigyaSDK.configure(GigyaAccount.self, appID: appId, redirectionURL: redirectionUrl, environment: env)
            resolve(nil)
        } else {
            reject(GenericError.genericErrorCode, "app_id and redirection_url has not been provided", GenericError())
        }
    }
    
    @objc
    class func requiresMainQueueSetup() -> Bool { true }
}
