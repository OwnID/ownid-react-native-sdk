import Foundation
import React
import OwnIDCoreSDK

@objc(OwnIdModule)
final class OwnIdModule: RCTViewManager {
    
    @objc func createInstance(_ config: [String: Any],
                              productName: String,
                              instanceName: String?,
                              resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {
        OwnID.createInstanceReact(config, productName: productName, instanceName: instanceName, resolve: resolve, reject: reject)
    }
    
    @objc
    override class func requiresMainQueueSetup() -> Bool { true }
}
