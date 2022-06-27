import React
import Foundation
import Gigya

@objc(GigyaModule)
final class GigyaModule: NSObject {
  let genericErrorCode = "323332323232323"
  
  @objc func isLoggedIn(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(GigyaShared.instance.isLoggedIn())
  }
  
  @objc func getProfile(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    GigyaShared.instance.getAccount(true) { result in
      switch result {
      case .success(data: let account):
        let profileDict: [String: Any] = ["name": account.profile?.firstName ?? "", "email": account.profile?.email ?? ""]
        resolve(profileDict)
        
      case .failure(let error):
        switch error {
        case .gigyaError(let data):
          reject(String(data.errorCode), data.errorMessage, error)
        default:
          reject(self.genericErrorCode, error.localizedDescription, error)
        }
      }
    }
  }
  
  @objc func register(_ loginId: String,
                      password: String,
                      name: String,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
    GigyaShared.instance.register(email: loginId, password: password, params: params(firstName: name)) { result in
      switch result {
      case .success(data: let account):
        let profileDict: [String: Any] = ["name": account.profile?.firstName ?? "", "email": account.profile?.email ?? ""]
        resolve(profileDict)
        
      case .failure(let error):
        reject(self.genericErrorCode, error.error.generalError.localizedDescription, error.error.generalError)
      }
    }
  }
  
  @objc func login(_ loginId: String,
                   password: String,
                   params: [String: Any],
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
    GigyaShared.instance.login(loginId: loginId, password: password, params: params) { result in
      switch result {
      case .success(data: let account):
        let profileDict: [String: Any] = ["name": account.profile?.firstName ?? "", "email": account.profile?.email ?? ""]
        resolve(profileDict)
        
      case .failure(let error):
        reject(self.genericErrorCode, error.error.generalError.localizedDescription, error.error.generalError)
      }
    }
  }
  
  @objc func logout(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if GigyaShared.instance.isLoggedIn() {
      GigyaShared.instance.logout()
    }
    resolve(nil)
  }
  
  private func params(firstName: String) -> [String: Any] {
    let nameValue = "{ \"firstName\": \"\(firstName)\" }"
    let paramsDict = ["profile": nameValue]
    return paramsDict
  }
  
  @objc
  class func requiresMainQueueSetup() -> Bool { true }
}
