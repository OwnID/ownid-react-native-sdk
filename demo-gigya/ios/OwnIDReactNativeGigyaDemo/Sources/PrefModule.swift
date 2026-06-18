import React
import SDKGigya

@objc(PrefModule)
public final class PrefModule: NSObject {
  private let keyName = "APP_CONFIG"
  private let correlationId = UUID().uuidString
  
  @objc
  class func requiresMainQueueSetup() -> Bool { true }
  
  @objc func saveConfig(_ value: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    UserDefaults.standard.set(value, forKey: keyName)
    resolve([:])
  }
  
  @objc func _readConfig() -> String {
    (UserDefaults.standard.value(forKey: keyName) as? String) ?? "{}"
  }
  
  @objc func clear(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    UserDefaults.standard.removeObject(forKey: keyName)
    resolve([:])
  }
  
  @objc func restart(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    fatalError("Needs app restart")
  }

  @objc func runningConfig(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let userFacingSDKs = "Gigya"
    var context = ""
    var env = ""
    
    if OwnID.CoreSDK.shared.isSDKConfigured {
      env = " "
    }
    let instanceID = "CorrelationId: \(OwnID.CoreSDK.LoggerConstants.instanceID.uuidString)"
    resolve("\(userFacingSDKs) @ \(env) : \(context)\n\(instanceID)")
  }
}
