import React
import Foundation
import OwnIDCoreSDK

@objc(PrefModule)
final class PrefModule: NSObject {
  private let key = "APP_CONFIG"
  private let defaults = UserDefaults.standard
  private let correlationId = UUID().uuidString
  
  @objc func saveConfig(_ value: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    defaults.set(value, forKey: key)
    resolve(nil)
  }
  
  @objc func readConfig() -> String {
    return defaults.string(forKey: key) ?? "{}"
  }
  
  @objc func clear(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    defaults.removeObject(forKey: key)
    resolve(nil)
  }
  
  @objc func restart(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    fatalError("Needs app restart")
  }
  
  @objc func runningConfig(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let userFacingSDKs = "Integration"
    var context = ""
    var env = ""
    
    if OwnID.CoreSDK.shared.isSDKConfigured {
      let url = OwnID.CoreSDK.shared.serverConfigurationURL?.deletingLastPathComponent()
      context = url?.pathComponents.last ?? ""
      
      let components = url?.host?.components(separatedBy: ".") ?? []
      let envs = ["dev", "staging", "uat"]
      env = Set(components).intersection(envs).first ?? "prod"
    }
    let instanceID = "CorrelationId: \(OwnID.CoreSDK.LoggerConstants.instanceID.uuidString)"
    resolve("\(userFacingSDKs) @ \(env) : \(context)\n\(instanceID)")
  }
  
  @objc
  class func requiresMainQueueSetup() -> Bool { true }
}
