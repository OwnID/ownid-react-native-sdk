import Foundation
import React
import SDKCore
import Gigya
import OwnIDGigyaSDK

struct GenericError: Error {
    static let genericErrorCode = "configurationError"
}

@objc(OwnIdGigyaModule)
final class OwnIdGigyaModule: NSObject {
    
    @objc func createInstance(_ params: [String: Any],
                              resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {
        if let isLoggingEnabled = params["enableLogging"] as? Bool {
            OwnID.CoreSDK.logger.isEnabled = isLoggingEnabled
        }
        if let appId = params["appId"] as? String {
            let redirectionURL = (params["redirectUrlIos"] ?? params["redirectUrl"]) as? String
            let environment = params["env"] as? String
            let region = params["region"] as? String
            
            OwnID.ReactGigyaSDK.configure(GigyaAccount.self,
                                          appID: appId,
                                          redirectionURL: redirectionURL,
                                          environment: environment,
                                          region: region)
            resolve(nil)
        } else {
            reject(GenericError.genericErrorCode, "appId has not been provided", GenericError())
        }
    }
    
    @objc func register(_ loginId: String,
                        registrationParameters: [String: Any],
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
        let params = OwnID.GigyaSDK.Registration.Parameters(parameters: registrationParameters)
        CreationInformation.shared.registerViewModel?.register(registerParameters: params)
        resolve(nil)
    }
    
    @objc
    class func requiresMainQueueSetup() -> Bool { true }
}
