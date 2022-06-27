import Foundation
import OwnIDUISDK
import React
import OwnIDCoreSDK

@objc(OwnIdNativeModule)
final class OwnIdNativeModule: RCTViewManager {
  
  @objc func register(_ loginId: String,
                      registrationParameters: [String: Any],
                      resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
    if let view = CreationInformation.shared.viewInstance {
      view.controller.register(loginId, registrationParameters: registrationParameters)
    }
    resolve(nil)
  }
  
  @objc func undo(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if let view = CreationInformation.shared.viewInstance {
      view.controller.undo()
    }
    resolve(nil)
  }
  
  @objc
  override class func requiresMainQueueSetup() -> Bool { true }
}
