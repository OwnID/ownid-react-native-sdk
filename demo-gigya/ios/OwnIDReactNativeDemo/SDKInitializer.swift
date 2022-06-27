import Foundation
import Gigya
import OwnIDCoreSDK
import NormalizedGigyaError

@objc
public final class OwnIDSDKInitializer: NSObject {
  @objc public static func initSDK() {
    configureSDK()
    createViewClosure()
    setupErrorTransformClosure()
  }
  
  private static func configureSDK() {
    OwnID.ReactGigyaSDK.configure()
  }
  
  private static func createViewClosure() {
    CreationInformation.shared.viewCreationClosure = { type in
      let vc = OwnIDGigyaButtonViewController<OwnIDAccount>()
      vc.type = type
      return vc
    }
  }
  
  private static func setupErrorTransformClosure() {
    CreationInformation.shared.errorTransformClosure = { $0.mapGigyaCoreError(OwnIDAccount.self) }
  }
}
