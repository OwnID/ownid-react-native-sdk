import React
import Foundation
import Gigya

@objc(GigyaModule)
final class GigyaModule: NSObject {
  let genericErrorCode = "profileError"
  
  @objc func isLoggedIn(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(Gigya.sharedInstance().isLoggedIn())
  }
  
  @objc func getProfile(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    Gigya.sharedInstance().getAccount(true) { result in
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
  
  @objc func initialize(_ config: [String: String],
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    Gigya.sharedInstance().initFor(apiKey: config["apiKey"]!, apiDomain: config["apiDomain"]!)
    resolve([:])
  }
  
  @objc func register(_ loginId: String,
                      password: String,
                      name: String,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
    Gigya.sharedInstance().register(email: loginId, password: password, params: params(firstName: name)) { result in
      switch result {
      case .success(data: let account):
        let profileDict: [String: Any] = ["name": account.profile?.firstName ?? "", "email": account.profile?.email ?? ""]
        resolve(profileDict)
        
      case .failure(let error):
        reject(self.genericErrorCode, error.error.localizedDescription, error.error)
      }
    }
  }
  
  @objc func login(_ loginId: String,
                   password: String,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
    Gigya.sharedInstance().login(loginId: loginId, password: password) { result in
      switch result {
      case .success(data: let account):
        let profileDict: [String: Any] = ["name": account.profile?.firstName ?? "", "email": account.profile?.email ?? ""]
        resolve(profileDict)
        
      case .failure(let error):
        reject(self.genericErrorCode, error.error.localizedDescription, error.error)
      }
    }
  }
  
  @objc func logout(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if Gigya.sharedInstance().isLoggedIn() {
      Gigya.sharedInstance().logout { _ in
        resolve(nil)
      }
    } else {
      resolve(nil)
    }
  }
  
  private func params(firstName: String) -> [String: Any] {
    let nameValue = "{ \"firstName\": \"\(firstName)\" }"
    let paramsDict = ["profile": nameValue]
    return paramsDict
  }
  
  @objc
  class func requiresMainQueueSetup() -> Bool { true }
}
