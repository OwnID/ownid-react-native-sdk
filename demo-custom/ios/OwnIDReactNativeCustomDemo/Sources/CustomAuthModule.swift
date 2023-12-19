import React
import Foundation
import Combine
import OwnIDCoreSDK

@objc(CustomAuthModule)
final class CustomAuthModule: NSObject {
  let genericErrorCode = "someCustomError"
  
  private var result: OperationResult!
  
  private var bag = Set<AnyCancellable>()
  
  @objc func isLoggedIn(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(CustomAuthSystem.isLoggedIn())
  }
  
  @objc func getProfile(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    CustomAuthSystem.fetchUserData()
      .sink { completionRegister in
        if case .failure(let error) = completionRegister {
          reject(self.genericErrorCode, error.localizedDescription, error)
        }
      } receiveValue: { model in
        let profileDict: [String: Any] = ["name": model.name, "email": model.email]
        resolve(profileDict)
      }
      .store(in: &bag)
  }
  
  @objc func register(_ loginId: String,
                      password: String,
                      name: String,
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
    CustomAuthSystem.register(ownIdData: nil, password: password, email: loginId, name: name)
      .sink { completionRegister in
        if case .failure(let error) = completionRegister {
          reject(self.genericErrorCode, error.localizedDescription, error)
        }
      } receiveValue: { model in
        let profileDict: [String: Any] = ["name": name, "email": loginId]
        resolve(profileDict)
      }
      .store(in: &bag)
  }
  
  @objc func login(_ loginId: String,
                   password: String,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
    CustomAuthSystem.login(ownIdData: nil, password: password, email: loginId)
      .sink { completionRegister in
        if case .failure(let error) = completionRegister {
          reject(self.genericErrorCode, error.localizedDescription, error)
        }
      } receiveValue: { model in
        let profileDict: [String: Any] =  ["name": CustomAuthSystem.customUser?.name ?? "",
                                           "email": loginId]
        resolve(profileDict)
      }
      .store(in: &bag)
  }
  
  @objc func logout(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if CustomAuthSystem.isLoggedIn() {
      CustomAuthSystem.logOut()
    }
    resolve(nil)
  }
  
  @objc
  class func requiresMainQueueSetup() -> Bool { true }
}
