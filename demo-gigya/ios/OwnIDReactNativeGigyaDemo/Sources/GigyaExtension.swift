import Foundation
import gigya_react_native_plugin_for_sap_customer_data_cloud
import Gigya
import OwnIDGigyaSDK

@objc public class GigyaExtension: NSObject {
  @objc public func setMySchema() {
    GigyaSdk.setSchema(GigyaAccount.self)
  }
}
