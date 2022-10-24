import Foundation
import Gigya
import OwnIDCoreSDK
import SDKGigya
import SDKCore

@objc
public final class OwnIDSDKInitializer: NSObject {
  @objc public static func initSDK() {
    CreationInformation.shared.errorTransformClosure = { $0.mapGigyaCoreError(GigyaAccount.self) }
    CreationInformation.shared.shouldSkipErrorClosure = { error in
      switch error {
      case .flowCancelled:
        return false
      default:
        return true
      }
    }
  }
}
