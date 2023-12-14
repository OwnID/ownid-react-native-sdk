import OwnIDCoreSDK
@_exported import SDKCore

@objc
public final class OwnIDSDKInitializer: NSObject {
  static let sdkName = "OwnIDCustom"
  static let version = "2.1.0"
  
  @objc public static func initSDK() {
    OwnID.CoreSDK.shared.configure(userFacingSDK: info(), underlyingSDKs: [])
    CreationInformation.shared.setupController()
  }
  
  public static func info() -> OwnID.CoreSDK.SDKInformation {
    (sdkName, version)
  }
}
